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
  Wind, Leaf, Star, LogIn, Tag, Package, Gift, AlertTriangle, Check, X,
  CreditCard, DollarSign, Crown, Zap, History, ShieldCheck
} from "lucide-react";

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

interface ShopBundle {
  id: string;
  name: string;
  description: string;
  costGold: number;
  originalCostGold: number;
  packs: { type: string; count: number }[];
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
  isBundle?: boolean;
}

interface PremiumProduct {
  id: string;
  name: string;
  description: string;
  productType: string;
  priceUsd: number;
  priceGold: number;
  priceGems: number;
  gemsAmount: number;
  packsJson: string;
  dustAmount: number;
  isOneTimePurchase: boolean;
  isCurrencyPurchasable: boolean;
  isActive: boolean;
  badgeText: string | null;
  sortOrder: number;
}

interface PaymentConfig {
  paypalClientId: string | null;
  stripePublishableKey: string | null;
  paypalEnabled: boolean;
  stripeEnabled: boolean;
}

interface PremiumConfirmPurchase {
  product: PremiumProduct;
  paymentMethod: "gold" | "gems" | "paypal" | "stripe";
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

const PRODUCT_TYPE_COLORS: Record<string, string> = {
  gems: "from-blue-600/30 to-cyan-600/30 border-blue-500/40",
  pack_bundle: "from-purple-600/30 to-indigo-600/30 border-purple-500/40",
  battle_pass: "from-amber-600/30 to-orange-600/30 border-amber-500/40",
  bundle: "from-emerald-600/30 to-teal-600/30 border-emerald-500/40",
};

const PRODUCT_TYPE_ICONS: Record<string, typeof Gem> = {
  gems: Gem,
  pack_bundle: Package,
  battle_pass: Crown,
  bundle: Gift,
};

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

function PremiumPurchaseDialog({
  purchase,
  currencies,
  paymentConfig,
  isPending,
  onConfirm,
  onCancel,
}: {
  purchase: PremiumConfirmPurchase;
  currencies: Currencies;
  paymentConfig: PaymentConfig | undefined;
  isPending: boolean;
  onConfirm: (method: "gold" | "gems" | "paypal" | "stripe") => void;
  onCancel: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const product = purchase.product;

  const contents: string[] = [];
  if (product.gemsAmount > 0) contents.push(`${product.gemsAmount.toLocaleString()} Gems`);
  if (product.dustAmount > 0) contents.push(`${product.dustAmount.toLocaleString()} Dust`);
  const packs: { type: string; count: number }[] = JSON.parse(product.packsJson || "[]");
  for (const p of packs) {
    contents.push(`${p.count}x ${p.type.charAt(0).toUpperCase() + p.type.slice(1)} Pack${p.count > 1 ? "s" : ""}`);
  }
  if (product.productType === "battle_pass") contents.push("Premium Battle Pass");

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === overlayRef.current && onCancel()}
      data-testid="premium-purchase-dialog"
    >
      <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Purchase {product.name}</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-white" data-testid="button-cancel-premium">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-3 mb-4">
          <p className="text-sm text-slate-300 mb-2">{product.description}</p>
          {contents.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {contents.map((c, i) => (
                <Badge key={i} variant="secondary" className="bg-slate-600/60 text-slate-200 text-xs">{c}</Badge>
              ))}
            </div>
          )}
        </div>

        <p className="text-sm text-slate-400 mb-3">Choose payment method:</p>

        <div className="space-y-2">
          <Button
            onClick={() => onConfirm("stripe")}
            disabled={isPending || !paymentConfig?.stripeEnabled}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold justify-between"
            data-testid="button-pay-stripe"
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              <span>Card / Google Pay</span>
            </div>
            <span>${product.priceUsd}</span>
          </Button>

          <Button
            onClick={() => onConfirm("paypal")}
            disabled={isPending || !paymentConfig?.paypalEnabled}
            className="w-full bg-[#0070ba] hover:bg-[#005ea6] text-white font-semibold justify-between"
            data-testid="button-pay-paypal"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              <span>PayPal</span>
            </div>
            <span>${product.priceUsd}</span>
          </Button>

          {product.isCurrencyPurchasable && product.priceGold > 0 && (
            <Button
              onClick={() => onConfirm("gold")}
              disabled={isPending || (currencies?.gold ?? 0) < product.priceGold}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold justify-between"
              data-testid="button-pay-gold"
            >
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4" />
                <span>Gold</span>
              </div>
              <div className="flex items-center gap-1">
                <span>{product.priceGold.toLocaleString()}</span>
                {(currencies?.gold ?? 0) < product.priceGold && (
                  <span className="text-xs opacity-70">(need {(product.priceGold - (currencies?.gold ?? 0)).toLocaleString()} more)</span>
                )}
              </div>
            </Button>
          )}

          {product.isCurrencyPurchasable && product.priceGems > 0 && (
            <Button
              onClick={() => onConfirm("gems")}
              disabled={isPending || (currencies?.gems ?? 0) < product.priceGems}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold justify-between"
              data-testid="button-pay-gems"
            >
              <div className="flex items-center gap-2">
                <Gem className="w-4 h-4" />
                <span>Gems</span>
              </div>
              <div className="flex items-center gap-1">
                <span>{product.priceGems.toLocaleString()}</span>
                {(currencies?.gems ?? 0) < product.priceGems && (
                  <span className="text-xs opacity-70">(need {(product.priceGems - (currencies?.gems ?? 0)).toLocaleString()} more)</span>
                )}
              </div>
            </Button>
          )}
        </div>

        {!paymentConfig?.stripeEnabled && !paymentConfig?.paypalEnabled && (
          <p className="text-xs text-slate-500 mt-3 text-center">
            Real-money payments are being set up. Use gold or gems in the meantime.
          </p>
        )}

        {isPending && (
          <div className="flex items-center justify-center gap-2 mt-4 text-purple-400">
            <div className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full" />
            <span className="text-sm">Processing...</span>
          </div>
        )}

        <Button
          variant="outline"
          onClick={onCancel}
          className="w-full mt-3 border-slate-600 text-slate-300"
          data-testid="button-cancel-premium-purchase"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default function ShopPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const economyEnabled = useFeatureFlag("economy_enabled");
  const [, navigate] = useLocation();
  const [location] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"packs" | "daily" | "offers" | "premium">("packs");
  const [confirmPurchase, setConfirmPurchase] = useState<ConfirmPurchase | null>(null);
  const [premiumConfirm, setPremiumConfirm] = useState<PremiumConfirmPurchase | null>(null);

  const { data: catalog = [] } = useQuery<PackCatalogItem[]>({
    queryKey: ["/api/shop/catalog"],
    enabled: economyEnabled,
  });

  const { data: dailyDeal } = useQuery<DailyDeal>({
    queryKey: ["/api/shop/daily-deals"],
    enabled: economyEnabled,
  });

  const { data: bundles = [] } = useQuery<ShopBundle[]>({
    queryKey: ["/api/shop/bundles"],
    enabled: economyEnabled,
  });

  const { data: currencies } = useQuery<Currencies>({
    queryKey: ["/api/currencies"],
    enabled: isAuthenticated && economyEnabled,
  });

  const { data: premiumProducts = [] } = useQuery<PremiumProduct[]>({
    queryKey: ["/api/payments/products"],
  });

  const { data: paymentConfig } = useQuery<PaymentConfig>({
    queryKey: ["/api/payments/config"],
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const sessionId = params.get("session_id");
    const productId = params.get("product_id");

    if (payment === "success" && sessionId && productId) {
      apiRequest("GET", `/api/payments/stripe/verify-session?session_id=${sessionId}&product_id=${productId}`)
        .then(r => r.json())
        .then((data) => {
          toast({ title: "Purchase Successful!", description: data.alreadyFulfilled ? "Your purchase was already completed." : "Your items have been added to your account." });
          queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });
          queryClient.invalidateQueries({ queryKey: ["/api/collection"] });
          window.history.replaceState({}, "", "/shop");
        })
        .catch(() => {
          toast({ title: "Verification Issue", description: "Your payment was received but items may take a moment to appear.", variant: "destructive" });
          window.history.replaceState({}, "", "/shop");
        });
    } else if (payment === "cancelled") {
      toast({ title: "Payment Cancelled", description: "Your payment was cancelled. No charges were made." });
      window.history.replaceState({}, "", "/shop");
    }
  }, [location]);

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
    mutationFn: async ({ bundleId }: { bundleId: string }) => {
      const res = await apiRequest("POST", "/api/shop/purchase-bundle", { bundleId });
      return res.json();
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

  const premiumCurrencyMutation = useMutation({
    mutationFn: async ({ productId, currencyType }: { productId: string; currencyType: "gold" | "gems" }) => {
      const res = await apiRequest("POST", "/api/payments/purchase-currency", { productId, currencyType });
      return res.json();
    },
    onSuccess: (data) => {
      setPremiumConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collection"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/products"] });
      toast({ title: "Purchase Successful!", description: "Your items have been added to your account." });
      if (data.cards && data.cards.length > 0) {
        navigate(`/pack-opening?data=${encodeURIComponent(JSON.stringify({ cards: data.cards, packName: "Premium Purchase" }))}`);
      }
    },
    onError: (error: Error) => {
      setPremiumConfirm(null);
      toast({ title: "Purchase Failed", description: error.message, variant: "destructive" });
    },
  });

  const handlePremiumPurchase = async (product: PremiumProduct, method: "gold" | "gems" | "paypal" | "stripe") => {
    if (method === "gold" || method === "gems") {
      premiumCurrencyMutation.mutate({ productId: product.id, currencyType: method });
      return;
    }

    if (method === "paypal") {
      try {
        const res = await apiRequest("POST", "/api/payments/paypal/create-order", { productId: product.id });
        const data = await res.json();
        if (data.orderId) {
          window.open(`https://www.sandbox.paypal.com/checkoutnow?token=${data.orderId}`, "_blank");
          toast({ title: "PayPal Checkout", description: "Complete your payment in the PayPal window. Refresh this page after payment." });
        }
      } catch (error: any) {
        toast({ title: "PayPal Error", description: error.message || "Failed to create PayPal order", variant: "destructive" });
      }
      setPremiumConfirm(null);
      return;
    }

    if (method === "stripe") {
      try {
        const res = await apiRequest("POST", "/api/payments/stripe/create-checkout", { productId: product.id });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        }
      } catch (error: any) {
        toast({ title: "Stripe Error", description: error.message || "Failed to create checkout session", variant: "destructive" });
      }
      setPremiumConfirm(null);
      return;
    }
  };

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

  const handleBuyClick = (packTypeId: string, packName: string, cost: number, useDailyDeal?: boolean, isBundle?: boolean) => {
    setConfirmPurchase({ packTypeId, packName, cost, useDailyDeal, isBundle });
  };

  const handleConfirmPurchase = () => {
    if (!confirmPurchase) return;

    if (confirmPurchase.isBundle) {
      bundlePurchaseMutation.mutate({ bundleId: confirmPurchase.packTypeId });
    } else {
      purchaseMutation.mutate({
        packTypeId: confirmPurchase.packTypeId,
        useDailyDeal: confirmPurchase.useDailyDeal,
      });
    }
  };

  const isPurchasing = purchaseMutation.isPending || bundlePurchaseMutation.isPending;

  const gemProducts = premiumProducts.filter(p => p.productType === "gems");
  const otherProducts = premiumProducts.filter(p => p.productType !== "gems");

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

      {premiumConfirm && currencies && (
        <PremiumPurchaseDialog
          purchase={premiumConfirm}
          currencies={currencies}
          paymentConfig={paymentConfig}
          isPending={premiumCurrencyMutation.isPending}
          onConfirm={(method) => handlePremiumPurchase(premiumConfirm.product, method)}
          onCancel={() => setPremiumConfirm(null)}
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

      <div className="flex gap-2 mb-6 flex-wrap">
        <Button
          variant={activeTab === "premium" ? "default" : "outline"}
          onClick={() => setActiveTab("premium")}
          className={activeTab === "premium" ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white" : "border-slate-600 text-slate-300"}
          data-testid="button-tab-premium"
        >
          <Crown className="w-4 h-4 mr-2" />
          Premium Store
        </Button>
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

      {activeTab === "premium" && (
        <div className="space-y-8" data-testid="premium-store-section">
          {gemProducts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Gem className="w-5 h-5 text-blue-400" />
                <h2 className="text-xl font-bold text-white">Gem Packs</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {gemProducts.map((product) => (
                  <Card
                    key={product.id}
                    className={`bg-gradient-to-br ${PRODUCT_TYPE_COLORS.gems} border hover:border-opacity-60 transition-all hover:scale-[1.02] relative overflow-hidden`}
                    data-testid={`card-premium-${product.id}`}
                  >
                    {product.badgeText && (
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-xs font-bold">
                          {product.badgeText}
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Gem className="w-5 h-5 text-blue-300" />
                        <CardTitle className="text-lg text-white">{product.name}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-300 mb-3 min-h-[40px]">{product.description}</p>
                      <div className="text-center mb-3">
                        <span className="text-3xl font-bold text-blue-300">{product.gemsAmount.toLocaleString()}</span>
                        <span className="text-sm text-slate-400 ml-1">gems</span>
                      </div>
                      <Button
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
                        onClick={() => setPremiumConfirm({ product, paymentMethod: "stripe" })}
                        data-testid={`button-buy-premium-${product.id}`}
                      >
                        <DollarSign className="w-4 h-4 mr-1" />
                        ${product.priceUsd}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {otherProducts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-purple-400" />
                <h2 className="text-xl font-bold text-white">Premium Packs & Bundles</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {otherProducts.map((product) => {
                  const colorClass = PRODUCT_TYPE_COLORS[product.productType] || PRODUCT_TYPE_COLORS.bundle;
                  const Icon = PRODUCT_TYPE_ICONS[product.productType] || Gift;

                  const contents: string[] = [];
                  if (product.gemsAmount > 0) contents.push(`${product.gemsAmount.toLocaleString()} Gems`);
                  if (product.dustAmount > 0) contents.push(`${product.dustAmount.toLocaleString()} Dust`);
                  const packs: { type: string; count: number }[] = JSON.parse(product.packsJson || "[]");
                  for (const p of packs) {
                    contents.push(`${p.count}x ${p.type.charAt(0).toUpperCase() + p.type.slice(1)}`);
                  }

                  return (
                    <Card
                      key={product.id}
                      className={`bg-gradient-to-br ${colorClass} border hover:border-opacity-60 transition-all hover:scale-[1.02] relative overflow-hidden`}
                      data-testid={`card-premium-${product.id}`}
                    >
                      {product.badgeText && (
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-xs font-bold">
                            {product.badgeText}
                          </Badge>
                        </div>
                      )}
                      {product.isOneTimePurchase && (
                        <div className="absolute top-2 left-2">
                          <Badge className="bg-red-600 text-white border-0 text-xs">One-Time Only</Badge>
                        </div>
                      )}
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <Icon className="w-5 h-5 text-white/80" />
                          <CardTitle className="text-lg text-white">{product.name}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-slate-300 mb-3">{product.description}</p>

                        {contents.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {contents.map((c, i) => (
                              <Badge key={i} variant="secondary" className="bg-slate-700/60 text-slate-200 text-xs">{c}</Badge>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-3 mb-3 text-sm">
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5 text-green-400" />
                            <span className="text-green-300 font-bold">${product.priceUsd}</span>
                          </div>
                          {product.isCurrencyPurchasable && product.priceGold > 0 && (
                            <>
                              <span className="text-slate-600">|</span>
                              <div className="flex items-center gap-1">
                                <Coins className="w-3.5 h-3.5 text-amber-400" />
                                <span className="text-amber-300">{product.priceGold.toLocaleString()}</span>
                              </div>
                              <span className="text-slate-600">|</span>
                              <div className="flex items-center gap-1">
                                <Gem className="w-3.5 h-3.5 text-blue-400" />
                                <span className="text-blue-300">{product.priceGems.toLocaleString()}</span>
                              </div>
                            </>
                          )}
                        </div>

                        <Button
                          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
                          onClick={() => setPremiumConfirm({ product, paymentMethod: "stripe" })}
                          data-testid={`button-buy-premium-${product.id}`}
                        >
                          <ShoppingBag className="w-4 h-4 mr-1" />
                          Purchase
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-green-400" />
              <span className="text-sm font-semibold text-slate-300">Secure Payments</span>
            </div>
            <p className="text-xs text-slate-500">
              All payments are processed securely through Stripe (Card/Google Pay) and PayPal. Your financial information is never stored on our servers.
            </p>
          </div>
        </div>
      )}

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
          {bundles.map((offer) => {
            const affordable = canAfford(offer.costGold);
            const savingsPercent = Math.round((1 - offer.costGold / offer.originalCostGold) * 100);

            return (
              <Card
                key={offer.id}
                className="bg-gradient-to-br from-emerald-600/20 to-teal-600/20 border-emerald-500/30 border hover:border-opacity-60 transition-all hover:scale-[1.02] relative overflow-hidden"
                data-testid={`card-offer-${offer.id}`}
              >
                <div className="absolute top-2 right-2">
                  <Badge className="bg-green-600 text-white border-0 text-xs font-bold">
                    SAVE {savingsPercent}%
                  </Badge>
                </div>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Gift className="w-6 h-6 text-white/80" />
                    <CardTitle className="text-lg text-white">{offer.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-300 mb-3">{offer.description}</p>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {offer.packs.map((p: { type: string; count: number }, idx: number) => (
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
                      onClick={() => handleBuyClick(offer.id, offer.name, offer.costGold, false, true)}
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
