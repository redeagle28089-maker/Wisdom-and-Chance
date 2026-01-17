import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Trophy, Swords, Target, TrendingUp, BarChart3, PieChart, LogIn, Flame, Droplet, Mountain, Wind, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Game } from "@shared/schema";

const elementIcons = {
  Fire: Flame,
  Water: Droplet,
  Earth: Mountain,
  Air: Wind,
  Nature: Leaf,
};

const elementColors = {
  Fire: "text-red-500",
  Water: "text-blue-500",
  Earth: "text-amber-500",
  Air: "text-cyan-400",
  Nature: "text-green-500",
};

export default function AnalyticsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: games = [], isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ["/api/games"],
    enabled: isAuthenticated,
  });

  if (authLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="animate-pulse text-purple-400">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-purple-500/20 max-w-md">
          <CardContent className="p-8 text-center">
            <LogIn className="w-16 h-16 mx-auto mb-4 text-purple-400" />
            <h2 className="text-2xl font-bold text-white mb-2">Sign In Required</h2>
            <p className="text-purple-200 mb-6">View your game analytics and performance stats</p>
            <Button 
              data-testid="button-login"
              onClick={() => { window.location.href = "/api/login"; }}
            >
              Sign In with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const userGames = games.filter(g => g.player1Id === user?.id || g.player2Id === user?.id);
  const completedGames = userGames.filter(g => g.status === "completed");
  const wins = completedGames.filter(g => g.winnerId === user?.id).length;
  const losses = completedGames.length - wins;
  const winRate = completedGames.length > 0 ? Math.round((wins / completedGames.length) * 100) : 0;

  const elementStats = {
    Fire: { games: 12, wins: 8 },
    Water: { games: 10, wins: 6 },
    Earth: { games: 8, wins: 5 },
    Air: { games: 15, wins: 11 },
    Nature: { games: 5, wins: 3 },
  };

  const recentPerformance = [85, 72, 90, 65, 78, 82, 88];

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4" data-testid="text-analytics-title">
            Analytics Dashboard
          </h1>
          <p className="text-lg text-purple-200">Track your performance and improve your game</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Total Wins</p>
                  <p className="text-2xl font-bold text-white">{wins}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Swords className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Total Losses</p>
                  <p className="text-2xl font-bold text-white">{losses}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Target className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Win Rate</p>
                  <p className="text-2xl font-bold text-white">{winRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Games Played</p>
                  <p className="text-2xl font-bold text-white">{completedGames.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <PieChart className="w-5 h-5 text-purple-400" />
                Element Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(elementStats).map(([element, stats]) => {
                const Icon = elementIcons[element as keyof typeof elementIcons];
                const colorClass = elementColors[element as keyof typeof elementColors];
                const winRate = stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0;
                return (
                  <div key={element} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${colorClass}`} />
                        <span className="text-white font-medium">{element}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-slate-400">{stats.games} games</span>
                        <span className="text-green-400">{winRate}% win</span>
                      </div>
                    </div>
                    <Progress value={winRate} className="h-2" />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                Recent Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between h-40 gap-2">
                {recentPerformance.map((value, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2">
                    <div 
                      className="w-full bg-gradient-to-t from-purple-600 to-purple-400 rounded-t"
                      style={{ height: `${value}%` }}
                    />
                    <span className="text-xs text-slate-400">D{index + 1}</span>
                  </div>
                ))}
              </div>
              <p className="text-center text-slate-400 text-sm mt-4">Last 7 days performance score</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-white text-lg">Best Deck</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center mx-auto mb-3">
                  <Flame className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-white font-bold text-lg">Fire Aggro</h3>
                <p className="text-slate-400 text-sm">75% win rate</p>
                <p className="text-purple-300 text-sm mt-2">12 games played</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-white text-lg">Favorite Commander</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-teal-400 flex items-center justify-center mx-auto mb-3">
                  <Wind className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-white font-bold text-lg">Zephyros the Swift</h3>
                <p className="text-slate-400 text-sm">Air Commander</p>
                <p className="text-purple-300 text-sm mt-2">15 games with this commander</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-white text-lg">Current Streak</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-600 to-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-white font-bold text-3xl">3</h3>
                <p className="text-green-400 font-medium">Win Streak</p>
                <p className="text-slate-400 text-sm mt-2">Best: 7 wins</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
