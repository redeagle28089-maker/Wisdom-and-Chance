import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  User, 
  Trophy, 
  Swords, 
  Layers, 
  Crown,
  Flame, 
  Droplet, 
  Mountain, 
  Wind, 
  Leaf,
  Calendar,
  TrendingUp,
  Target,
  History,
  LogIn
} from "lucide-react";
import { Link } from "wouter";
import type { Deck, Commander, Game, Element } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

const elementConfig: Record<Element, { icon: typeof Flame; color: string; bgColor: string }> = {
  Fire: { icon: Flame, color: "text-red-500", bgColor: "bg-red-600" },
  Water: { icon: Droplet, color: "text-blue-500", bgColor: "bg-blue-600" },
  Earth: { icon: Mountain, color: "text-amber-500", bgColor: "bg-amber-600" },
  Air: { icon: Wind, color: "text-green-400", bgColor: "bg-green-500" },
  Nature: { icon: Leaf, color: "text-emerald-500", bgColor: "bg-emerald-600" },
};

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: decks = [] } = useQuery<Deck[]>({
    queryKey: ["/api/decks"],
    enabled: !!user,
  });

  const { data: commanders = [] } = useQuery<Commander[]>({
    queryKey: ["/api/commanders"],
  });

  const { data: games = [] } = useQuery<Game[]>({
    queryKey: ["/api/games"],
    enabled: !!user,
  });

  const playerDecks = decks.filter((d) => d.playerId === user?.id);
  const playerGames = games.filter((g) => g.player1Id === user?.id);
  
  const wins = playerGames.filter((g) => g.winnerId === user?.id).length;
  const losses = playerGames.filter((g) => g.winnerId && g.winnerId !== user?.id).length;
  const inProgress = playerGames.filter((g) => g.status === "in_progress").length;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

  const recentGames = playerGames
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const displayName = user?.firstName 
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
    : user?.email?.split('@')[0] || 'Player';

  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (authLoading) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-purple-200">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-purple-500/20 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <User className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Sign In Required</h2>
            <p className="text-purple-200 mb-6">Sign in to view your profile, track your stats, and save your progress.</p>
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
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <Avatar className="w-20 h-20 mx-auto mb-4 ring-4 ring-purple-500/50">
            {user?.profileImageUrl && <AvatarImage src={user.profileImageUrl} alt={displayName} />}
            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-2xl">
              {initials}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2" data-testid="text-profile-title">
            {displayName}
          </h1>
          <p className="text-purple-300">{user?.email}</p>
          {user?.createdAt && (
            <div className="flex items-center justify-center gap-2 mt-2 text-purple-400 text-sm">
              <Calendar className="w-4 h-4" />
              <span>Joined {formatDate(user.createdAt)}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardContent className="p-4 text-center">
              <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-white">{wins}</p>
              <p className="text-purple-300 text-sm">Victories</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardContent className="p-4 text-center">
              <Swords className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-white">{losses}</p>
              <p className="text-purple-300 text-sm">Defeats</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-white">{winRate}%</p>
              <p className="text-purple-300 text-sm">Win Rate</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardContent className="p-4 text-center">
              <Layers className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-white">{playerDecks.length}</p>
              <p className="text-purple-300 text-sm">Decks</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-400" />
                My Decks
              </CardTitle>
            </CardHeader>
            <CardContent>
              {playerDecks.length === 0 ? (
                <div className="text-center py-6">
                  <Layers className="w-12 h-12 text-purple-400/50 mx-auto mb-2" />
                  <p className="text-purple-300 mb-4">No decks created yet</p>
                  <Link href="/deck-builder">
                    <Button className="bg-gradient-to-r from-purple-600 to-pink-600" data-testid="button-create-deck">
                      Create Deck
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {playerDecks.map((deck) => {
                    const commander = commanders.find((c) => c.id === deck.commanderId);
                    const config = commander ? elementConfig[commander.element] : null;
                    const Icon = config?.icon || Crown;

                    return (
                      <div
                        key={deck.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/50 border border-purple-500/20"
                        data-testid={`profile-deck-${deck.id}`}
                      >
                        <div className={`w-10 h-10 ${config?.bgColor || "bg-purple-600"} rounded-lg flex items-center justify-center`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-white font-medium">{deck.name}</h3>
                          <p className="text-purple-400 text-sm">{commander?.name}</p>
                        </div>
                        <Badge variant="secondary">{deck.cardIds.length} cards</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <History className="w-5 h-5 text-cyan-400" />
                Recent Games
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentGames.length === 0 ? (
                <div className="text-center py-6">
                  <Target className="w-12 h-12 text-purple-400/50 mx-auto mb-2" />
                  <p className="text-purple-300 mb-4">No games played yet</p>
                  <Link href="/practice">
                    <Button className="bg-gradient-to-r from-red-600 to-orange-600" data-testid="button-start-practice">
                      Start Practice
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentGames.map((game) => {
                    const isWin = game.winnerId === user?.id;
                    const isLoss = game.winnerId && game.winnerId !== user?.id;
                    const isInProgress = game.status === "in_progress";

                    return (
                      <Link key={game.id} href={`/game/${game.id}`}>
                        <div
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-slate-700/50 transition-all ${
                            isWin
                              ? "border-green-500/50 bg-green-500/10"
                              : isLoss
                              ? "border-red-500/50 bg-red-500/10"
                              : "border-yellow-500/50 bg-yellow-500/10"
                          }`}
                          data-testid={`profile-game-${game.id}`}
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            isWin ? "bg-green-600" : isLoss ? "bg-red-600" : "bg-yellow-600"
                          }`}>
                            {isWin && <Trophy className="w-5 h-5 text-white" />}
                            {isLoss && <Swords className="w-5 h-5 text-white" />}
                            {isInProgress && <Target className="w-5 h-5 text-white" />}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-white font-medium">
                              {isWin ? "Victory" : isLoss ? "Defeat" : "In Progress"}
                            </h3>
                            <p className="text-purple-400 text-sm">
                              Turn {game.currentTurn} | {game.aiDifficulty || "medium"} AI
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-green-400 text-sm">{game.player1HP} HP</p>
                            <p className="text-red-400 text-sm">{game.player2HP} HP</p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {inProgress > 0 && (
          <Card className="bg-gradient-to-r from-yellow-600/30 to-orange-600/30 border-yellow-500/40 mt-6">
            <CardContent className="p-6 text-center">
              <Target className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-white mb-2">
                You have {inProgress} game{inProgress > 1 ? "s" : ""} in progress
              </h2>
              <Link href="/practice">
                <Button className="bg-gradient-to-r from-yellow-500 to-orange-500" data-testid="button-continue-game">
                  Continue Playing
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
