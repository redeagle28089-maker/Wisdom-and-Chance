import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal, Crown, TrendingUp, Flame, Star, Swords } from "lucide-react";

interface LeaderboardEntry {
  id: string;
  rank: number;
  userId: string;
  displayName: string;
  profileImageUrl: string | null;
  rating: number;
  wins: number;
  losses: number;
  winRate: number;
  streak: number;
  tier: string;
}

const tierConfig: Record<string, { color: string; bgColor: string; icon: typeof Trophy }> = {
  Bronze: { color: "text-amber-600", bgColor: "bg-amber-600/20", icon: Medal },
  Silver: { color: "text-gray-300", bgColor: "bg-gray-400/20", icon: Medal },
  Gold: { color: "text-yellow-400", bgColor: "bg-yellow-500/20", icon: Trophy },
  Platinum: { color: "text-cyan-300", bgColor: "bg-cyan-400/20", icon: Crown },
  Diamond: { color: "text-purple-300", bgColor: "bg-purple-400/20", icon: Crown },
  Master: { color: "text-red-400", bgColor: "bg-red-500/20", icon: Flame },
};

function getTier(rating: number): string {
  if (rating < 800) return "Bronze";
  if (rating < 1000) return "Silver";
  if (rating < 1200) return "Gold";
  if (rating < 1400) return "Platinum";
  if (rating < 1600) return "Diamond";
  return "Master";
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-lg">
        <Crown className="w-5 h-5 text-white" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center shadow-lg">
        <Medal className="w-5 h-5 text-white" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg">
        <Medal className="w-5 h-5 text-white" />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
      <span className="text-white font-bold">{rank}</span>
    </div>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const tier = getTier(entry.rating);
  const tierInfo = tierConfig[tier];
  const TierIcon = tierInfo?.icon || Medal;

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-lg border transition-all hover-elevate ${
        entry.rank <= 3
          ? "bg-gradient-to-r from-slate-800/80 to-slate-900/80 border-yellow-500/30"
          : "bg-slate-900/50 border-purple-500/20"
      }`}
      data-testid={`leaderboard-row-${entry.rank}`}
    >
      <RankBadge rank={entry.rank} />
      
      <Avatar className="w-12 h-12 border-2 border-purple-500/30">
        <AvatarImage src={entry.profileImageUrl || undefined} />
        <AvatarFallback className="bg-purple-600 text-white">
          {entry.displayName?.charAt(0)?.toUpperCase() || "?"}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold truncate">{entry.displayName}</span>
          <Badge className={`${tierInfo?.bgColor} ${tierInfo?.color} text-xs`}>
            <TierIcon className="w-3 h-3 mr-1" />
            {tier}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-sm text-purple-300">
          <span className="flex items-center gap-1">
            <Swords className="w-3 h-3" />
            {entry.wins}W / {entry.losses}L
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {entry.winRate.toFixed(1)}%
          </span>
          {entry.streak > 0 && (
            <span className="flex items-center gap-1 text-orange-400">
              <Flame className="w-3 h-3" />
              {entry.streak} streak
            </span>
          )}
        </div>
      </div>

      <div className="text-right">
        <div className="text-2xl font-bold text-white">{entry.rating}</div>
        <div className="text-xs text-purple-400">Rating</div>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const { data: leaderboard = [], isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard"],
  });

  const topPlayers = leaderboard.slice(0, 3);
  const restPlayers = leaderboard.slice(3);

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4" data-testid="text-leaderboard-title">
            Leaderboard
          </h1>
          <p className="text-lg text-purple-200">Top players ranked by rating</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : leaderboard.length === 0 ? (
          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardContent className="p-12 text-center">
              <Trophy className="w-16 h-16 text-purple-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">No Rankings Yet</h2>
              <p className="text-purple-200">Play ranked matches to appear on the leaderboard!</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {topPlayers.length > 0 && (
              <div className="grid md:grid-cols-3 gap-4 mb-8">
                {topPlayers[1] && (
                  <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-gray-500/50 order-1 md:order-first">
                    <CardContent className="p-6 text-center">
                      <div className="relative inline-block mb-3">
                        <Avatar className="w-20 h-20 border-4 border-gray-400">
                          <AvatarImage src={topPlayers[1].profileImageUrl || undefined} />
                          <AvatarFallback className="bg-gray-600 text-white text-2xl">
                            {topPlayers[1].displayName?.charAt(0)?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                          2
                        </div>
                      </div>
                      <h3 className="text-white font-bold truncate">{topPlayers[1].displayName}</h3>
                      <div className="text-2xl font-bold text-gray-300 mt-1">{topPlayers[1].rating}</div>
                      <Badge className="mt-2 bg-gray-500/30 text-gray-300">Silver</Badge>
                    </CardContent>
                  </Card>
                )}
                
                {topPlayers[0] && (
                  <Card className="bg-gradient-to-br from-yellow-600 to-amber-700 border-yellow-500/50 order-first md:order-1 transform md:scale-110 z-10">
                    <CardContent className="p-6 text-center">
                      <Crown className="w-8 h-8 text-yellow-300 mx-auto mb-2" />
                      <div className="relative inline-block mb-3">
                        <Avatar className="w-24 h-24 border-4 border-yellow-400">
                          <AvatarImage src={topPlayers[0].profileImageUrl || undefined} />
                          <AvatarFallback className="bg-yellow-600 text-white text-2xl">
                            {topPlayers[0].displayName?.charAt(0)?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-yellow-900 font-bold shadow-lg">
                          1
                        </div>
                      </div>
                      <h3 className="text-white font-bold text-lg truncate">{topPlayers[0].displayName}</h3>
                      <div className="text-3xl font-bold text-white mt-1">{topPlayers[0].rating}</div>
                      <Badge className="mt-2 bg-yellow-400/30 text-yellow-200">Champion</Badge>
                    </CardContent>
                  </Card>
                )}
                
                {topPlayers[2] && (
                  <Card className="bg-gradient-to-br from-amber-700 to-amber-800 border-amber-600/50 order-2">
                    <CardContent className="p-6 text-center">
                      <div className="relative inline-block mb-3">
                        <Avatar className="w-20 h-20 border-4 border-amber-500">
                          <AvatarImage src={topPlayers[2].profileImageUrl || undefined} />
                          <AvatarFallback className="bg-amber-700 text-white text-2xl">
                            {topPlayers[2].displayName?.charAt(0)?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                          3
                        </div>
                      </div>
                      <h3 className="text-white font-bold truncate">{topPlayers[2].displayName}</h3>
                      <div className="text-2xl font-bold text-amber-200 mt-1">{topPlayers[2].rating}</div>
                      <Badge className="mt-2 bg-amber-500/30 text-amber-200">Bronze</Badge>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {restPlayers.length > 0 && (
              <Card className="bg-slate-800/50 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Star className="w-5 h-5 text-purple-400" />
                    Rankings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {restPlayers.map((entry) => (
                    <LeaderboardRow key={entry.id} entry={entry} />
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
