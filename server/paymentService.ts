import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import { purchaseProducts, purchaseTransactions, playerCurrencies, playerCollection, playerBattlePass, seasons, PACK_TYPES, PURCHASE_PRODUCTS_SEED, type PurchaseProduct, type CardRarity, getCardRarity } from "@shared/schema";
import { storage } from "./storage";
import { ensureCurrencies } from "./economyService";

export async function seedPurchaseProducts() {
  for (const product of PURCHASE_PRODUCTS_SEED) {
    await db.insert(purchaseProducts)
      .values({
        id: product.id,
        name: product.name,
        description: product.description,
        productType: product.productType,
        priceUsd: product.priceUsd,
        priceGold: product.priceGold,
        priceGems: product.priceGems,
        gemsAmount: product.gemsAmount,
        packsJson: (product as any).packsJson || "[]",
        dustAmount: (product as any).dustAmount || 0,
        isOneTimePurchase: (product as any).isOneTimePurchase || false,
        isCurrencyPurchasable: product.isCurrencyPurchasable,
        isActive: true,
        badgeText: product.badgeText,
        sortOrder: product.sortOrder,
      })
      .onConflictDoNothing();
  }
  console.log("[payments] Seeded purchase products");
}

export async function getActiveProducts(): Promise<PurchaseProduct[]> {
  return db.select().from(purchaseProducts)
    .where(eq(purchaseProducts.isActive, true))
    .orderBy(purchaseProducts.sortOrder);
}

export async function getProduct(productId: string): Promise<PurchaseProduct | null> {
  const [product] = await db.select().from(purchaseProducts)
    .where(and(eq(purchaseProducts.id, productId), eq(purchaseProducts.isActive, true)))
    .limit(1);
  return product || null;
}

export async function hasAlreadyPurchased(userId: string, productId: string): Promise<boolean> {
  const [existing] = await db.select().from(purchaseTransactions)
    .where(and(
      eq(purchaseTransactions.userId, userId),
      eq(purchaseTransactions.productId, productId),
      eq(purchaseTransactions.status, "completed")
    ))
    .limit(1);
  return !!existing;
}

export async function fulfillPurchase(
  userId: string,
  product: PurchaseProduct,
  paymentMethod: string,
  paymentId: string | null,
  amountUsd: number,
  currencySpent: number,
): Promise<{ success: boolean; error?: string; transaction?: any; cards?: any[] }> {
  if (paymentId) {
    const [existing] = await db.select().from(purchaseTransactions)
      .where(and(eq(purchaseTransactions.paymentId, paymentId), eq(purchaseTransactions.status, "completed")))
      .limit(1);
    if (existing) return { success: false, error: "Payment already fulfilled" };
  }

  if (product.isOneTimePurchase) {
    const already = await hasAlreadyPurchased(userId, product.id);
    if (already) return { success: false, error: "This one-time purchase has already been claimed" };
  }

  return db.transaction(async (tx) => {
    const [txn] = await tx.insert(purchaseTransactions).values({
      userId,
      productId: product.id,
      paymentMethod,
      paymentId,
      amountUsd,
      currencySpent,
      status: "completed",
    }).returning();

    await ensureCurrencies(userId);

    if (product.gemsAmount > 0) {
      await tx.update(playerCurrencies)
        .set({ gems: sql`gems + ${product.gemsAmount}`, updatedAt: new Date() })
        .where(eq(playerCurrencies.userId, userId));
    }

    if (product.dustAmount > 0) {
      await tx.update(playerCurrencies)
        .set({ dust: sql`dust + ${product.dustAmount}`, updatedAt: new Date() })
        .where(eq(playerCurrencies.userId, userId));
    }

    let allPulledCards: any[] = [];
    const packs: { type: string; count: number }[] = JSON.parse(product.packsJson || "[]");
    if (packs.length > 0) {
      const allCards = await storage.getCards();
      const existingCollection = await tx.select().from(playerCollection).where(eq(playerCollection.userId, userId));
      const ownedMap = new Map(existingCollection.map(e => [e.cardId, e.quantity]));

      for (const packEntry of packs) {
        const packDef = PACK_TYPES[packEntry.type as keyof typeof PACK_TYPES];
        if (!packDef) continue;

        for (let p = 0; p < packEntry.count; p++) {
          let pool = allCards;
          if (packDef.elementFilter) {
            pool = allCards.filter(c => c.element === packDef.elementFilter);
          }

          const cardsByRarity: Record<CardRarity, typeof allCards> = {
            Common: pool.filter(c => getCardRarity(c.power) === "Common"),
            Rare: pool.filter(c => getCardRarity(c.power) === "Rare"),
            Epic: pool.filter(c => getCardRarity(c.power) === "Epic"),
            Legendary: pool.filter(c => getCardRarity(c.power) === "Legendary"),
          };

          const weights = packDef.rarityWeights as Record<CardRarity, number>;
          const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

          for (let i = 0; i < packDef.cardsPerPack; i++) {
            let roll = Math.random() * totalWeight;
            let selectedRarity: CardRarity = "Common";
            for (const [rarity, weight] of Object.entries(weights) as [CardRarity, number][]) {
              roll -= weight;
              if (roll <= 0) { selectedRarity = rarity; break; }
            }

            let rarityPool = cardsByRarity[selectedRarity];
            if (rarityPool.length === 0) {
              for (const fallback of ["Common", "Rare", "Epic", "Legendary"] as CardRarity[]) {
                if (cardsByRarity[fallback].length > 0) { rarityPool = cardsByRarity[fallback]; selectedRarity = fallback; break; }
              }
            }
            if (rarityPool.length === 0) continue;

            const card = rarityPool[Math.floor(Math.random() * rarityPool.length)];
            const isNew = !ownedMap.has(card.id);
            ownedMap.set(card.id, (ownedMap.get(card.id) || 0) + 1);

            await tx.insert(playerCollection)
              .values({ userId, cardId: card.id, quantity: 1 })
              .onConflictDoUpdate({
                target: [playerCollection.userId, playerCollection.cardId],
                set: { quantity: sql`${playerCollection.quantity} + 1` },
              });

            allPulledCards.push({ cardId: card.id, rarity: selectedRarity, isNew, cardName: card.name, element: card.element, power: card.power });
          }
        }
      }
    }

    if (product.productType === "battle_pass" || product.id === "season_pass_bundle") {
      const [season] = await tx.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
      if (season) {
        const [existing] = await tx.select().from(playerBattlePass)
          .where(and(eq(playerBattlePass.userId, userId), eq(playerBattlePass.seasonId, season.id)))
          .limit(1);
        if (existing) {
          await tx.update(playerBattlePass)
            .set({ premiumUnlocked: true, updatedAt: new Date() })
            .where(eq(playerBattlePass.id, existing.id));
        } else {
          await tx.insert(playerBattlePass).values({
            userId,
            seasonId: season.id,
            currentXp: 0,
            currentLevel: 0,
            claimedLevels: "[]",
            premiumUnlocked: true,
          }).onConflictDoNothing();
        }
      }
    }

    return { success: true, transaction: txn, cards: allPulledCards };
  });
}

export async function purchaseWithCurrency(
  userId: string,
  productId: string,
  currencyType: "gold" | "gems",
): Promise<{ success: boolean; error?: string; transaction?: any; cards?: any[]; currencies?: any }> {
  const product = await getProduct(productId);
  if (!product) return { success: false, error: "Product not found" };
  if (!product.isCurrencyPurchasable) return { success: false, error: "This product can only be purchased with real money" };

  const cost = currencyType === "gold" ? product.priceGold : product.priceGems;
  if (cost <= 0) return { success: false, error: `This product cannot be purchased with ${currencyType}` };

  if (product.isOneTimePurchase) {
    const already = await hasAlreadyPurchased(userId, productId);
    if (already) return { success: false, error: "This one-time purchase has already been claimed" };
  }

  await ensureCurrencies(userId);

  const field = currencyType === "gold" ? playerCurrencies.gold : playerCurrencies.gems;
  const deducted = await db.update(playerCurrencies)
    .set({
      [currencyType]: sql`${field} - ${cost}`,
      updatedAt: new Date(),
    })
    .where(and(eq(playerCurrencies.userId, userId), sql`${field} >= ${cost}`))
    .returning();

  if (deducted.length === 0) {
    const [cur] = await db.select().from(playerCurrencies).where(eq(playerCurrencies.userId, userId)).limit(1);
    return { success: false, error: `Not enough ${currencyType}`, currencies: cur ? { gold: cur.gold, gems: cur.gems, dust: cur.dust } : undefined };
  }

  const result = await fulfillPurchase(userId, product, currencyType, null, 0, cost);
  if (!result.success) {
    await db.update(playerCurrencies)
      .set({ [currencyType]: sql`${field} + ${cost}`, updatedAt: new Date() })
      .where(eq(playerCurrencies.userId, userId));
    return result;
  }

  const [updated] = await db.select().from(playerCurrencies).where(eq(playerCurrencies.userId, userId)).limit(1);
  return { ...result, currencies: updated ? { gold: updated.gold, gems: updated.gems, dust: updated.dust } : undefined };
}

export async function getPurchaseHistory(userId: string) {
  const transactions = await db.select({
    id: purchaseTransactions.id,
    productId: purchaseTransactions.productId,
    paymentMethod: purchaseTransactions.paymentMethod,
    amountUsd: purchaseTransactions.amountUsd,
    currencySpent: purchaseTransactions.currencySpent,
    status: purchaseTransactions.status,
    createdAt: purchaseTransactions.createdAt,
    productName: purchaseProducts.name,
    productType: purchaseProducts.productType,
  })
    .from(purchaseTransactions)
    .leftJoin(purchaseProducts, eq(purchaseTransactions.productId, purchaseProducts.id))
    .where(eq(purchaseTransactions.userId, userId))
    .orderBy(desc(purchaseTransactions.createdAt))
    .limit(50);
  return transactions;
}
