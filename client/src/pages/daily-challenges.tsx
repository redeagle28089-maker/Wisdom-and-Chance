import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar, Gift, Flame, Droplet, Mountain, Wind, Leaf, 
  Swords, Crown, Zap, LogIn, Check, Clock 
} from "lucide-react";

interface DailyChallenge {
  id: string;
  name: string;
  description: string;
  challengeType: string;
  requirement: number;
  elementFilter: string | null;
  xpReward: number | null;
}

interface PlayerChallenge {
  id: string;
  challengeId: string;
  progress: number | null;
  completedAt: string | null;
  claimedAt: string | null;
}

interface ChallengeWithProgress extends DailyChallenge {
  progress: number;
  completed: boolean;
  claimed: boolean;
}

const elementIcons: Record<string, typeof Flame> = {
  Fire: Flame,
  Water: Droplet,
  Earth: Mountain,
  Air: Wind,
  Nature: Leaf,
};

const challengeTypeIcons: Record<string, typeof Swords> = {
  win_games: Swords,
  play_element: Zap,
  deal_damage: Flame,
  use_commander: Crown,
  play_cards: Gift,
};

function ChallengeCard({ challenge, onClaim }: { challenge: ChallengeWithProgress; onClaim: () => void }) {
  const progressPercent = Math.min(100, (challenge.progress / challenge.requirement) * 100);
  const TypeIcon = challengeTypeIcons[challenge.challengeType] || Swords;
  const ElementIcon = challenge.elementFilter ? elementIcons[challenge.elementFilter] : null;

  return (
    <div
      className={`relative p-5 rounded-lg border transition-all ${
        challenge.claimed
          ? "bg-slate-900/30 border-purple-500/10 opacity-60"
          : challenge.completed
          ? "bg-gradient-to-br from-green-900/50 to-emerald-900/50 border-green-500/50"
          : "bg-slate-900/50 border-purple-500/20"
      }`}
      data-testid={`challenge-${challenge.id}`}
    >
      {challenge.claimed && (
        <div className="absolute top-3 right-3">
          <Badge className="bg-green-600/80 text-white">
            <Check className="w-3 h-3 mr-1" />
            Claimed
          </Badge>
        </div>
      )}

      <div className="flex items-start gap-4">
        <div
          className={`w-14 h-14 rounded-lg flex items-center justify-center ${
            challenge.completed ? "bg-green-600/30" : "bg-purple-600/20"
          }`}
        >
          <TypeIcon className={`w-7 h-7 ${challenge.completed ? "text-green-400" : "text-purple-400"}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-white font-bold">{challenge.name}</h3>
            {ElementIcon && (
              <ElementIcon className="w-4 h-4 text-purple-400" />
            )}
          </div>
          <p className="text-purple-300 text-sm mb-3">{challenge.description}</p>
          
          {!challenge.claimed && (
            <>
              <div className="flex justify-between text-xs text-purple-400 mb-1">
                <span>Progress</span>
                <span>{challenge.progress}/{challenge.requirement}</span>
              </div>
              <Progress value={progressPercent} className="h-2 mb-3" />
            </>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-yellow-400">
              <Gift className="w-4 h-4" />
              <span className="font-bold">+{challenge.xpReward || 50} XP</span>
            </div>
            
            {challenge.completed && !challenge.claimed && (
              <Button 
                size="sm" 
                onClick={onClaim}
                className="bg-gradient-to-r from-green-600 to-emerald-600"
                data-testid={`claim-${challenge.id}`}
              >
                <Gift className="w-4 h-4 mr-1" />
                Claim Reward
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DailyChallengesPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: challenges = [], isLoading: challengesLoading } = useQuery<DailyChallenge[]>({
    queryKey: ["/api/daily-challenges"],
    enabled: isAuthenticated,
  });

  const { data: playerChallenges = [] } = useQuery<PlayerChallenge[]>({
    queryKey: ["/api/player-challenges"],
    enabled: isAuthenticated,
  });

  const claimMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      const res = await apiRequest("POST", `/api/player-challenges/${challengeId}/claim`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/player-challenges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/player-stats"] });
      toast({ title: "Reward claimed!" });
    },
    onError: () => {
      toast({ title: "Failed to claim reward", variant: "destructive" });
    },
  });

  const challengesWithProgress: ChallengeWithProgress[] = challenges.map((challenge) => {
    const playerCh = playerChallenges.find((pc) => pc.challengeId === challenge.id);
    return {
      ...challenge,
      progress: playerCh?.progress || 0,
      completed: !!playerCh?.completedAt,
      claimed: !!playerCh?.claimedAt,
    };
  });

  const completedCount = challengesWithProgress.filter((c) => c.completed).length;
  const claimedCount = challengesWithProgress.filter((c) => c.claimed).length;
  const totalXP = challengesWithProgress
    .filter((c) => c.claimed)
    .reduce((sum, c) => sum + (c.xpReward || 50), 0);

  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const hoursRemaining = Math.floor((endOfDay.getTime() - now.getTime()) / (1000 * 60 * 60));
  const minutesRemaining = Math.floor(((endOfDay.getTime() - now.getTime()) % (1000 * 60 * 60)) / (1000 * 60));

  if (authLoading) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-purple-200">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-purple-500/20 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Calendar className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Sign In for Daily Challenges</h2>
            <p className="text-purple-200 mb-6">Complete daily quests and earn XP rewards!</p>
            <Button 
              className="bg-gradient-to-r from-purple-600 to-pink-600" 
              data-testid="button-login"
              onClick={() => { window.location.href = "/api/login"; }}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4" data-testid="text-challenges-title">
            Daily Challenges
          </h1>
          <p className="text-lg text-purple-200">Complete challenges to earn XP rewards</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-orange-600 to-red-600 border-orange-500/50">
            <CardContent className="p-6 text-center">
              <Clock className="w-8 h-8 text-white mx-auto mb-2" />
              <div className="text-xl font-bold text-white">{hoursRemaining}h {minutesRemaining}m</div>
              <div className="text-white/80 text-sm">Time Remaining</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-600 to-emerald-600 border-green-500/50">
            <CardContent className="p-6 text-center">
              <Check className="w-8 h-8 text-white mx-auto mb-2" />
              <div className="text-xl font-bold text-white">{completedCount}/{challenges.length}</div>
              <div className="text-white/80 text-sm">Completed</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-600 to-amber-600 border-yellow-500/50">
            <CardContent className="p-6 text-center">
              <Gift className="w-8 h-8 text-white mx-auto mb-2" />
              <div className="text-xl font-bold text-white">{totalXP} XP</div>
              <div className="text-white/80 text-sm">Earned Today</div>
            </CardContent>
          </Card>
        </div>

        {challengesLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : challengesWithProgress.length === 0 ? (
          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardContent className="p-12 text-center">
              <Calendar className="w-16 h-16 text-purple-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">No Challenges Today</h2>
              <p className="text-purple-200">Check back tomorrow for new daily challenges!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {challengesWithProgress.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                onClaim={() => claimMutation.mutate(challenge.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
