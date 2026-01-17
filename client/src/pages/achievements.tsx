import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { Trophy, Star, Swords, Users, Sparkles, Lock, LogIn, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string | null;
  requirement: number;
  xpReward: number | null;
  isSecret: boolean | null;
}

interface PlayerAchievement {
  id: string;
  achievementId: string;
  progress: number | null;
  unlockedAt: string | null;
}

interface AchievementWithProgress extends Achievement {
  progress: number;
  unlocked: boolean;
}

const categoryIcons: Record<string, typeof Trophy> = {
  wins: Trophy,
  games: Swords,
  collection: Star,
  social: Users,
  special: Sparkles,
};

const categoryColors: Record<string, string> = {
  wins: "from-yellow-600 to-amber-600",
  games: "from-blue-600 to-cyan-600",
  collection: "from-purple-600 to-pink-600",
  social: "from-green-600 to-emerald-600",
  special: "from-red-600 to-orange-600",
};

function AchievementCard({ achievement }: { achievement: AchievementWithProgress }) {
  const Icon = categoryIcons[achievement.category] || Trophy;
  const colorClass = categoryColors[achievement.category] || "from-gray-600 to-slate-600";
  const progressPercent = Math.min(100, (achievement.progress / achievement.requirement) * 100);

  if (achievement.isSecret && !achievement.unlocked && achievement.progress === 0) {
    return (
      <div className="relative p-4 rounded-lg bg-slate-900/50 border border-purple-500/20 opacity-60">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-lg bg-slate-800 flex items-center justify-center">
            <Lock className="w-6 h-6 text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold">Secret Achievement</h3>
            <p className="text-purple-300 text-sm">Keep playing to unlock this mystery...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative p-4 rounded-lg border transition-all ${
        achievement.unlocked
          ? "bg-gradient-to-br " + colorClass + " border-yellow-500/50 shadow-lg"
          : "bg-slate-900/50 border-purple-500/20"
      }`}
      data-testid={`achievement-${achievement.id}`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-14 h-14 rounded-lg flex items-center justify-center ${
            achievement.unlocked ? "bg-white/20" : "bg-slate-800"
          }`}
        >
          <Icon className={`w-7 h-7 ${achievement.unlocked ? "text-white" : "text-purple-400"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-bold truncate">{achievement.name}</h3>
            {achievement.unlocked && (
              <Badge className="bg-yellow-500/90 text-black text-xs">Unlocked</Badge>
            )}
          </div>
          <p className={`text-sm ${achievement.unlocked ? "text-white/80" : "text-purple-300"}`}>
            {achievement.description}
          </p>
          {!achievement.unlocked && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-purple-400 mb-1">
                <span>Progress</span>
                <span>{achievement.progress}/{achievement.requirement}</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          )}
        </div>
        <div className="text-right">
          <div className={`text-sm font-bold ${achievement.unlocked ? "text-yellow-300" : "text-purple-400"}`}>
            +{achievement.xpReward || 0} XP
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AchievementsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: achievements = [], isLoading: achievementsLoading } = useQuery<Achievement[]>({
    queryKey: ["/api/achievements"],
    enabled: isAuthenticated,
  });

  const { data: playerAchievements = [] } = useQuery<PlayerAchievement[]>({
    queryKey: ["/api/player-achievements"],
    enabled: isAuthenticated,
  });

  const achievementsWithProgress: AchievementWithProgress[] = achievements.map((achievement) => {
    const playerAch = playerAchievements.find((pa) => pa.achievementId === achievement.id);
    return {
      ...achievement,
      progress: playerAch?.progress || 0,
      unlocked: !!playerAch?.unlockedAt,
    };
  });

  const categories = ["wins", "games", "collection", "social", "special"];
  const totalUnlocked = achievementsWithProgress.filter((a) => a.unlocked).length;
  const totalXP = achievementsWithProgress
    .filter((a) => a.unlocked)
    .reduce((sum, a) => sum + (a.xpReward || 0), 0);

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
            <div className="w-20 h-20 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Sign In to View Achievements</h2>
            <p className="text-purple-200 mb-6">Track your progress and unlock rewards!</p>
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
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4" data-testid="text-achievements-title">
            Achievements
          </h1>
          <p className="text-lg text-purple-200">Track your progress and earn rewards</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-yellow-600 to-amber-600 border-yellow-500/50">
            <CardContent className="p-6 text-center">
              <Trophy className="w-10 h-10 text-white mx-auto mb-2" />
              <div className="text-3xl font-bold text-white">{totalUnlocked}</div>
              <div className="text-white/80 text-sm">Achievements Unlocked</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-600 to-pink-600 border-purple-500/50">
            <CardContent className="p-6 text-center">
              <Star className="w-10 h-10 text-white mx-auto mb-2" />
              <div className="text-3xl font-bold text-white">{totalXP}</div>
              <div className="text-white/80 text-sm">Total XP Earned</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-600 to-cyan-600 border-blue-500/50">
            <CardContent className="p-6 text-center">
              <Crown className="w-10 h-10 text-white mx-auto mb-2" />
              <div className="text-3xl font-bold text-white">
                {achievements.length > 0 ? Math.round((totalUnlocked / achievements.length) * 100) : 0}%
              </div>
              <div className="text-white/80 text-sm">Completion Rate</div>
            </CardContent>
          </Card>
        </div>

        {achievementsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            {categories.map((category) => {
              const categoryAchievements = achievementsWithProgress.filter((a) => a.category === category);
              if (categoryAchievements.length === 0) return null;
              
              const Icon = categoryIcons[category] || Trophy;
              const unlockedInCategory = categoryAchievements.filter((a) => a.unlocked).length;

              return (
                <div key={category}>
                  <div className="flex items-center gap-3 mb-4">
                    <Icon className="w-6 h-6 text-purple-400" />
                    <h2 className="text-xl font-bold text-white capitalize">{category}</h2>
                    <Badge variant="secondary" className="bg-purple-500/20 text-purple-300">
                      {unlockedInCategory}/{categoryAchievements.length}
                    </Badge>
                  </div>
                  <div className="grid gap-3">
                    {categoryAchievements.map((achievement) => (
                      <AchievementCard key={achievement.id} achievement={achievement} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
