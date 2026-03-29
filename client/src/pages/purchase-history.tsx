import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { History, LogIn, Package, Gem, Coins, CreditCard, DollarSign, Crown, Gift } from "lucide-react";

interface Transaction {
  id: string;
  productId: string;
  paymentMethod: string;
  amountUsd: number;
  currencySpent: number;
  status: string;
  createdAt: string;
  productName: string | null;
  productType: string | null;
}

const PAYMENT_METHOD_LABELS: Record<string, { label: string; icon: typeof CreditCard; color: string }> = {
  stripe: { label: "Card", icon: CreditCard, color: "text-blue-400" },
  paypal: { label: "PayPal", icon: DollarSign, color: "text-yellow-400" },
  gold: { label: "Gold", icon: Coins, color: "text-amber-400" },
  gems: { label: "Gems", icon: Gem, color: "text-blue-300" },
};

const PRODUCT_TYPE_ICONS: Record<string, typeof Gem> = {
  gems: Gem,
  pack_bundle: Package,
  battle_pass: Crown,
  bundle: Gift,
};

export default function PurchaseHistoryPage() {
  const { isAuthenticated, isLoading } = useAuth();

  const { data: history = [], isLoading: historyLoading, isError } = useQuery<Transaction[]>({
    queryKey: ["/api/payments/history"],
    enabled: isAuthenticated,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="history-login-prompt">
        <Card className="w-96 bg-slate-800/60 border-slate-700">
          <CardContent className="pt-6 text-center">
            <LogIn className="w-12 h-12 mx-auto mb-4 text-purple-400" />
            <p className="text-slate-300">Sign in to view purchase history</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl" data-testid="purchase-history-page">
      <div className="flex items-center gap-3 mb-6">
        <History className="w-7 h-7 text-purple-400" />
        <h1 className="text-2xl font-bold text-white">Purchase History</h1>
      </div>

      {historyLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
        </div>
      ) : isError ? (
        <Card className="bg-slate-800/60 border-red-700/50">
          <CardContent className="pt-6 text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <p className="text-red-300 font-semibold">Failed to load purchase history</p>
            <p className="text-sm text-slate-500 mt-1">Please try again later.</p>
          </CardContent>
        </Card>
      ) : history.length === 0 ? (
        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="pt-6 text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-slate-500" />
            <p className="text-slate-400">No purchases yet.</p>
            <p className="text-sm text-slate-500 mt-1">Your transaction history will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {history.map((txn) => {
            const method = PAYMENT_METHOD_LABELS[txn.paymentMethod] || PAYMENT_METHOD_LABELS.stripe;
            const Icon = method.icon;
            const ProductIcon = PRODUCT_TYPE_ICONS[txn.productType || "bundle"] || Package;
            const date = new Date(txn.createdAt);
            const formattedDate = date.toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            });
            const formattedTime = date.toLocaleTimeString("en-US", {
              hour: "2-digit", minute: "2-digit",
            });

            return (
              <Card
                key={txn.id}
                className="bg-slate-800/60 border-slate-700 hover:border-slate-600 transition-colors"
                data-testid={`card-transaction-${txn.id}`}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-700/60 flex items-center justify-center">
                        <ProductIcon className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-white" data-testid={`text-txn-name-${txn.id}`}>
                          {txn.productName || txn.productId}
                        </p>
                        <p className="text-xs text-slate-500">{formattedDate} at {formattedTime}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`w-4 h-4 ${method.color}`} />
                        <span className="text-sm text-slate-300">{method.label}</span>
                      </div>

                      {txn.amountUsd > 0 ? (
                        <Badge className="bg-green-600/20 text-green-300 border-green-500/30">
                          ${txn.amountUsd}
                        </Badge>
                      ) : (
                        <Badge className={txn.paymentMethod === "gems" ? "bg-blue-600/20 text-blue-300 border-blue-500/30" : "bg-amber-600/20 text-amber-300 border-amber-500/30"}>
                          {txn.currencySpent.toLocaleString()} {txn.paymentMethod === "gems" ? "Gems" : "Gold"}
                        </Badge>
                      )}

                      <Badge
                        className={txn.status === "completed" ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/30" : "bg-slate-600/20 text-slate-300 border-slate-500/30"}
                        data-testid={`badge-status-${txn.id}`}
                      >
                        {txn.status}
                      </Badge>
                    </div>
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
