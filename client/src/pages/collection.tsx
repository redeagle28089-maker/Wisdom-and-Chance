import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureFlag } from "@/lib/config";
import { CardWithPopup, elementConfig } from "@/components/game-card";
import { Coins, Gem, Sparkles, Package, LogIn } from "lucide-react";
import type { Card as CardType, Element } from "@shared/schema";
import { getCardRarity, ECONOMY_CONSTANTS } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface CollectionEntry {
  cardId: string;
  quantity: number;
}

interface Currencies {
  gold: number;
  gems: number;
  dust: number;
}

const RARITY_COLORS: Record<string, string> = {
  Common: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  Rare: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Epic: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  Legendary: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

export default function CollectionPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const economyEnabled = useFeatureFlag("economy_enabled");
  const [filterElement, setFilterElement] = useState<Element | "all">("all");
  const [filterRarity, setFilterRarity] = useState<string>("all");

  const { data: cards = [] } = useQuery<CardType[]>({
    queryKey: ["/api/cards"],
  });

  const { data: collection = [] } = useQuery<CollectionEntry[]>({
    queryKey: ["/api/collection"],
    enabled: isAuthenticated && economyEnabled,
  });

  const { data: currencies } = useQuery<Currencies>({
    queryKey: ["/api/currencies"],
    enabled: isAuthenticated && economyEnabled,
  });

  const ownedMap = useMemo(() => {
    const map = new Map<string, number>();
    collection.forEach(e => map.set(e.cardId, e.quantity));
    return map;
  }, [collection]);

  const uniqueCards = useMemo(() => {
    const seen = new Map<string, CardType>();
    cards.forEach(card => {
      const key = `${card.element}-${card.power}-${card.name.split('#')[0].trim()}`;
      if (!seen.has(key)) seen.set(key, card);
    });
    return Array.from(seen.values())
      .filter(c => filterElement === "all" || c.element === filterElement)
      .filter(c => filterRarity === "all" || getCardRarity(c.power) === filterRarity)
      .sort((a, b) => {
        if (a.element !== b.element) return a.element.localeCompare(b.element);
        return a.power - b.power;
      });
  }, [cards, filterElement, filterRarity]);

  const stats = useMemo(() => {
    let totalOwned = 0;
    let totalCards = uniqueCards.length;
    let uniqueOwned = 0;
    const byRarity: Record<string, { owned: number; total: number }> = {
      Common: { owned: 0, total: 0 },
      Rare: { owned: 0, total: 0 },
      Epic: { owned: 0, total: 0 },
      Legendary: { owned: 0, total: 0 },
    };

    for (const card of uniqueCards) {
      const rarity = getCardRarity(card.power);
      byRarity[rarity].total++;
      const qty = ownedMap.get(card.id) ?? 0;
      if (qty > 0) {
        uniqueOwned++;
        totalOwned += qty;
        byRarity[rarity].owned++;
      }
    }

    return { totalOwned, totalCards, uniqueOwned, byRarity };
  }, [uniqueCards, ownedMap]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <LogIn className="w-16 h-16 text-purple-400" />
        <h2 className="text-2xl font-bold text-white">Sign In Required</h2>
        <p className="text-gray-400 text-center">Sign in to view your card collection.</p>
      </div>
    );
  }

  if (!economyEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <Package className="w-16 h-16 text-gray-500" />
        <h2 className="text-2xl font-bold text-white">Collection Not Available</h2>
        <p className="text-gray-400 text-center">The economy system is not yet enabled.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white" data-testid="text-collection-title">My Collection</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-yellow-900/20 border-yellow-500/30">
          <CardContent className="flex items-center gap-3 p-4">
            <Coins className="w-8 h-8 text-yellow-400" />
            <div>
              <p className="text-sm text-yellow-300/70">Gold</p>
              <p className="text-2xl font-bold text-yellow-300" data-testid="text-gold-balance">{currencies?.gold ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-cyan-900/20 border-cyan-500/30">
          <CardContent className="flex items-center gap-3 p-4">
            <Gem className="w-8 h-8 text-cyan-400" />
            <div>
              <p className="text-sm text-cyan-300/70">Gems</p>
              <p className="text-2xl font-bold text-cyan-300" data-testid="text-gems-balance">{currencies?.gems ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-900/20 border-purple-500/30">
          <CardContent className="flex items-center gap-3 p-4">
            <Sparkles className="w-8 h-8 text-purple-400" />
            <div>
              <p className="text-sm text-purple-300/70">Dust</p>
              <p className="text-2xl font-bold text-purple-300" data-testid="text-dust-balance">{currencies?.dust ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-800/50 border-purple-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-lg">Collection Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-3">
            <div className="text-white">
              <span className="text-2xl font-bold" data-testid="text-unique-owned">{stats.uniqueOwned}</span>
              <span className="text-gray-400"> / {stats.totalCards} unique cards</span>
            </div>
            <div className="flex-1 bg-slate-700 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all"
                style={{ width: `${stats.totalCards > 0 ? (stats.uniqueOwned / stats.totalCards) * 100 : 0}%` }}
                data-testid="progress-collection"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(stats.byRarity).map(([rarity, { owned, total }]) => (
              <div key={rarity} className={`rounded-lg p-2 border ${RARITY_COLORS[rarity]}`}>
                <p className="text-xs font-medium">{rarity}</p>
                <p className="text-lg font-bold" data-testid={`text-rarity-${rarity.toLowerCase()}`}>{owned}/{total}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={filterElement === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterElement("all")}
          data-testid="button-filter-all-elements"
        >
          All Elements
        </Button>
        {(["Fire", "Water", "Earth", "Nature", "Air"] as Element[]).map(el => (
          <Button
            key={el}
            variant={filterElement === el ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterElement(el)}
            data-testid={`button-filter-${el.toLowerCase()}`}
            className={filterElement === el ? elementConfig[el]?.bgClass : ""}
          >
            {elementConfig[el]?.emoji} {el}
          </Button>
        ))}
        <div className="w-px bg-gray-600 mx-1" />
        <Button
          variant={filterRarity === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterRarity("all")}
          data-testid="button-filter-all-rarities"
        >
          All Rarities
        </Button>
        {["Common", "Rare", "Epic", "Legendary"].map(r => (
          <Button
            key={r}
            variant={filterRarity === r ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterRarity(r)}
            data-testid={`button-filter-${r.toLowerCase()}`}
          >
            {r}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {uniqueCards.map(card => {
          const qty = ownedMap.get(card.id) ?? 0;
          const rarity = getCardRarity(card.power);
          return (
            <div key={card.id} className={`relative ${qty === 0 ? "opacity-40 grayscale" : ""}`} data-testid={`card-collection-${card.id}`}>
              <CardWithPopup card={card} size="sm" />
              <Badge className={`absolute top-1 right-1 text-[10px] px-1.5 py-0.5 ${RARITY_COLORS[rarity]}`}>
                {rarity}
              </Badge>
              <Badge
                className={`absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 ${qty === 0 ? "bg-red-600/80" : "bg-emerald-600/80"}`}
                data-testid={`badge-qty-${card.id}`}
              >
                {qty === 0 ? "Not Owned" : `x${qty}`}
              </Badge>
            </div>
          );
        })}
      </div>

      {uniqueCards.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>No cards match your filters.</p>
        </div>
      )}
    </div>
  );
}
