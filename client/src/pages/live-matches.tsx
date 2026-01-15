import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Users, Clock, Swords, Flame, Droplet, Mountain, Wind, Leaf } from "lucide-react";
import { Link } from "wouter";
import type { Game } from "@shared/schema";

const elementIcons = {
  Fire: Flame,
  Water: Droplet,
  Earth: Mountain,
  Air: Wind,
  Nature: Leaf,
};

const elementColors = {
  Fire: "from-red-600 to-orange-600",
  Water: "from-blue-600 to-cyan-600",
  Earth: "from-amber-600 to-yellow-600",
  Air: "from-cyan-400 to-teal-400",
  Nature: "from-green-600 to-emerald-600",
};

interface LiveMatch {
  id: string;
  player1: string;
  player2: string;
  player1Element: keyof typeof elementIcons;
  player2Element: keyof typeof elementIcons;
  turn: number;
  spectators: number;
  startedAt: Date;
}

export default function LiveMatchesPage() {
  const { data: games = [], isLoading } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  const liveGames = games.filter(g => g.status === "in_progress");

  const mockLiveMatches: LiveMatch[] = [
    {
      id: "live-1",
      player1: "DragonMaster",
      player2: "StormBringer",
      player1Element: "Fire",
      player2Element: "Air",
      turn: 5,
      spectators: 12,
      startedAt: new Date(Date.now() - 1000 * 60 * 8),
    },
    {
      id: "live-2",
      player1: "AquaKnight",
      player2: "EarthShaker",
      player1Element: "Water",
      player2Element: "Earth",
      turn: 3,
      spectators: 8,
      startedAt: new Date(Date.now() - 1000 * 60 * 4),
    },
    {
      id: "live-3",
      player1: "NatureWarden",
      player2: "PyroMage",
      player1Element: "Nature",
      player2Element: "Fire",
      turn: 7,
      spectators: 23,
      startedAt: new Date(Date.now() - 1000 * 60 * 12),
    },
  ];

  const formatDuration = (startedAt: Date) => {
    const diff = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4" data-testid="text-live-matches-title">
            Live Matches
          </h1>
          <p className="text-lg text-purple-200">Watch ongoing battles and learn from top players</p>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-400 font-medium">{mockLiveMatches.length} Live Matches</span>
          </div>
          <Badge variant="outline" className="border-purple-500/30 text-purple-300">
            <Users className="w-3 h-3 mr-1" />
            {mockLiveMatches.reduce((acc, m) => acc + m.spectators, 0)} Spectators
          </Badge>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="bg-slate-800/50 border-purple-500/20 animate-pulse">
                <CardContent className="h-48" />
              </Card>
            ))}
          </div>
        ) : mockLiveMatches.length === 0 ? (
          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardContent className="p-12 text-center">
              <Eye className="w-16 h-16 mx-auto mb-4 text-purple-400 opacity-50" />
              <h3 className="text-xl font-bold text-white mb-2">No Live Matches</h3>
              <p className="text-purple-200 mb-6">There are no matches in progress right now</p>
              <Button asChild>
                <Link href="/lobby">Find a Match</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockLiveMatches.map((match) => {
              const Player1Icon = elementIcons[match.player1Element];
              const Player2Icon = elementIcons[match.player2Element];
              return (
                <Card key={match.id} className="bg-slate-800/50 border-purple-500/20 hover-elevate cursor-pointer" data-testid={`card-live-match-${match.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="border-green-500/50 text-green-400">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
                        LIVE
                      </Badge>
                      <div className="flex items-center gap-1 text-slate-400 text-sm">
                        <Clock className="w-3 h-3" />
                        {formatDuration(match.startedAt)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${elementColors[match.player1Element]} flex items-center justify-center`}>
                          <Player1Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-bold text-white">{match.player1}</p>
                          <p className="text-xs text-slate-400">{match.player1Element}</p>
                        </div>
                      </div>
                      <Swords className="w-5 h-5 text-purple-400" />
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-bold text-white text-right">{match.player2}</p>
                          <p className="text-xs text-slate-400 text-right">{match.player2Element}</p>
                        </div>
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${elementColors[match.player2Element]} flex items-center justify-center`}>
                          <Player2Icon className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Turn {match.turn}</span>
                      <div className="flex items-center gap-1 text-purple-300">
                        <Eye className="w-4 h-4" />
                        {match.spectators} watching
                      </div>
                    </div>

                    <Button className="w-full" variant="outline" data-testid={`button-spectate-${match.id}`}>
                      <Eye className="w-4 h-4 mr-2" />
                      Spectate
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Card className="bg-slate-800/50 border-purple-500/20 mt-8">
          <CardHeader>
            <CardTitle className="text-white">Spectator Tips</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-900/50 rounded-lg">
              <Eye className="w-8 h-8 text-purple-400 mb-2" />
              <h4 className="font-bold text-white mb-1">Watch & Learn</h4>
              <p className="text-sm text-slate-400">Observe top players' strategies and deck compositions</p>
            </div>
            <div className="p-4 bg-slate-900/50 rounded-lg">
              <Users className="w-8 h-8 text-purple-400 mb-2" />
              <h4 className="font-bold text-white mb-1">Community Chat</h4>
              <p className="text-sm text-slate-400">Discuss plays with other spectators in real-time</p>
            </div>
            <div className="p-4 bg-slate-900/50 rounded-lg">
              <Swords className="w-8 h-8 text-purple-400 mb-2" />
              <h4 className="font-bold text-white mb-1">Featured Matches</h4>
              <p className="text-sm text-slate-400">High-ranked matches are highlighted at the top</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
