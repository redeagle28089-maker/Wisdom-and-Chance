import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureFlag } from "@/lib/config";
import { useToast } from "@/hooks/use-toast";
import {
  Star, Coins, Gem, Sparkles, Package, Gift, Lock, Check,
  Calendar, Clock, LogIn, ChevronRight, Zap, Trophy, Swords, Crown
} from "lucide-react";

interface BattlePassData {
  season: {
    id: string;
    name: string;
    endsAt: string;
    daysRemaining: number;
  } | null;
  progress: {
    currentXp: number;
    currentLevel: number;
    xpIntoCurrentLevel: number;
    xpForNextLevel: number;
    claimedLevels: number[];
    premiumUnlocked: boolean;
  } | null;
  levels: {
    level: number;
    xpRequired: number;
    rewardType: string;
    rewardAmount: number;
    rewardDescription: string;
    isPremium: boolean;
    claimed: boolean;
    unlocked: boolean;
  }[];
}

interface WeeklyChallenge {
  id: string;
  challengeType: string;
  description: string;
  requirement: number;
  xpReward: number;
  goldReward: number;
  weekNumber: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  activeUntil: string;
}

const REWARD_ICONS: Record<string, typeof Coins> = {
  gold: Coins,
  gems: Gem,
  dust: Sparkles,
  pack: Package,
};

const REWARD_COLORS: Record<string, string> = {
  gold: "text-amber-400",
  gems: "text-cyan-400",
  dust: "text-purple-400",
  pack: "text-blue-400",
};

const REWARD_BG: Record<string, string> = {
  gold: "from-amber-600/20 to-amber-800/20 border-amber-500/30",
  gems: "from-cyan-600/20 to-cyan-800/20 border-cyan-500/30",
  dust: "from-purple-600/20 to-purple-800/20 border-purple-500/30",
  pack: "from-blue-600/20 to-blue-800/20 border-blue-500/30",
};

const CHALLENGE_ICONS: Record<string, typeof Swords> = {
  win_games: Trophy,
  play_element: Zap,
  deal_damage: Swords,
};

export default function BattlePassPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const battlePassEnabled = useFeatureFlag("battle_pass");
  const weeklyChallengesEnabled = useFeatureFlag("weekly_challenges");
  const { toast } = useToast();

  const { data: bpData, isLoading: bpLoading } = useQuery<BattlePassData>({
    queryKey: ["/api/battlepass"],
    enabled: isAuthenticated && battlePassEnabled,
  });

  const { data: weeklyChallenges = [] } = useQuery<WeeklyChallenge[]>({
    queryKey: ["/api/weekly-challenges"],
    enabled: isAuthenticated && weeklyChallengesEnabled,
  });

  const claimMutation = useMutation({
    mutationFn: async (level: number) => {
      const res = await apiRequest("POST", "/api/battlepass/claim", { level });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/battlepass"] });
      queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });
      toast({
        title: "Reward Claimed!",
        description: `${data.rewardDescription}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Claim Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const claimWeeklyMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      const res = await apiRequest("POST", `/api/weekly-challenges/${challengeId}/claim`, {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/battlepass"] });
      queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });
      toast({
        title: "Challenge Reward Claimed!",
        description: `+${data.goldReward} Gold, +${data.xpReward} Battle Pass XP`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Claim Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!battlePassEnabled) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="battlepass-disabled">
        <Card className="w-96 bg-slate-800/60 border-slate-700">
          <CardContent className="pt-6 text-center">
            <Star className="w-12 h-12 mx-auto mb-4 text-slate-500" />
            <p className="text-slate-400">The Battle Pass is not available yet.</p>
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
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="battlepass-login-prompt">
        <Card className="w-96 bg-slate-800/60 border-slate-700">
          <CardContent className="pt-6 text-center">
            <LogIn className="w-12 h-12 mx-auto mb-4 text-purple-400" />
            <p className="text-slate-300 mb-2">Sign in to view your Battle Pass</p>
            <p className="text-sm text-slate-500">Earn XP from matches and challenges to unlock rewards.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (bpLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const season = bpData?.season;
  const progress = bpData?.progress;
  const levels = bpData?.levels ?? [];

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl" data-testid="battlepass-page">
      {season && (
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2" data-testid="text-bp-season-name">
            <Star className="w-7 h-7 inline-block mr-2 text-amber-400" />
            Battle Pass — {season.name}
          </h1>
          <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
            <Clock className="w-4 h-4" />
            <span>{season.daysRemaining} days remaining</span>
          </div>
        </div>
      )}

      {progress && (
        <Card className="mb-6 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-purple-500/30" data-testid="card-bp-progress">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="text-center sm:text-left">
                <p className="text-4xl font-bold text-white" data-testid="text-bp-level">Level {progress.currentLevel}</p>
                <p className="text-sm text-slate-400">Total XP: {progress.currentXp.toLocaleString()}</p>
              </div>
              <div className="flex-1 w-full">
                {progress.xpForNextLevel > 0 ? (
                  <>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Level {progress.currentLevel + 1}</span>
                      <span>{progress.xpIntoCurrentLevel} / {progress.xpForNextLevel} XP</span>
                    </div>
                    <Progress
                      value={Math.min(100, (progress.xpIntoCurrentLevel / progress.xpForNextLevel) * 100)}
                      className="h-3 bg-slate-700"
                      data-testid="progress-bp-xp"
                    />
                  </>
                ) : (
                  <div className="text-center">
                    <Badge className="bg-amber-600 text-white">MAX LEVEL REACHED</Badge>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs text-slate-400">
              <div className="bg-slate-800/40 rounded p-2">
                <Swords className="w-4 h-4 mx-auto mb-1 text-green-400" />
                <p>Win: +100 XP</p>
              </div>
              <div className="bg-slate-800/40 rounded p-2">
                <Calendar className="w-4 h-4 mx-auto mb-1 text-blue-400" />
                <p>Daily: +150 XP</p>
              </div>
              <div className="bg-slate-800/40 rounded p-2">
                <Trophy className="w-4 h-4 mx-auto mb-1 text-purple-400" />
                <p>Weekly: +300 XP</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {weeklyChallenges.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            Weekly Challenges
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3" data-testid="weekly-challenges-grid">
            {weeklyChallenges.map((challenge) => {
              const ChallengeIcon = CHALLENGE_ICONS[challenge.challengeType] || Zap;
              const progressPercent = Math.min(100, (challenge.progress / challenge.requirement) * 100);

              return (
                <Card
                  key={challenge.id}
                  className={`bg-slate-800/40 border-slate-700 ${challenge.completed ? "border-green-500/30" : ""}`}
                  data-testid={`card-weekly-${challenge.id}`}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-2 mb-2">
                      <ChallengeIcon className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-white font-medium">{challenge.description}</p>
                        <p className="text-xs text-slate-500">Week {challenge.weekNumber}</p>
                      </div>
                    </div>

                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>{challenge.progress} / {challenge.requirement}</span>
                        <span>{Math.round(progressPercent)}%</span>
                      </div>
                      <Progress value={progressPercent} className="h-2 bg-slate-700" />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex gap-2 text-xs text-slate-400">
                        <span className="flex items-center gap-0.5">
                          <Coins className="w-3 h-3 text-amber-400" />{challenge.goldReward}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 text-purple-400" />{challenge.xpReward} XP
                        </span>
                      </div>
                      {challenge.claimed ? (
                        <Badge variant="secondary" className="text-xs"><Check className="w-3 h-3 mr-1" />Claimed</Badge>
                      ) : challenge.completed ? (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-xs h-7"
                          onClick={() => claimWeeklyMutation.mutate(challenge.id)}
                          disabled={claimWeeklyMutation.isPending}
                          data-testid={`button-claim-weekly-${challenge.id}`}
                        >
                          <Gift className="w-3 h-3 mr-1" />Claim
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-xs text-slate-500">In Progress</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
        <Star className="w-5 h-5 text-amber-400" />
        Reward Track
      </h2>
      <div className="space-y-2" data-testid="bp-levels-list">
        {levels.map((level) => {
          const RewardIcon = REWARD_ICONS[level.rewardType] || Gift;
          const rewardColor = REWARD_COLORS[level.rewardType] || "text-slate-300";
          const bgClass = REWARD_BG[level.rewardType] || "from-slate-600/20 to-slate-800/20 border-slate-500/30";
          const isMilestone = level.level % 10 === 0;
          const premiumLocked = level.isPremium && !progress?.premiumUnlocked;

          return (
            <Card
              key={level.level}
              className={`bg-gradient-to-r ${level.isPremium ? "from-amber-600/10 to-yellow-600/10 border-amber-500/30" : bgClass} border ${isMilestone ? "ring-1 ring-amber-400/30" : ""} ${!level.unlocked || premiumLocked ? "opacity-60" : ""}`}
              data-testid={`card-bp-level-${level.level}`}
            >
              <CardContent className="py-3 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${level.unlocked && !premiumLocked ? "bg-purple-600 text-white" : "bg-slate-700 text-slate-400"}`}>
                  {level.level}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <RewardIcon className={`w-4 h-4 ${rewardColor} shrink-0`} />
                    <span className={`text-sm font-medium ${premiumLocked ? "text-slate-500" : rewardColor}`}>{level.rewardDescription}</span>
                    {isMilestone && <Badge className="bg-amber-600/60 text-amber-200 text-xs border-0">MILESTONE</Badge>}
                    {level.isPremium && (
                      <Badge className={progress?.premiumUnlocked ? "bg-amber-600/40 text-amber-200 text-xs border-0" : "bg-slate-700 text-slate-400 text-xs border-0"}>
                        <Crown className="w-3 h-3 mr-1" />Premium
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{level.xpRequired} XP required</p>
                </div>

                <div className="shrink-0">
                  {level.claimed ? (
                    <Badge variant="secondary" className="text-xs"><Check className="w-3 h-3 mr-1" />Claimed</Badge>
                  ) : premiumLocked ? (
                    <Badge className="bg-amber-700/40 text-amber-400 text-xs border-0">
                      <Lock className="w-3 h-3 mr-1" />Premium
                    </Badge>
                  ) : level.unlocked ? (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-xs h-7"
                      onClick={() => claimMutation.mutate(level.level)}
                      disabled={claimMutation.isPending}
                      data-testid={`button-claim-bp-${level.level}`}
                    >
                      <Gift className="w-3 h-3 mr-1" />Claim
                    </Button>
                  ) : (
                    <Lock className="w-4 h-4 text-slate-600" />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
