import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Shield, Presentation, Sparkles, Users, CreditCard, ToggleLeft, ToggleRight, LogIn, CheckCircle } from "lucide-react";

interface GrantResult {
  success: boolean;
  usersUpdated: number;
  cardsGranted: number;
  copiesPerCard: number;
}

interface FeatureFlagData {
  enabled: boolean;
  description: string;
}

export default function AdminPresentationPage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [lastResult, setLastResult] = useState<GrantResult | null>(null);

  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    enabled: isAuthenticated,
  });

  const { data: flags, isLoading: flagsLoading } = useQuery<Record<string, FeatureFlagData>>({
    queryKey: ["/api/admin/feature-flags"],
    enabled: isAuthenticated && adminCheck?.isAdmin === true,
  });

  const presentationModeEnabled = flags?.presentation_mode?.enabled ?? false;

  const toggleModeMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("PATCH", "/api/admin/feature-flags/presentation_mode", { enabled });
      return res.json();
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feature-flags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      toast({
        title: enabled ? "Presentation Mode Enabled" : "Presentation Mode Disabled",
        description: enabled
          ? "New users will automatically receive max copies of all cards on login."
          : "Presentation mode has been turned off.",
      });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to toggle presentation mode", variant: "destructive" });
    },
  });

  const grantAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/grant-all-cards", {});
      return res.json() as Promise<GrantResult>;
    },
    onSuccess: (data) => {
      setLastResult(data);
      toast({
        title: "Cards Granted!",
        description: `Gave ${data.copiesPerCard}× all ${data.cardsGranted} cards to ${data.usersUpdated} accounts.`,
      });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to grant cards", variant: "destructive" });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-6 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-6 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-purple-500/20 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Sign In Required</h2>
            <p className="text-purple-200 mb-6">Admin access only.</p>
            <Button
              className="bg-gradient-to-r from-purple-600 to-pink-600"
              data-testid="button-login"
              onClick={() => { window.location.href = "/api/login"; }}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (adminCheck && !adminCheck.isAdmin) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-6 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-red-500/20 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-purple-200">This page is restricted to administrators.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3" data-testid="text-presentation-title">
            <Presentation className="w-8 h-8 text-yellow-400" />
            Presentation Mode
          </h1>
          <p className="text-purple-200">
            Grant every account max copies of all cards so testers and viewers can build any deck freely.
          </p>
        </div>

        <div className="space-y-6">
          <Card className="bg-slate-800/50 border-yellow-500/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ToggleRight className="w-5 h-5 text-yellow-400" />
                Presentation Mode Toggle
              </CardTitle>
              <CardDescription className="text-purple-300">
                When enabled, every user who signs in will automatically receive 3 copies of every card.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Badge
                  variant={presentationModeEnabled ? "default" : "secondary"}
                  className={presentationModeEnabled ? "bg-yellow-500 text-black" : ""}
                  data-testid="badge-presentation-status"
                >
                  {presentationModeEnabled ? "ON" : "OFF"}
                </Badge>
                <span className="text-purple-200 text-sm">
                  {presentationModeEnabled
                    ? "New sign-ins automatically get max cards"
                    : "Normal collection system active"}
                </span>
              </div>
              <Button
                onClick={() => toggleModeMutation.mutate(!presentationModeEnabled)}
                disabled={flagsLoading || toggleModeMutation.isPending}
                variant={presentationModeEnabled ? "destructive" : "default"}
                className={!presentationModeEnabled ? "bg-yellow-500 hover:bg-yellow-400 text-black" : ""}
                data-testid="button-toggle-presentation-mode"
              >
                {presentationModeEnabled ? (
                  <><ToggleLeft className="w-4 h-4 mr-2" />Turn Off</>
                ) : (
                  <><ToggleRight className="w-4 h-4 mr-2" />Turn On</>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Grant All Cards Now
              </CardTitle>
              <CardDescription className="text-purple-300">
                Immediately give every existing account 3 copies of every card. Use this before your presentation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-slate-900/60 border border-purple-500/20 p-4 text-sm text-purple-200 space-y-1">
                <p className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-purple-400" /> Sets every account's collection to <strong className="text-white">3× all cards</strong></p>
                <p className="flex items-center gap-2"><Users className="w-4 h-4 text-purple-400" /> Applies to <strong className="text-white">all registered users</strong> instantly</p>
                <p className="flex items-center gap-2"><Shield className="w-4 h-4 text-purple-400" /> Safe to run multiple times — won't exceed the 3-copy cap</p>
              </div>

              {lastResult && (
                <div className="rounded-lg bg-green-900/30 border border-green-500/30 p-4 flex items-start gap-3" data-testid="text-grant-result">
                  <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-green-200">
                    <p className="font-semibold text-green-100 mb-1">Done!</p>
                    <p>Granted <strong>{lastResult.copiesPerCard}×</strong> all <strong>{lastResult.cardsGranted} cards</strong> to <strong>{lastResult.usersUpdated} accounts</strong>.</p>
                    <p className="text-green-300 mt-1">Everyone can now build any deck freely.</p>
                  </div>
                </div>
              )}

              <Button
                onClick={() => grantAllMutation.mutate()}
                disabled={grantAllMutation.isPending}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold"
                size="lg"
                data-testid="button-grant-all-cards"
              >
                {grantAllMutation.isPending ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Granting Cards...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />Grant All Cards to All Accounts</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
