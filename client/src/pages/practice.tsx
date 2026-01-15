import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Swords, Crown, Flame, Droplet, Mountain, Wind, Leaf, Play, Layers, History, Trophy, Clock, Eye, Brain, Zap, Target } from "lucide-react";
import type { Deck, Commander, Element, Game, InsertGame, GameState, Card as CardType, AIDifficulty } from "@shared/schema";
import { GAME_CONSTANTS, AI_DIFFICULTY } from "@shared/schema";
import { Link } from "wouter";

const elementConfig: Record<Element, { icon: typeof Flame; color: string; bgColor: string }> = {
  Fire: { icon: Flame, color: "text-red-500", bgColor: "bg-red-600" },
  Water: { icon: Droplet, color: "text-blue-500", bgColor: "bg-blue-600" },
  Earth: { icon: Mountain, color: "text-amber-500", bgColor: "bg-amber-600" },
  Air: { icon: Wind, color: "text-green-400", bgColor: "bg-green-500" },
  Nature: { icon: Leaf, color: "text-emerald-500", bgColor: "bg-emerald-600" },
};

const difficultyConfig: Record<AIDifficulty, { name: string; icon: typeof Brain; color: string; description: string }> = {
  easy: { name: "Easy", icon: Zap, color: "from-green-500 to-emerald-500", description: "AI makes random choices" },
  medium: { name: "Medium", icon: Brain, color: "from-yellow-500 to-orange-500", description: "AI plays strategically" },
  hard: { name: "Hard", icon: Target, color: "from-red-500 to-pink-500", description: "AI counters your moves" },
};

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PracticePage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<AIDifficulty>("medium");

  const { data: player } = useQuery({
    queryKey: ["/api/guest-player"],
  });

  const { data: decks = [] } = useQuery<Deck[]>({
    queryKey: ["/api/decks"],
    enabled: !!player,
  });

  const { data: commanders = [] } = useQuery<Commander[]>({
    queryKey: ["/api/commanders"],
  });

  const { data: allCards = [] } = useQuery<CardType[]>({
    queryKey: ["/api/cards"],
  });

  const { data: games = [] } = useQuery<Game[]>({
    queryKey: ["/api/games"],
    enabled: !!player,
  });

  const playerDecks = decks.filter((d) => d.playerId === (player as { id: string })?.id);
  const playerGames = games.filter(
    (g) => g.player1Id === (player as { id: string })?.id && g.gameType === "practice"
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const startGameMutation = useMutation({
    mutationFn: async (gameData: InsertGame) => {
      const res = await apiRequest("POST", "/api/games", gameData);
      return res.json() as Promise<Game>;
    },
    onSuccess: (game) => {
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
      navigate(`/game/${game.id}`);
    },
    onError: () => {
      toast({ title: "Failed to start game", variant: "destructive" });
    },
  });

  const startPracticeGame = () => {
    if (!selectedDeckId || !player) {
      toast({ title: "Please select a deck first", variant: "destructive" });
      return;
    }

    const selectedDeck = playerDecks.find((d) => d.id === selectedDeckId);
    if (!selectedDeck) return;

    const aiCommander = commanders[Math.floor(Math.random() * commanders.length)];
    const aiDeckCards = shuffleArray(allCards.filter((c) => !c.isCommander).slice(0, 40));

    const player1Deck = shuffleArray([...selectedDeck.cardIds]);
    const player2Deck = shuffleArray(aiDeckCards.map((c) => c.id));

    const player1Hand = player1Deck.splice(0, GAME_CONSTANTS.STARTING_HAND_SIZE);
    const player2Hand = player2Deck.splice(0, GAME_CONSTANTS.STARTING_HAND_SIZE);

    const initialGameState: GameState = {
      player1Hand,
      player2Hand,
      player1Deck,
      player2Deck,
      player1Battlefield: [],
      player2Battlefield: [],
      player1Yard: [],
      player2Yard: [],
    };

    const gameData: InsertGame = {
      player1Id: (player as { id: string }).id,
      player2Id: "player-ai",
      player1DeckId: selectedDeckId,
      player2DeckId: aiCommander.id,
      player1HP: GAME_CONSTANTS.STARTING_HP,
      player2HP: GAME_CONSTANTS.STARTING_HP,
      player1VictoryPoints: 0,
      player2VictoryPoints: 0,
      player1WithdrawalPoints: 0,
      player2WithdrawalPoints: 0,
      currentPhase: "draw",
      currentTurn: 1,
      activePlayer: (player as { id: string }).id,
      status: "in_progress",
      gameType: "practice",
      aiDifficulty: selectedDifficulty,
      winnerId: null,
      gameState: initialGameState,
      gameHistory: [],
    };

    startGameMutation.mutate(gameData);
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl mb-4 shadow-xl">
            <Swords className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2" data-testid="text-practice-title">Practice Mode</h1>
          <p className="text-lg text-purple-200">Test your deck against an AI opponent</p>
        </div>

        {playerDecks.length === 0 ? (
          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardContent className="p-8 text-center">
              <Layers className="w-16 h-16 text-purple-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">No Decks Found</h2>
              <p className="text-purple-200 mb-6">You need to build a deck before you can practice.</p>
              <Link href="/deck-builder">
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600" data-testid="button-go-to-deckbuilder">
                  <Layers className="w-4 h-4 mr-2" />
                  Build a Deck
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-slate-800/50 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-purple-400" />
                    Select Your Deck
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {playerDecks.map((deck) => {
                      const commander = commanders.find((c) => c.id === deck.commanderId);
                      const config = commander ? elementConfig[commander.element] : null;
                      const Icon = config?.icon || Crown;

                      return (
                        <button
                          key={deck.id}
                          onClick={() => setSelectedDeckId(deck.id)}
                          className={`p-4 rounded-lg border-2 text-left transition-all ${
                            selectedDeckId === deck.id
                              ? "border-purple-500 bg-purple-500/20"
                              : "border-purple-500/30 bg-slate-900/50 hover:border-purple-500/50"
                          }`}
                          data-testid={`deck-${deck.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 ${config?.bgColor || "bg-purple-600"} rounded-lg flex items-center justify-center`}>
                              <Icon className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="text-white font-bold">{deck.name}</h3>
                              <p className="text-purple-300 text-sm">
                                {commander?.name || "Unknown Commander"}
                              </p>
                              <Badge variant="secondary" className="mt-1">
                                {deck.cardIds.length} cards
                              </Badge>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Brain className="w-5 h-5 text-yellow-400" />
                    AI Difficulty
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    {AI_DIFFICULTY.map((difficulty) => {
                      const config = difficultyConfig[difficulty];
                      const Icon = config.icon;
                      return (
                        <button
                          key={difficulty}
                          onClick={() => setSelectedDifficulty(difficulty)}
                          className={`p-4 rounded-lg border-2 text-center transition-all ${
                            selectedDifficulty === difficulty
                              ? "border-yellow-500 bg-yellow-500/20"
                              : "border-purple-500/30 bg-slate-900/50 hover:border-purple-500/50"
                          }`}
                          data-testid={`difficulty-${difficulty}`}
                        >
                          <div className={`w-12 h-12 mx-auto mb-2 rounded-lg bg-gradient-to-br ${config.color} flex items-center justify-center`}>
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          <h3 className="text-white font-bold">{config.name}</h3>
                          <p className="text-purple-300 text-xs mt-1">{config.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Swords className="w-5 h-5 text-red-400" />
                    AI Opponent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-purple-200 mb-4">
                    You will face a random AI commander with an auto-generated deck. 
                    The AI will play based on the selected difficulty.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {commanders.map((commander) => {
                      const config = elementConfig[commander.element];
                      const Icon = config.icon;
                      return (
                        <div key={commander.id} className="flex items-center gap-1">
                          <div className={`w-6 h-6 ${config.bgColor} rounded flex items-center justify-center`}>
                            <Icon className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-purple-300 text-sm">{commander.name.split(' ')[0]}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <div className="text-center">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-red-600 to-orange-600 text-lg px-8 py-6 shadow-xl shadow-red-500/30"
                  onClick={startPracticeGame}
                  disabled={!selectedDeckId || startGameMutation.isPending}
                  data-testid="button-start-game"
                >
                  <Play className="w-5 h-5 mr-2" />
                  {startGameMutation.isPending ? "Starting..." : "Start Practice Game"}
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              <Card className="bg-slate-800/50 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-cyan-400" />
                    Game History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {playerGames.length === 0 ? (
                    <div className="text-center py-6">
                      <History className="w-12 h-12 text-purple-400/50 mx-auto mb-2" />
                      <p className="text-purple-300">No games played yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {playerGames.slice(0, 10).map((game) => {
                        const isWin = game.winnerId === (player as { id: string })?.id;
                        const isLoss = game.winnerId && game.winnerId !== (player as { id: string })?.id;
                        const isInProgress = game.status === "in_progress";

                        return (
                          <Link key={game.id} href={`/game/${game.id}`}>
                            <div
                              className={`p-3 rounded-lg border transition-all cursor-pointer hover:bg-slate-700/50 ${
                                isWin
                                  ? "border-green-500/50 bg-green-500/10"
                                  : isLoss
                                  ? "border-red-500/50 bg-red-500/10"
                                  : "border-purple-500/30 bg-slate-900/50"
                              }`}
                              data-testid={`game-history-${game.id}`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {isWin && <Trophy className="w-4 h-4 text-green-500" />}
                                  {isLoss && <Swords className="w-4 h-4 text-red-500" />}
                                  {isInProgress && <Clock className="w-4 h-4 text-yellow-500" />}
                                  <span className="text-white font-medium text-sm">
                                    {isWin ? "Victory" : isLoss ? "Defeat" : "In Progress"}
                                  </span>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  {game.aiDifficulty || "medium"}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between text-xs text-purple-300">
                                <span>Turn {game.currentTurn}</span>
                                <span>{formatDate(game.createdAt)}</span>
                              </div>
                              <div className="flex items-center justify-between mt-2 text-xs">
                                <span className="text-green-400">You: {game.player1HP} HP</span>
                                <span className="text-red-400">AI: {game.player2HP} HP</span>
                              </div>
                              <div className="mt-2 flex items-center justify-center">
                                <Eye className="w-3 h-3 text-purple-400 mr-1" />
                                <span className="text-purple-400 text-xs">
                                  {isInProgress ? "Continue" : "View Replay"}
                                </span>
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
          </div>
        )}
      </div>
    </div>
  );
}
