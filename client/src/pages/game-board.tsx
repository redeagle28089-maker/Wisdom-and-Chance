import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { Heart, Swords, Trophy, Flag, ArrowRight, Shield, Flame, Droplet, Mountain, Wind, Leaf, RotateCcw, LogIn, MessageSquare, Eye, Send, X } from "lucide-react";
import type { Game, Card as CardType, Element, BattlefieldCard } from "@shared/schema";
import { GAME_CONSTANTS } from "@shared/schema";

interface ChatMessage {
  id: string;
  message: string;
  senderId: string;
  senderName: string;
  createdAt: string;
}

const elementConfig: Record<Element, { icon: typeof Flame; color: string; bgColor: string }> = {
  Fire: { icon: Flame, color: "text-red-500", bgColor: "bg-gradient-to-br from-red-600 to-orange-600" },
  Water: { icon: Droplet, color: "text-blue-500", bgColor: "bg-gradient-to-br from-blue-600 to-cyan-600" },
  Earth: { icon: Mountain, color: "text-amber-500", bgColor: "bg-gradient-to-br from-amber-700 to-yellow-600" },
  Air: { icon: Wind, color: "text-green-400", bgColor: "bg-gradient-to-br from-green-400 to-teal-400" },
  Nature: { icon: Leaf, color: "text-emerald-500", bgColor: "bg-gradient-to-br from-green-700 to-emerald-600" },
};

const phaseNames: Record<string, string> = {
  draw: "Draw Phase",
  deployment: "Deployment Phase",
  combat: "Combat Phase",
  calculation: "Calculation Phase",
  end: "End Phase",
};

function MiniCard({ card, faceDown = false, selected = false, onClick }: { 
  card: CardType; 
  faceDown?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const config = elementConfig[card.element];
  const Icon = config.icon;

  if (faceDown) {
    return (
      <div 
        className="w-16 h-24 rounded-lg bg-gradient-to-br from-purple-800 to-purple-900 border-2 border-purple-500/50 flex items-center justify-center"
        onClick={onClick}
      >
        <div className="w-8 h-8 rounded-full bg-purple-600/50 flex items-center justify-center">
          <span className="text-purple-300 text-lg">?</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`w-16 h-24 rounded-lg ${config.bgColor} border-2 ${selected ? 'border-yellow-400 ring-2 ring-yellow-400' : 'border-white/20'} p-1 cursor-pointer transition-all hover:scale-105`}
      onClick={onClick}
      data-testid={`card-${card.id}`}
    >
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-start">
          <div className="w-5 h-5 bg-black/40 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-xs">{card.power}</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Icon className="w-6 h-6 text-white/80" />
        </div>
        <p className="text-white text-[8px] truncate text-center">{card.name.split(' ')[0]}</p>
      </div>
    </div>
  );
}

export default function GameBoardPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/game/:id");
  const [, navigate] = useLocation();
  const gameId = params?.id;

  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { joinGame, leaveGame, subscribe, sendGameMessage, sendGameAction } = useWebSocket();

  const { data: game, isLoading, refetch: refetchGame } = useQuery<Game>({
    queryKey: ["/api/games", gameId],
    enabled: !!gameId,
    refetchInterval: 3000,
  });

  const { data: allCards = [] } = useQuery<CardType[]>({
    queryKey: ["/api/cards"],
  });

  useEffect(() => {
    if (gameId) {
      joinGame(gameId);
    }
    return () => {
      if (gameId) {
        leaveGame(gameId);
      }
    };
  }, [gameId, joinGame, leaveGame]);

  useEffect(() => {
    const unsubscribe = subscribe("game_update", (msg) => {
      if (msg.payload?.gameId === gameId) {
        refetchGame();
      }
    });
    return unsubscribe;
  }, [subscribe, gameId, refetchGame]);

  useEffect(() => {
    const unsubscribe = subscribe("game_message", (msg) => {
      if (msg.payload?.gameId === gameId) {
        const newMessage: ChatMessage = {
          id: Date.now().toString(),
          message: msg.payload.message,
          senderId: msg.payload.senderId,
          senderName: msg.payload.senderName || "Player",
          createdAt: new Date().toISOString(),
        };
        setChatMessages((prev) => [...prev, newMessage]);
      }
    });
    return unsubscribe;
  }, [subscribe, gameId]);

  useEffect(() => {
    const unsubscribe = subscribe("spectator_count", (msg) => {
      if (msg.payload?.gameId === gameId) {
        setSpectatorCount(msg.payload.count);
      }
    });
    return unsubscribe;
  }, [subscribe, gameId]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSendChat = () => {
    if (chatMessage.trim() && gameId) {
      sendGameMessage(gameId, chatMessage.trim());
      const myName = user?.firstName ? `${user.firstName}` : "You";
      setChatMessages((prev) => [...prev, {
        id: Date.now().toString(),
        message: chatMessage.trim(),
        senderId: user?.id || "",
        senderName: myName,
        createdAt: new Date().toISOString(),
      }]);
      setChatMessage("");
    }
  };

  const updateGameMutation = useMutation({
    mutationFn: async (updates: Partial<Game>) => {
      const res = await apiRequest("PATCH", `/api/games/${gameId}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId] });
      if (gameId) {
        sendGameAction(gameId, "state_update", {});
      }
    },
  });

  const isMultiplayer = game?.gameType === "multiplayer";

  const getCardById = (cardId: string) => allCards.find((c) => c.id === cardId);

  if (isLoading || !game) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isPlayer1 = game.player1Id === user?.id;
  const myHP = isPlayer1 ? game.player1HP : game.player2HP;
  const opponentHP = isPlayer1 ? game.player2HP : game.player1HP;
  const myHand = isPlayer1 ? game.gameState.player1Hand : game.gameState.player2Hand;
  const opponentHandSize = isPlayer1 ? game.gameState.player2Hand.length : game.gameState.player1Hand.length;
  const myBattlefield = isPlayer1 ? game.gameState.player1Battlefield : game.gameState.player2Battlefield;
  const opponentBattlefield = isPlayer1 ? game.gameState.player2Battlefield : game.gameState.player1Battlefield;
  const myDeckSize = isPlayer1 ? game.gameState.player1Deck.length : game.gameState.player2Deck.length;
  const opponentDeckSize = isPlayer1 ? game.gameState.player2Deck.length : game.gameState.player1Deck.length;
  const isMyTurn = game.activePlayer === user?.id;

  const handleCardSelect = (cardId: string) => {
    if (game.currentPhase !== "deployment" || !isMyTurn) return;
    
    if (selectedCards.includes(cardId)) {
      setSelectedCards(selectedCards.filter((id) => id !== cardId));
    } else if (selectedCards.length < GAME_CONSTANTS.CARDS_TO_DEPLOY) {
      setSelectedCards([...selectedCards, cardId]);
    }
  };

  const handleDraw = () => {
    if (game.currentPhase !== "draw" || !isMyTurn) return;

    const myDeck = isPlayer1 ? [...game.gameState.player1Deck] : [...game.gameState.player2Deck];
    const myNewHand = [...myHand];
    
    if (myDeck.length < GAME_CONSTANTS.CARDS_TO_DRAW) {
      toast({ title: "Not enough cards to draw!", variant: "destructive" });
      return;
    }

    for (let i = 0; i < GAME_CONSTANTS.CARDS_TO_DRAW; i++) {
      myNewHand.push(myDeck.shift()!);
    }

    const newGameState = { ...game.gameState };
    if (isPlayer1) {
      newGameState.player1Hand = myNewHand;
      newGameState.player1Deck = myDeck;
      newGameState.player1Battlefield = [];
      newGameState.player2Battlefield = [];
    } else {
      newGameState.player2Hand = myNewHand;
      newGameState.player2Deck = myDeck;
      newGameState.player1Battlefield = [];
      newGameState.player2Battlefield = [];
    }

    updateGameMutation.mutate({
      currentPhase: "deployment",
      gameState: newGameState,
    });
    toast({ title: "Drew 2 cards!" });
  };

  const handleDeploy = () => {
    if (selectedCards.length !== GAME_CONSTANTS.CARDS_TO_DEPLOY) {
      toast({ title: `Select ${GAME_CONSTANTS.CARDS_TO_DEPLOY} cards to deploy`, variant: "destructive" });
      return;
    }

    const newHand = myHand.filter((id) => !selectedCards.includes(id));
    const newBattlefield: BattlefieldCard[] = selectedCards.map((cardId) => ({
      cardId,
      faceDown: true,
    }));

    const newGameState = { ...game.gameState };
    if (isPlayer1) {
      newGameState.player1Hand = newHand;
      newGameState.player1Battlefield = newBattlefield;
    } else {
      newGameState.player2Hand = newHand;
      newGameState.player2Battlefield = newBattlefield;
    }

    const opponentBF = isPlayer1 ? newGameState.player2Battlefield : newGameState.player1Battlefield;
    const nextPhase = opponentBF.length === GAME_CONSTANTS.CARDS_TO_DEPLOY ? "combat" : "deployment";

    updateGameMutation.mutate({
      currentPhase: nextPhase,
      gameState: newGameState,
    });
    setSelectedCards([]);
    toast({ title: "Cards deployed!" });
  };

  const handleCombat = () => {
    const newGameState = { ...game.gameState };
    newGameState.player1Battlefield = newGameState.player1Battlefield.map((bf) => ({ ...bf, faceDown: false }));
    newGameState.player2Battlefield = newGameState.player2Battlefield.map((bf) => ({ ...bf, faceDown: false }));

    updateGameMutation.mutate({
      currentPhase: "calculation",
      gameState: newGameState,
    });
    toast({ title: "Cards revealed!" });
  };

  const handleCalculation = () => {
    const p1Power = game.gameState.player1Battlefield.reduce((sum, bf) => {
      const card = getCardById(bf.cardId);
      return sum + (card?.power || 0);
    }, 0);

    const p2Power = game.gameState.player2Battlefield.reduce((sum, bf) => {
      const card = getCardById(bf.cardId);
      return sum + (card?.power || 0);
    }, 0);

    const damage = Math.abs(p1Power - p2Power);
    let newP1HP = game.player1HP;
    let newP2HP = game.player2HP;
    let newP1VP = game.player1VictoryPoints;
    let newP2VP = game.player2VictoryPoints;
    let newP1WP = game.player1WithdrawalPoints;
    let newP2WP = game.player2WithdrawalPoints;

    if (p1Power > p2Power) {
      newP2HP -= damage;
      newP1VP += 1;
      newP2WP += 1;
      toast({ title: `Player 1 wins! ${damage} damage dealt.` });
    } else if (p2Power > p1Power) {
      newP1HP -= damage;
      newP2VP += 1;
      newP1WP += 1;
      toast({ title: `Player 2 wins! ${damage} damage dealt.` });
    } else {
      toast({ title: "Draw! No damage dealt." });
    }

    const p1Yard = [...game.gameState.player1Yard, ...game.gameState.player1Battlefield.map((bf) => bf.cardId)];
    const p2Yard = [...game.gameState.player2Yard, ...game.gameState.player2Battlefield.map((bf) => bf.cardId)];

    const newGameState = {
      ...game.gameState,
      player1Battlefield: [],
      player2Battlefield: [],
      player1Yard: p1Yard,
      player2Yard: p2Yard,
    };

    let status = game.status;
    let winnerId = game.winnerId;

    if (newP1HP <= 0) {
      status = "completed";
      winnerId = game.player2Id;
      toast({ title: "Game Over! Player 2 wins!", variant: "default" });
    } else if (newP2HP <= 0) {
      status = "completed";
      winnerId = game.player1Id;
      toast({ title: "Game Over! You win!", variant: "default" });
    }

    updateGameMutation.mutate({
      currentPhase: "end",
      currentTurn: game.currentTurn + 1,
      player1HP: newP1HP,
      player2HP: newP2HP,
      player1VictoryPoints: newP1VP,
      player2VictoryPoints: newP2VP,
      player1WithdrawalPoints: newP1WP,
      player2WithdrawalPoints: newP2WP,
      gameState: newGameState,
      status,
      winnerId,
    });
  };

  const handleEndPhase = () => {
    updateGameMutation.mutate({
      currentPhase: "draw",
      activePlayer: game.activePlayer === game.player1Id ? game.player2Id! : game.player1Id,
    });
  };

  if (game.status === "completed") {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 flex items-center justify-center p-6">
        <Card className="bg-slate-800/50 border-purple-500/20 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">Game Over!</h1>
            <p className="text-purple-200 text-lg mb-6">
              {game.winnerId === user?.id ? "You won!" : "You lost!"}
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={() => navigate("/practice")} data-testid="button-back-to-practice">
                <RotateCcw className="w-4 h-4 mr-2" />
                Play Again
              </Button>
              <Button onClick={() => navigate("/")} data-testid="button-go-home">
                Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="text-sm">Turn {game.currentTurn}</Badge>
            <Badge className="bg-purple-600">{phaseNames[game.currentPhase]}</Badge>
            {isMyTurn && <Badge className="bg-green-600">Your Turn</Badge>}
            {isMultiplayer && spectatorCount > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {spectatorCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isMultiplayer && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setChatOpen(!chatOpen)}
                data-testid="button-toggle-chat"
              >
                <MessageSquare className="w-4 h-4" />
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate(isMultiplayer ? "/lobby" : "/practice")}>
              Leave Game
            </Button>
          </div>
        </div>

        <div className="flex justify-center gap-8">
          <Card className="bg-slate-800/50 border-purple-500/20 p-4">
            <div className="flex items-center gap-3">
              <Heart className="w-6 h-6 text-red-500" />
              <span className="text-2xl font-bold text-white">{opponentHP}</span>
              <span className="text-purple-300">Opponent</span>
            </div>
          </Card>
          <Card className="bg-slate-800/50 border-purple-500/20 p-4">
            <div className="flex items-center gap-3">
              <Heart className="w-6 h-6 text-green-500" />
              <span className="text-2xl font-bold text-white">{myHP}</span>
              <span className="text-purple-300">You</span>
            </div>
          </Card>
        </div>

        <Card className="bg-slate-800/30 border-purple-500/20">
          <CardContent className="p-4">
            <p className="text-purple-300 text-sm mb-2">Opponent's Hand ({opponentHandSize} cards) | Deck: {opponentDeckSize}</p>
            <div className="flex gap-2 justify-center min-h-[96px]">
              {Array(opponentHandSize).fill(0).map((_, i) => (
                <div key={i} className="w-12 h-20 rounded-lg bg-gradient-to-br from-purple-800 to-purple-900 border border-purple-500/50" />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-purple-500/20">
          <CardContent className="p-4">
            <p className="text-purple-300 text-sm mb-2 text-center">Opponent's Battlefield</p>
            <div className="flex gap-2 justify-center min-h-[96px]">
              {opponentBattlefield.map((bf, i) => {
                const card = getCardById(bf.cardId);
                if (!card) return null;
                return <MiniCard key={i} card={card} faceDown={bf.faceDown} />;
              })}
              {opponentBattlefield.length === 0 && (
                <div className="text-purple-400 text-sm">No cards deployed</div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Card className="bg-purple-900/50 border-purple-500/30 p-4">
            <div className="flex items-center gap-4">
              {game.currentPhase === "draw" && isMyTurn && (
                <Button onClick={handleDraw} className="bg-gradient-to-r from-cyan-600 to-blue-600" data-testid="button-draw">
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Draw Cards
                </Button>
              )}
              {game.currentPhase === "deployment" && isMyTurn && (
                <Button 
                  onClick={handleDeploy} 
                  disabled={selectedCards.length !== GAME_CONSTANTS.CARDS_TO_DEPLOY}
                  className="bg-gradient-to-r from-purple-600 to-pink-600"
                  data-testid="button-deploy"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Deploy ({selectedCards.length}/{GAME_CONSTANTS.CARDS_TO_DEPLOY})
                </Button>
              )}
              {game.currentPhase === "combat" && isMyTurn && (
                <Button onClick={handleCombat} className="bg-gradient-to-r from-red-600 to-orange-600" data-testid="button-combat">
                  <Swords className="w-4 h-4 mr-2" />
                  Reveal Cards
                </Button>
              )}
              {game.currentPhase === "calculation" && isMyTurn && (
                <Button onClick={handleCalculation} className="bg-gradient-to-r from-yellow-600 to-orange-600" data-testid="button-calculate">
                  <Trophy className="w-4 h-4 mr-2" />
                  Calculate Damage
                </Button>
              )}
              {game.currentPhase === "end" && isMyTurn && (
                <Button onClick={handleEndPhase} className="bg-gradient-to-r from-green-600 to-teal-600" data-testid="button-end">
                  <Flag className="w-4 h-4 mr-2" />
                  End Turn
                </Button>
              )}
              {!isMyTurn && (
                <p className="text-purple-300">Waiting for opponent...</p>
              )}
            </div>
          </Card>
        </div>

        <Card className="bg-slate-800/50 border-purple-500/20">
          <CardContent className="p-4">
            <p className="text-purple-300 text-sm mb-2 text-center">Your Battlefield</p>
            <div className="flex gap-2 justify-center min-h-[96px]">
              {myBattlefield.map((bf, i) => {
                const card = getCardById(bf.cardId);
                if (!card) return null;
                return <MiniCard key={i} card={card} faceDown={bf.faceDown} />;
              })}
              {myBattlefield.length === 0 && (
                <div className="text-purple-400 text-sm">Deploy cards from your hand</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/30 border-green-500/20">
          <CardContent className="p-4">
            <p className="text-green-300 text-sm mb-2">Your Hand ({myHand.length} cards) | Deck: {myDeckSize}</p>
            <div className="flex gap-2 flex-wrap justify-center min-h-[96px]">
              {myHand.map((cardId) => {
                const card = getCardById(cardId);
                if (!card) return null;
                return (
                  <MiniCard 
                    key={cardId} 
                    card={card} 
                    selected={selectedCards.includes(cardId)}
                    onClick={() => handleCardSelect(cardId)}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {chatOpen && isMultiplayer && (
        <div className="fixed bottom-4 right-4 w-80 h-96 bg-slate-800 border border-purple-500/30 rounded-lg shadow-xl flex flex-col z-50">
          <div className="flex items-center justify-between p-3 border-b border-purple-500/20">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-400" />
              <span className="text-white font-medium">Game Chat</span>
            </div>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-6 w-6"
              onClick={() => setChatOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-3" ref={chatScrollRef}>
            <div className="space-y-2">
              {chatMessages.length === 0 ? (
                <p className="text-purple-400 text-sm text-center">No messages yet</p>
              ) : (
                chatMessages.map((msg) => (
                  <div key={msg.id} className="text-sm">
                    <span className={`font-medium ${msg.senderId === user?.id ? 'text-green-400' : 'text-purple-400'}`}>
                      {msg.senderName}:
                    </span>{" "}
                    <span className="text-white">{msg.message}</span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          <div className="p-3 border-t border-purple-500/20">
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                className="bg-slate-900/50 border-purple-500/30 text-white"
                data-testid="input-game-chat"
              />
              <Button 
                size="icon" 
                onClick={handleSendChat}
                disabled={!chatMessage.trim()}
                data-testid="button-send-game-chat"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
