import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureFlag } from "@/lib/config";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Coins, Gem, Sparkles, ShoppingBag, Timer, Flame, Droplets, Mountain,
  Wind, Leaf, Star, LogIn, Tag, Package, Gift, AlertTriangle, Check, X
} from "lucide-react";
import { ECONOMY_CONSTANTS } from "@shared/schema";

interface PackCatalogItem {
  id: string;
  name: string;
  description: string;
  costGold: number;
  costGems: number;
  cardsPerPack: number;
  elementFilter: string | null;
  guaranteedMinRarity: string | null;
}

interface DailyDeal {
  packTypeId: string;
  packName: string;
  originalCostGold: number;
  discountedCostGold: number;
  discountPercent: number;
  featuredCardId: string | null;
  expiresAt: string;
}

interface Currencies {
  gold: number;
  gems: number;
  dust: number;
}

interface ConfirmPurchase {
  packTypeId: string;
  packName: string;
  cost: number;
  useDailyDeal?: boolean;
}

const ELEMENT_ICONS: Record<string, typeof Flame> = {
  Fire: Flame,
  Water: Droplets,
  Earth: Mountain,
  Air: Wind,
  Nature: Leaf,
};

const ELEMENT_COLORS: Record<string, string> = {
  Fire: "from-red-600/30 to-orange-600/30 border-red-500/40",
  Water: "from-blue-600/30 to-cyan-600/30 border-blue-500/40",
  Earth: "from-amber-700/30 to-yellow-700/30 border-amber-600/40",
  Air: "from-sky-500/30 to-indigo-500/30 border-sky-400/40",
  Nature: "from-green-600/30 to-emerald-600/30 border-green-500/40",
};

const SPECIAL_OFFERS = [
  {
    id: "starter-bundle",
    name: "Starter Bundle",
    description: "Perfect for new players! Get 3 Standard Packs and 1 Premium Pack at a discounted price.",
    costGold: 500,
    originalCostGold: 550,
    icon: Gift,
    color: "from-emerald-600/30 to-teal-600/30 border-emerald-500/40",
    packs: [
      { type: "standard", count: 3 },
      { type: "premium", count: 1 },
    ],
  },
  {
    id: "element-sampler",
    name: "Element Sampler",
    description: "One pack from each element! Great for exploring all playstyles.",
    costGold: 650,
    originalCostGold: 750,
    icon: Sparkles,
    color: "from-violet-600/30 to-fuchsia-600/30 border-violet-500/40",
    packs: [
      { type: "fire", count: 1 },
      { type: "water", count: 1 },
      { type: "earth", count: 1 },
      { type: "air", count: 1 },
      { type: "nature", count: 1 },
    ],
  },
];

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${hours}h ${mins}m ${secs}s`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <span className="font-mono text-amber-400" data-testid="text-countdown">
      {timeLeft}
    </span>
  );
}

function PurchaseConfirmDialog({
  purchase,
  currencies,
  isPending,
  onConfirm,
  onCancel,
}: {
  purchase: ConfirmPurchase;
  currencies: Currencies;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const balanceAfter = currencies.gold - purchase.cost;
  const canAfford = balanceAfter >= 0;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === overlayRef.current && onCancel()}
      data-testid="purchase-confirm-dialog"
    >
      <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Confirm Purchase</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-white" data-testid="button-cancel-purchase">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 mb-6">
          <div className="bg-slate-700/50 rounded-lg p-3">
            <p className="text-white font-semibold" data-testid="text-confirm-pack-name">{purchase.packName}</p>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Cost</span>
            <div className="flex items-center gap-1">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="text-amber-300 font-bold" data-testid="text-confirm-cost">{purchase.cost}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Current Balance</span>
            <div className="flex items-center gap-1">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="text-amber-300" data-testid="text-confirm-current-balance">{currencies.gold.toLocaleString()}</span>
            </div>
          </div>

          <div className="border-t border-slate-600 my-2" />

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Balance After</span>
            <div className="flex items-center gap-1">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className={`font-bold ${canAfford ? "text-green-400" : "text-red-400"}`} data-testid="text-confirm-balance-after">
                {balanceAfter.toLocaleString()}
              </span>
            </div>
          </div>

          {!canAfford && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg p-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Not enough gold for this purchase.</span>
            </div>
          )}

          <p className="text-xs text-slate-500 mt-2">
            Duplicate cards you already own will increase your copy count. You can disenchant extras for dust.
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1 border-slate-600 text-slate-300"
            data-testid="button-confirm-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!canAfford || isPending}
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            data-testid="button-confirm-buy"
          >
            {isPending ? "Purchasing..." : (
              <>
                <Check className="w-4 h-4 mr-1" />
                Buy Now
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ShopPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const economyEnabled = useFeatureFlag("economy_enabled");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"packs" | "daily" | "offers">("packs");
  const [confirmPurchase, setConfirmPurchase] = useState<ConfirmPurchase | null>(null);

  const { data: catalog = [] } = useQuery<PackCatalogItem[]>({
    queryKey: ["/api/shop/catalog"],
    enabled: economyEnabled,
  });

  const { data: dailyDeal } = useQuery<DailyDeal>({
    queryKey: ["/api/shop/daily-deals"],
    enabled: economyEnabled,
  });

  const { data: currencies } = useQuery<Currencies>({
    queryKey: ["/api/currencies"],
    enabled: isAuthenticated && economyEnabled,
  });

  const purchaseMutation = useMutation({
    mutationFn: async ({ packTypeId, useDailyDeal }: { packTypeId: string; useDailyDeal?: boolean }) => {
      const res = await apiRequest("POST", "/api/shop/purchase", { packTypeId, useDailyDeal });
      return res.json();
    },
    onSuccess: (data) => {
      setConfirmPurchase(null);
      queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collection"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop/daily-deals"] });
      navigate(`/pack-opening?data=${encodeURIComponent(JSON.stringify(data))}`);
    },
    onError: (error: Error) => {
      setConfirmPurchase(null);
      toast({
        title: "Purchase Failed",
        description: error.message.includes("Not enough gold")
          ? "You don't have enough gold. Win matches or complete challenges to earn more!"
          : error.message,
        variant: "destructive",
      });
    },
  });

  const bundlePurchaseMutation = useMutation({
    mutationFn: async ({ packs }: { packs: { type: string; count: number }[] }) => {
      const results = [];
      for (const pack of packs) {
        for (let i = 0; i < pack.count; i++) {
          const res = await apiRequest("POST", "/api/shop/purchase", { packTypeId: pack.type });
          results.push(await res.json());
        }
      }
      const allCards = results.flatMap(r => r.cards);
      const lastResult = results[results.length - 1];
      return {
        packTypeId: "bundle",
        packName: "Bundle Pack",
        cards: allCards,
        costGold: results.reduce((sum, r) => sum + r.costGold, 0),
        remainingGold: lastResult?.remainingGold ?? 0,
        remainingGems: lastResult?.remainingGems ?? 0,
      };
    },
    onSuccess: (data) => {
      setConfirmPurchase(null);
      queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collection"] });
      navigate(`/pack-opening?data=${encodeURIComponent(JSON.stringify(data))}`);
    },
    onError: (error: Error) => {
      setConfirmPurchase(null);
      toast({
        title: "Bundle Purchase Failed",
        description: error.message.includes("Not enough gold")
          ? "You don't have enough gold to complete the bundle purchase."
          : error.message,
        variant: "destructive",
      });
    },
  });

  if (!economyEnabled) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="shop-disabled">
        <Card className="w-96 bg-slate-800/60 border-slate-700">
          <CardContent className="pt-6 text-center">
            <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-slate-500" />
            <p className="text-slate-400">The shop is not available yet.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="shop-login-prompt">
        <Card className="w-96 bg-slate-800/60 border-slate-700">
          <CardContent className="pt-6 text-center">
            <LogIn className="w-12 h-12 mx-auto mb-4 text-purple-400" />
            <p className="text-slate-300 mb-2">Sign in to access the shop</p>
            <p className="text-sm text-slate-500">Browse and purchase card packs to build your collection.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canAfford = (cost: number) => (currencies?.gold ?? 0) >= cost;

  const handleBuyClick = (packTypeId: string, packName: string, cost: number, useDailyDeal?: boolean) => {
    setConfirmPurchase({ packTypeId, packName, cost, useDailyDeal });
  };

  const handleConfirmPurchase = () => {
    if (!confirmPurchase) return;

    const specialOffer = SPECIAL_OFFERS.find(o => o.id === confirmPurchase.packTypeId);
    if (specialOffer) {
      bundlePurchaseMutation.mutate({ packs: specialOffer.packs });
    } else {
      purchaseMutation.mutate({
        packTypeId: confirmPurchase.packTypeId,
        useDailyDeal: confirmPurchase.useDailyDeal,
      });
    }
  };

  const isPurchasing = purchaseMutation.isPending || bundlePurchaseMutation.isPending;

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl" data-testid="shop-page">
      {confirmPurchase && currencies && (
        <PurchaseConfirmDialog
          purchase={confirmPurchase}
          currencies={currencies}
          isPending={isPurchasing}
          onConfirm={handleConfirmPurchase}
          onCancel={() => setConfirmPurchase(null)}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShoppingBag className="w-7 h-7 text-purple-400" />
          <h1 className="text-2xl font-bold text-white">Shop</h1>
        </div>
        {currencies && (
          <div className="flex items-center gap-4" data-testid="shop-currency-display">
            <div className="flex items-center gap-1.5 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="text-amber-300 font-semibold" data-testid="text-gold-balance">{currencies.gold.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">
              <Gem className="w-4 h-4 text-blue-400" />
              <span className="text-blue-300 font-semibold" data-testid="text-gem-balance">{currencies.gems.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-purple-500/10 px-3 py-1.5 rounded-lg border border-purple-500/20">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-purple-300 font-semibold" data-testid="text-dust-balance">{currencies.dust.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-6">
        <Button
          variant={activeTab === "packs" ? "default" : "outline"}
          onClick={() => setActiveTab("packs")}
          className={activeTab === "packs" ? "bg-purple-600 hover:bg-purple-700" : "border-slate-600 text-slate-300"}
          data-testid="button-tab-packs"
        >
          <Package className="w-4 h-4 mr-2" />
          Card Packs
        </Button>
        <Button
          variant={activeTab === "daily" ? "default" : "outline"}
          onClick={() => setActiveTab("daily")}
          className={activeTab === "daily" ? "bg-amber-600 hover:bg-amber-700" : "border-slate-600 text-slate-300"}
          data-testid="button-tab-daily"
        >
          <Tag className="w-4 h-4 mr-2" />
          Daily Deals
        </Button>
        <Button
          variant={activeTab === "offers" ? "default" : "outline"}
          onClick={() => setActiveTab("offers")}
          className={activeTab === "offers" ? "bg-emerald-600 hover:bg-emerald-700" : "border-slate-600 text-slate-300"}
          data-testid="button-tab-offers"
        >
          <Gift className="w-4 h-4 mr-2" />
          Special Offers
        </Button>
      </div>

      {activeTab === "packs" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="pack-catalog-grid">
          {catalog.map((pack) => {
            const elementColor = pack.elementFilter ? ELEMENT_COLORS[pack.elementFilter] : "from-purple-600/20 to-indigo-600/20 border-purple-500/30";
            const ElementIcon = pack.elementFilter ? ELEMENT_ICONS[pack.elementFilter] : Star;
            const affordable = canAfford(pack.costGold);

            return (
              <Card
                key={pack.id}
                className={`bg-gradient-to-br ${elementColor} border hover:border-opacity-60 transition-all hover:scale-[1.02] relative overflow-hidden`}
                data-testid={`card-pack-${pack.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    {ElementIcon && <ElementIcon className="w-5 h-5 text-white/80" />}
                    <CardTitle className="text-lg text-white">{pack.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-300 mb-3 min-h-[40px]">{pack.description}</p>

                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="bg-slate-700/60 text-slate-200 text-xs">
                      {pack.cardsPerPack} Cards
                    </Badge>
                    {pack.guaranteedMinRarity && (
                      <Badge className="bg-purple-600/40 text-purple-200 text-xs border-purple-500/30">
                        Min: {pack.guaranteedMinRarity}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-1">
                      <Coins className="w-4 h-4 text-amber-400" />
                      <span className="text-amber-300 font-bold">{pack.costGold}</span>
                    </div>
                    <Button
                      size="sm"
                      disabled={!affordable || isPurchasing}
                      onClick={() => handleBuyClick(pack.id, pack.name, pack.costGold)}
                      className={affordable
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "bg-slate-700 text-slate-500 cursor-not-allowed"
                      }
                      data-testid={`button-buy-${pack.id}`}
                    >
                      {isPurchasing ? "..." : affordable ? "Buy" : "Not enough gold"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === "daily" && (
        <div className="max-w-lg mx-auto" data-testid="daily-deal-section">
          {dailyDeal ? (
            <Card className="bg-gradient-to-br from-amber-600/20 to-orange-600/20 border-amber-500/40 relative overflow-hidden">
              <div className="absolute top-2 right-2">
                <Badge className="bg-red-600 text-white border-0 text-xs font-bold animate-pulse">
                  -{dailyDeal.discountPercent}% OFF
                </Badge>
              </div>
              <CardHeader>
                <CardTitle className="text-xl text-amber-200 flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  Today's Deal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <h3 className="text-lg font-semibold text-white mb-2" data-testid="text-daily-deal-name">
                  {dailyDeal.packName}
                </h3>

                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-1">
                    <Coins className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-500 line-through" data-testid="text-original-price">
                      {dailyDeal.originalCostGold}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Coins className="w-5 h-5 text-amber-400" />
                    <span className="text-amber-300 font-bold text-xl" data-testid="text-discounted-price">
                      {dailyDeal.discountedCostGold}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4 text-sm">
                  <Timer className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-400">Expires in: </span>
                  <CountdownTimer expiresAt={dailyDeal.expiresAt} />
                </div>

                <Button
                  className={canAfford(dailyDeal.discountedCostGold)
                    ? "w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                    : "w-full bg-slate-700 text-slate-500 cursor-not-allowed"
                  }
                  disabled={!canAfford(dailyDeal.discountedCostGold) || isPurchasing}
                  onClick={() => handleBuyClick(dailyDeal.packTypeId, dailyDeal.packName, dailyDeal.discountedCostGold, true)}
                  data-testid="button-buy-daily-deal"
                >
                  {isPurchasing
                    ? "Purchasing..."
                    : canAfford(dailyDeal.discountedCostGold)
                      ? `Buy for ${dailyDeal.discountedCostGold} Gold`
                      : "Not enough gold"
                  }
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-800/60 border-slate-700">
              <CardContent className="pt-6 text-center">
                <Timer className="w-10 h-10 mx-auto mb-3 text-slate-500" />
                <p className="text-slate-400">Loading today's deal...</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "offers" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto" data-testid="special-offers-grid">
          {SPECIAL_OFFERS.map((offer) => {
            const affordable = canAfford(offer.costGold);
            const OfferIcon = offer.icon;
            const savingsPercent = Math.round((1 - offer.costGold / offer.originalCostGold) * 100);

            return (
              <Card
                key={offer.id}
                className={`bg-gradient-to-br ${offer.color} border hover:border-opacity-60 transition-all hover:scale-[1.02] relative overflow-hidden`}
                data-testid={`card-offer-${offer.id}`}
              >
                <div className="absolute top-2 right-2">
                  <Badge className="bg-green-600 text-white border-0 text-xs font-bold">
                    SAVE {savingsPercent}%
                  </Badge>
                </div>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <OfferIcon className="w-6 h-6 text-white/80" />
                    <CardTitle className="text-lg text-white">{offer.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-300 mb-3">{offer.description}</p>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {offer.packs.map((p, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-slate-700/60 text-slate-200 text-xs">
                        {p.count}x {p.type.charAt(0).toUpperCase() + p.type.slice(1)}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Coins className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-500 line-through text-sm">{offer.originalCostGold}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Coins className="w-4 h-4 text-amber-400" />
                        <span className="text-amber-300 font-bold">{offer.costGold}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={!affordable || isPurchasing}
                      onClick={() => handleBuyClick(offer.id, offer.name, offer.costGold)}
                      className={affordable
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-slate-700 text-slate-500 cursor-not-allowed"
                      }
                      data-testid={`button-buy-${offer.id}`}
                    >
                      {isPurchasing ? "..." : affordable ? "Buy Bundle" : "Not enough gold"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
