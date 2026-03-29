import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureFlag } from "@/lib/config";
import { useLocation } from "wouter";
import {
  Shield, Crown, Gem, Star, Trophy, Calendar, ArrowRight,
  Coins, Package, Sparkles, LogIn, Clock
} from "lucide-react";

interface SeasonInfo {
  id: string;
  name: string;
  seasonNumber: number;
  startsAt: string;
  endsAt: string;
  daysRemaining: number;
  isActive: boolean;
  tiers: readonly { name: string; minRating: number; icon: string }[];
}

interface TierReward {
  name: string;
  minRating: number;
  icon: string;
  rewards: { gold: number; packs: number; dust: number };
}

interface PlayerRank {
  currentRating: number;
  highestRating: number;
  tier: string;
  peakTier: string;
  nextTier: { name: string; ratingNeeded: number } | null;
  seasonRewards: { gold: number; packs: number; dust: number };
}

interface SeasonHistoryEntry {
  id: string;
  seasonId: string;
  peakRating: number;
  finalRating: number;
  tier: string;
  gamesPlayed: number;
  wins: number;
  rewardsClaimed: boolean;
}

const TIER_COLORS: Record<string, string> = {
  Bronze: "from-amber-700/30 to-amber-900/30 border-amber-600/40",
  Silver: "from-slate-300/20 to-slate-500/20 border-slate-400/40",
  Gold: "from-yellow-500/20 to-yellow-700/20 border-yellow-500/40",
  Platinum: "from-cyan-400/20 to-cyan-600/20 border-cyan-400/40",
  Diamond: "from-blue-400/20 to-purple-500/20 border-blue-400/40",
  Master: "from-purple-500/20 to-pink-500/20 border-purple-400/40",
};

const TIER_TEXT_COLORS: Record<string, string> = {
  Bronze: "text-amber-400",
  Silver: "text-slate-300",
  Gold: "text-yellow-400",
  Platinum: "text-cyan-300",
  Diamond: "text-blue-300",
  Master: "text-purple-300",
};

const TIER_ICONS: Record<string, typeof Shield> = {
  shield: Shield,
  crown: Crown,
  gem: Gem,
  star: Star,
};

export default function SeasonPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const rankedEnabled = useFeatureFlag("ranked_seasons");
  const [, navigate] = useLocation();

  const { data: season } = useQuery<SeasonInfo>({
    queryKey: ["/api/season/current"],
    enabled: rankedEnabled,
  });

  const { data: rewardData } = useQuery<{ tiers: TierReward[] }>({
    queryKey: ["/api/season/rewards"],
    enabled: rankedEnabled,
  });

  const { data: playerRank } = useQuery<PlayerRank>({
    queryKey: ["/api/season/player-rank"],
    enabled: isAuthenticated && rankedEnabled,
  });

  const { data: history = [] } = useQuery<SeasonHistoryEntry[]>({
    queryKey: ["/api/season/history"],
    enabled: isAuthenticated && rankedEnabled,
  });

  if (!rankedEnabled) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="season-disabled">
        <Card className="w-96 bg-slate-800/60 border-slate-700">
          <CardContent className="pt-6 text-center">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-slate-500" />
            <p className="text-slate-400">Ranked seasons are not available yet.</p>
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

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl" data-testid="season-page">
      {season && (
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2" data-testid="text-season-name">{season.name}</h1>
          <div className="flex items-center justify-center gap-4 text-slate-400">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>Season {season.seasonNumber}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span data-testid="text-days-remaining">{season.daysRemaining} days remaining</span>
            </div>
          </div>
        </div>
      )}

      {isAuthenticated && playerRank && (
        <Card className={`mb-8 bg-gradient-to-r ${TIER_COLORS[playerRank.tier] || TIER_COLORS.Bronze} border`} data-testid="card-player-rank">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="text-center">
                {(() => {
                  const tierData = season?.tiers.find(t => t.name === playerRank.tier);
                  const TierIcon = TIER_ICONS[tierData?.icon || "shield"] || Shield;
                  return <TierIcon className={`w-16 h-16 ${TIER_TEXT_COLORS[playerRank.tier] || "text-amber-400"}`} />;
                })()}
                <p className={`text-xl font-bold mt-2 ${TIER_TEXT_COLORS[playerRank.tier] || "text-amber-400"}`} data-testid="text-current-tier">
                  {playerRank.tier}
                </p>
              </div>

              <div className="flex-1 text-center md:text-left">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-slate-400">Current Rating</p>
                    <p className="text-2xl font-bold text-white" data-testid="text-current-rating">{playerRank.currentRating}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Peak Rating</p>
                    <p className="text-2xl font-bold text-amber-300" data-testid="text-peak-rating">{playerRank.highestRating}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Peak Tier</p>
                    <p className={`text-lg font-bold ${TIER_TEXT_COLORS[playerRank.peakTier] || "text-white"}`}>{playerRank.peakTier}</p>
                  </div>
                  {playerRank.nextTier && (
                    <div>
                      <p className="text-sm text-slate-400">Next: {playerRank.nextTier.name}</p>
                      <p className="text-lg font-bold text-slate-300">{playerRank.nextTier.ratingNeeded} rating needed</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-600/30">
              <p className="text-sm text-slate-400 mb-2">Season End Rewards (based on peak tier: {playerRank.peakTier})</p>
              <div className="flex gap-4">
                <div className="flex items-center gap-1">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-300">{playerRank.seasonRewards.gold} Gold</span>
                </div>
                <div className="flex items-center gap-1">
                  <Package className="w-4 h-4 text-blue-400" />
                  <span className="text-blue-300">{playerRank.seasonRewards.packs} Packs</span>
                </div>
                <div className="flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-purple-300">{playerRank.seasonRewards.dust} Dust</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isAuthenticated && (
        <Card className="mb-8 bg-slate-800/60 border-slate-700" data-testid="season-login-prompt">
          <CardContent className="pt-6 text-center">
            <LogIn className="w-12 h-12 mx-auto mb-4 text-purple-400" />
            <p className="text-slate-300 mb-2">Sign in to track your ranked progress</p>
            <p className="text-sm text-slate-500">Play ranked matches to climb the ladder and earn season rewards.</p>
          </CardContent>
        </Card>
      )}

      <h2 className="text-xl font-bold text-white mb-4">Season Reward Tiers</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8" data-testid="tier-rewards-grid">
        {rewardData?.tiers.map((tier) => {
          const TierIcon = TIER_ICONS[tier.icon] || Shield;
          const isCurrentTier = playerRank?.peakTier === tier.name;

          return (
            <Card
              key={tier.name}
              className={`bg-gradient-to-br ${TIER_COLORS[tier.name] || TIER_COLORS.Bronze} border ${isCurrentTier ? "ring-2 ring-amber-400/50" : ""}`}
              data-testid={`card-tier-${tier.name.toLowerCase()}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TierIcon className={`w-5 h-5 ${TIER_TEXT_COLORS[tier.name]}`} />
                    <CardTitle className={`text-lg ${TIER_TEXT_COLORS[tier.name]}`}>{tier.name}</CardTitle>
                  </div>
                  {isCurrentTier && (
                    <Badge className="bg-amber-600 text-white text-xs">YOUR TIER</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400">{tier.minRating}+ Rating</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-slate-300">{tier.rewards.gold} Gold</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Package className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-slate-300">{tier.rewards.packs} Pack{tier.rewards.packs !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-slate-300">{tier.rewards.dust} Dust</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {isAuthenticated && (
        <div className="flex gap-4 justify-center">
          <Button
            onClick={() => navigate("/battle-pass")}
            className="bg-purple-600 hover:bg-purple-700"
            data-testid="button-view-battlepass"
          >
            <Star className="w-4 h-4 mr-2" />
            View Battle Pass
          </Button>
          <Button
            onClick={() => navigate("/lobby")}
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
            data-testid="button-play-ranked"
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            Play Ranked
          </Button>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold text-white mb-4">Season History</h2>
          <div className="space-y-3" data-testid="season-history-list">
            {history.map((entry) => (
              <Card key={entry.id} className="bg-slate-800/40 border-slate-700" data-testid={`card-history-${entry.id}`}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={`${TIER_TEXT_COLORS[entry.tier]} bg-transparent border`}>{entry.tier}</Badge>
                    <div>
                      <p className="text-sm text-slate-300">Peak: {entry.peakRating} | Final: {entry.finalRating}</p>
                      <p className="text-xs text-slate-500">{entry.wins}W / {entry.gamesPlayed - entry.wins}L ({entry.gamesPlayed} games)</p>
                    </div>
                  </div>
                  {entry.rewardsClaimed && (
                    <Badge variant="secondary" className="text-xs">Claimed</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
