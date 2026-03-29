import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureFlag } from "@/lib/config";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Coins, Gem, Sparkles, ShoppingBag, Timer, Flame, Droplets, Mountain, Wind, Leaf, Star, LogIn, Tag, Package } from "lucide-react";

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

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [, setTick] = useState(0);

  const getTimeLeft = () => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${hours}h ${mins}m ${secs}s`;
  };

  setTimeout(() => setTick(t => t + 1), 1000);

  return (
    <span className="font-mono text-amber-400" data-testid="text-countdown">
      {getTimeLeft()}
    </span>
  );
}

export default function ShopPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const economyEnabled = useFeatureFlag("economy_enabled");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"packs" | "daily">("packs");

  const { data: catalog = [] } = useQuery<PackCatalogItem[]>({
    queryKey: ["/api/shop/catalog"],
    enabled: economyEnabled,
  });

  const { data: dailyDeal } = useQuery<DailyDeal>({
    queryKey: ["/api/shop/daily-deal"],
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
      queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collection"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop/daily-deal"] });
      navigate(`/pack-opening?data=${encodeURIComponent(JSON.stringify(data))}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Purchase Failed",
        description: error.message.includes("Not enough gold")
          ? "You don't have enough gold. Win matches or complete challenges to earn more!"
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

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl" data-testid="shop-page">
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
          Daily Deal
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
                      disabled={!affordable || purchaseMutation.isPending}
                      onClick={() => purchaseMutation.mutate({ packTypeId: pack.id })}
                      className={affordable
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "bg-slate-700 text-slate-500 cursor-not-allowed"
                      }
                      data-testid={`button-buy-${pack.id}`}
                    >
                      {purchaseMutation.isPending ? "..." : affordable ? "Buy" : "Not enough gold"}
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
                  disabled={!canAfford(dailyDeal.discountedCostGold) || purchaseMutation.isPending}
                  onClick={() => purchaseMutation.mutate({ packTypeId: dailyDeal.packTypeId, useDailyDeal: true })}
                  data-testid="button-buy-daily-deal"
                >
                  {purchaseMutation.isPending
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
    </div>
  );
}
