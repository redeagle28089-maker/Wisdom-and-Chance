import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { Heart, Swords, Trophy, Flag, ArrowRight, Shield, Flame, Droplet, Mountain, Wind, Leaf, RotateCcw, LogIn, MessageSquare, Eye, Send, X, Zap, Sparkles } from "lucide-react";
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

function AnimatedHPBar({ 
  current, 
  max, 
  isPlayer, 
  label,
  previousHP
}: { 
  current: number; 
  max: number; 
  isPlayer: boolean; 
  label: string;
  previousHP?: number;
}) {
  const percentage = Math.max(0, (current / max) * 100);
  const isLow = percentage <= 25;
  const isCritical = percentage <= 10;
  const tookDamage = previousHP !== undefined && current < previousHP;
  const [shaking, setShaking] = useState(false);
  
  useEffect(() => {
    if (tookDamage) {
      setShaking(true);
      const timer = setTimeout(() => setShaking(false), 500);
      return () => clearTimeout(timer);
    }
  }, [current, tookDamage]);
  
  return (
    <div className={`relative rounded-xl overflow-hidden ${isPlayer ? 'bg-slate-800/80' : 'bg-slate-800/60'} border ${isPlayer ? 'border-green-500/30' : 'border-red-500/30'} p-3 min-w-[180px] ${shaking ? 'animate-damage-shake' : ''}`}>
      <div className="absolute inset-0 opacity-20">
        <div 
          className={`h-full transition-all duration-500 ease-out ${
            isCritical ? 'bg-red-600 animate-pulse' : 
            isLow ? 'bg-orange-500' : 
            isPlayer ? 'bg-green-500' : 'bg-red-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className={`w-5 h-5 ${isPlayer ? 'text-green-400' : 'text-red-400'} ${isCritical ? 'animate-pulse' : ''}`} />
          <span className="text-white/70 text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-2xl font-bold transition-all ${isCritical ? 'text-red-400 animate-pulse' : shaking ? 'text-red-300 scale-110' : 'text-white'}`}>
            {current}
          </span>
          <span className="text-white/40 text-sm">/{max}</span>
        </div>
      </div>
    </div>
  );
}

function PhaseIndicator({ 
  currentPhase, 
  isMyTurn, 
  turn 
}: { 
  currentPhase: string; 
  isMyTurn: boolean; 
  turn: number;
}) {
  const phases = ['draw', 'deployment', 'combat', 'calculation', 'end'];
  const phaseIcons: Record<string, typeof ArrowRight> = {
    draw: ArrowRight,
    deployment: Shield,
    combat: Swords,
    calculation: Trophy,
    end: Flag,
  };
  const phaseColors: Record<string, string> = {
    draw: 'from-cyan-500 to-blue-500',
    deployment: 'from-purple-500 to-pink-500',
    combat: 'from-red-500 to-orange-500',
    calculation: 'from-yellow-500 to-amber-500',
    end: 'from-green-500 to-teal-500',
  };
  
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-1 text-xs">
        <Badge variant="outline" className="text-purple-300 border-purple-500/30">
          Turn {turn}
        </Badge>
        {isMyTurn && (
          <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white animate-pulse">
            <Sparkles className="w-3 h-3 mr-1" />
            Your Turn
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1 bg-slate-800/60 rounded-full p-1 border border-purple-500/20">
        {phases.map((phase, i) => {
          const Icon = phaseIcons[phase];
          const isActive = phase === currentPhase;
          const isPast = phases.indexOf(currentPhase) > i;
          
          return (
            <div key={phase} className="flex items-center">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isActive 
                    ? `bg-gradient-to-r ${phaseColors[phase]} shadow-lg shadow-${phase === 'combat' ? 'red' : 'purple'}-500/30` 
                    : isPast 
                      ? 'bg-slate-600/50' 
                      : 'bg-slate-700/30'
                }`}
                title={phaseNames[phase]}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : isPast ? 'text-slate-400' : 'text-slate-500'}`} />
              </div>
              {i < phases.length - 1 && (
                <div className={`w-2 h-0.5 ${isPast ? 'bg-slate-500' : 'bg-slate-700/50'}`} />
              )}
            </div>
          );
        })}
      </div>
      <span className={`text-sm font-medium bg-gradient-to-r ${phaseColors[currentPhase]} bg-clip-text text-transparent`}>
        {phaseNames[currentPhase]}
      </span>
    </div>
  );
}

function MiniCard({ 
  card, 
  faceDown = false, 
  selected = false, 
  playable = false,
  isOnBattlefield = false,
  isNewlyPlayed = false,
  onClick,
  onPreview 
}: { 
  card: CardType; 
  faceDown?: boolean;
  selected?: boolean;
  playable?: boolean;
  isOnBattlefield?: boolean;
  isNewlyPlayed?: boolean;
  onClick?: () => void;
  onPreview?: () => void;
}) {
  const config = elementConfig[card.element];
  const Icon = config.icon;
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (onPreview) {
      hoverTimerRef.current = setTimeout(() => {
        onPreview();
      }, 800);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const handleTouchStart = () => {
    if (onPreview) {
      hoverTimerRef.current = setTimeout(() => {
        onPreview();
      }, 600);
    }
  };

  const handleTouchEnd = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  if (faceDown) {
    return (
      <div 
        className={`w-16 h-24 rounded-lg bg-gradient-to-br from-purple-800 to-purple-900 border-2 border-purple-500/50 flex items-center justify-center shadow-lg transition-all duration-300 ${isOnBattlefield ? 'animate-pulse' : ''}`}
        onClick={onClick}
      >
        <div className="w-10 h-10 rounded-full bg-purple-600/30 flex items-center justify-center border border-purple-400/30">
          <span className="text-purple-300 text-xl font-bold">?</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative w-16 h-24 rounded-lg ${config.bgColor} border-2 transition-all duration-200 cursor-pointer group
        ${selected 
          ? 'border-yellow-400 ring-2 ring-yellow-400/50 shadow-lg shadow-yellow-500/30 -translate-y-2 scale-105' 
          : playable 
            ? 'border-green-400/70 hover:border-green-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-green-500/20' 
            : 'border-white/20 hover:border-white/40'
        }
        ${playable && !selected ? 'animate-[pulse_2s_ease-in-out_infinite]' : ''}
        ${isNewlyPlayed ? 'animate-[cardDraw_0.4s_ease-out]' : ''}
        ${isHovered ? 'z-10' : ''}
      `}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={onPreview}
      data-testid={`card-${card.id}`}
    >
      {playable && !selected && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-ping" />
      )}
      <div className="h-full flex flex-col p-1">
        <div className="flex justify-between items-start">
          <div className="w-6 h-6 bg-black/50 rounded-full flex items-center justify-center border border-white/20 shadow-inner">
            <span className="text-white font-bold text-xs">{card.power}</span>
          </div>
          {card.buffModifier > 0 && (
            <div className="w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-[6px] text-white">+</span>
            </div>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center relative">
          <div className={`absolute inset-0 bg-gradient-to-t from-black/40 to-transparent rounded`} />
          <Icon className="w-7 h-7 text-white/90 drop-shadow-lg relative z-10" />
        </div>
        <p className="text-white text-[7px] truncate text-center font-medium drop-shadow">{card.name.split(' ')[0]}</p>
      </div>
      {isHovered && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 px-2 py-0.5 rounded text-[9px] text-white whitespace-nowrap z-20 border border-purple-500/30">
          Hold to preview
        </div>
      )}
    </div>
  );
}

function CardPreviewDialog({ 
  card, 
  open, 
  onClose 
}: { 
  card: CardType | null; 
  open: boolean; 
  onClose: () => void;
}) {
  if (!card) return null;
  
  const config = elementConfig[card.element];
  const Icon = config.icon;
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-purple-500/30 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Icon className={config.color} />
            {card.name}
          </DialogTitle>
        </DialogHeader>
        <div className={`w-full aspect-[3/4] rounded-xl ${config.bgColor} p-4 flex flex-col items-center justify-center relative overflow-hidden`}>
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-black/30" />
          <div className="absolute top-3 left-3 w-12 h-12 bg-black/50 rounded-full flex items-center justify-center border-2 border-white/30">
            <span className="text-white font-bold text-xl">{card.power}</span>
          </div>
          <Icon className="w-24 h-24 text-white/80 drop-shadow-2xl relative z-10" />
          <p className="text-white font-bold text-lg mt-4 relative z-10">{card.name}</p>
          <Badge className="mt-2 bg-black/30">{card.element}</Badge>
        </div>
        <div className="space-y-2">
          {card.trait && (
            <div className="bg-purple-500/20 rounded-lg p-2">
              <p className="text-purple-300 text-xs font-medium">Trait</p>
              <p className="text-white text-sm">{card.trait}</p>
            </div>
          )}
          <div className="flex gap-2">
            {card.buffModifier > 0 && (
              <div className="flex-1 bg-green-500/20 rounded-lg p-2">
                <p className="text-green-300 text-xs font-medium">Buff</p>
                <p className="text-white text-sm">{card.buffColor} +{card.buffModifier}</p>
              </div>
            )}
            {card.debuffModifier > 0 && (
              <div className="flex-1 bg-red-500/20 rounded-lg p-2">
                <p className="text-red-300 text-xs font-medium">Debuff</p>
                <p className="text-white text-sm">{card.debuffColor} -{card.debuffModifier}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BattlefieldZone({ 
  cards, 
  isOpponent, 
  allCards, 
  onPreview,
  newlyDeployedCards = new Set()
}: { 
  cards: BattlefieldCard[]; 
  isOpponent: boolean; 
  allCards: CardType[];
  onPreview: (card: CardType) => void;
  newlyDeployedCards?: Set<string>;
}) {
  const getCardById = (cardId: string) => allCards.find((c) => c.id === cardId);
  
  return (
    <div className={`relative rounded-xl border-2 ${isOpponent ? 'border-red-500/20 bg-gradient-to-b from-red-900/10 to-slate-800/30' : 'border-green-500/20 bg-gradient-to-t from-green-900/10 to-slate-800/30'} p-4`}>
      <div className="absolute inset-0 overflow-hidden rounded-xl">
        <div className={`absolute inset-0 bg-[radial-gradient(circle_at_50%_${isOpponent ? '0%' : '100%'},_var(--tw-gradient-from)_0%,_transparent_70%)] ${isOpponent ? 'from-red-500/5' : 'from-green-500/5'}`} />
      </div>
      <p className={`${isOpponent ? 'text-red-300' : 'text-green-300'} text-xs font-medium mb-3 text-center uppercase tracking-wider`}>
        {isOpponent ? "Opponent's Field" : "Your Field"}
      </p>
      <div className="flex gap-3 justify-center min-h-[100px] items-center">
        {cards.length > 0 ? (
          cards.map((bf, i) => {
            const card = getCardById(bf.cardId);
            if (!card) return null;
            const isJustDeployed = newlyDeployedCards.has(bf.cardId);
            const isRevealed = !bf.faceDown;
            return (
              <div 
                key={i} 
                className={`transition-all duration-500 ${
                  isJustDeployed ? 'animate-[cardDraw_0.4s_ease-out]' : 
                  isRevealed ? 'animate-[flipIn_0.5s_ease-out]' : ''
                }`}
              >
                <MiniCard 
                  card={card} 
                  faceDown={bf.faceDown}
                  isOnBattlefield
                  onPreview={() => !bf.faceDown && onPreview(card)}
                />
              </div>
            );
          })
        ) : (
          <div className={`text-sm ${isOpponent ? 'text-red-400/50' : 'text-green-400/50'} italic`}>
            No cards deployed
          </div>
        )}
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
  const [previewCard, setPreviewCard] = useState<CardType | null>(null);
  const [previousMyHP, setPreviousMyHP] = useState<number | undefined>(undefined);
  const [previousOpponentHP, setPreviousOpponentHP] = useState<number | undefined>(undefined);
  const [newlyDrawnCards, setNewlyDrawnCards] = useState<Set<string>>(new Set());
  const [newlyDeployedCards, setNewlyDeployedCards] = useState<Set<string>>(new Set());
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const previousHandRef = useRef<string[] | null>(null);
  const previousBattlefieldRef = useRef<string[] | null>(null);
  const lastGameIdRef = useRef<string | null>(null);

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

  const isPlayer1 = game ? game.player1Id === user?.id : false;
  const myHP = game ? (isPlayer1 ? game.player1HP : game.player2HP) : GAME_CONSTANTS.STARTING_HP;
  const opponentHP = game ? (isPlayer1 ? game.player2HP : game.player1HP) : GAME_CONSTANTS.STARTING_HP;
  const myHand = game ? (isPlayer1 ? game.gameState.player1Hand : game.gameState.player2Hand) : [];
  const opponentHandSize = game ? (isPlayer1 ? game.gameState.player2Hand.length : game.gameState.player1Hand.length) : 0;
  const myBattlefield = game ? (isPlayer1 ? game.gameState.player1Battlefield : game.gameState.player2Battlefield) : [];
  const opponentBattlefield = game ? (isPlayer1 ? game.gameState.player2Battlefield : game.gameState.player1Battlefield) : [];
  const myDeckSize = game ? (isPlayer1 ? game.gameState.player1Deck.length : game.gameState.player2Deck.length) : 0;
  const opponentDeckSize = game ? (isPlayer1 ? game.gameState.player2Deck.length : game.gameState.player1Deck.length) : 0;
  const isMyTurn = game ? game.activePlayer === user?.id : false;

  useEffect(() => {
    if (!game) return;
    if (previousMyHP === undefined) {
      setPreviousMyHP(myHP);
    } else if (myHP !== previousMyHP) {
      const timer = setTimeout(() => setPreviousMyHP(myHP), 600);
      return () => clearTimeout(timer);
    }
  }, [myHP, previousMyHP, game]);

  useEffect(() => {
    if (!game) return;
    if (previousOpponentHP === undefined) {
      setPreviousOpponentHP(opponentHP);
    } else if (opponentHP !== previousOpponentHP) {
      const timer = setTimeout(() => setPreviousOpponentHP(opponentHP), 600);
      return () => clearTimeout(timer);
    }
  }, [opponentHP, previousOpponentHP, game]);

  useEffect(() => {
    if (!game || !gameId) return;
    
    if (lastGameIdRef.current !== gameId) {
      lastGameIdRef.current = gameId;
      previousHandRef.current = myHand;
      previousBattlefieldRef.current = myBattlefield.map(bf => bf.cardId);
      return;
    }
    
    const currentHand = myHand;
    const previousHand = previousHandRef.current || [];
    const newCards = currentHand.filter(id => !previousHand.includes(id));
    if (newCards.length > 0) {
      setNewlyDrawnCards(new Set(newCards));
      const timer = setTimeout(() => setNewlyDrawnCards(new Set()), 500);
      previousHandRef.current = currentHand;
      return () => clearTimeout(timer);
    }
    previousHandRef.current = currentHand;
  }, [myHand, game, gameId]);

  useEffect(() => {
    if (!game || !gameId) return;
    if (lastGameIdRef.current !== gameId) return;
    
    const currentBattlefield = myBattlefield.map(bf => bf.cardId);
    const previousBattlefield = previousBattlefieldRef.current || [];
    const newDeployed = currentBattlefield.filter(id => !previousBattlefield.includes(id));
    if (newDeployed.length > 0) {
      setNewlyDeployedCards(new Set(newDeployed));
      const timer = setTimeout(() => setNewlyDeployedCards(new Set()), 600);
      previousBattlefieldRef.current = currentBattlefield;
      return () => clearTimeout(timer);
    }
    previousBattlefieldRef.current = currentBattlefield;
  }, [myBattlefield, game, gameId]);

  if (isLoading || !game) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent pointer-events-none" />
      
      <div className="max-w-6xl mx-auto space-y-3 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AnimatedHPBar current={opponentHP} max={GAME_CONSTANTS.STARTING_HP} isPlayer={false} label="Opponent" previousHP={previousOpponentHP} />
            {isMultiplayer && spectatorCount > 0 && (
              <Badge variant="outline" className="text-purple-300 border-purple-500/30">
                <Eye className="w-3 h-3 mr-1" />
                {spectatorCount} watching
              </Badge>
            )}
          </div>
          <PhaseIndicator currentPhase={game.currentPhase} isMyTurn={isMyTurn} turn={game.currentTurn} />
          <div className="flex items-center gap-3">
            <AnimatedHPBar current={myHP} max={GAME_CONSTANTS.STARTING_HP} isPlayer={true} label="You" previousHP={previousMyHP} />
            <div className="flex items-center gap-2">
              {isMultiplayer && (
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => setChatOpen(!chatOpen)}
                  data-testid="button-toggle-chat"
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => navigate(isMultiplayer ? "/lobby" : "/practice")}>
                Leave
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/30 rounded-xl border border-purple-500/10 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-purple-300 text-xs font-medium uppercase tracking-wider">Opponent's Hand</span>
            <div className="flex items-center gap-2 text-xs text-purple-400">
              <span>{opponentHandSize} cards</span>
              <span className="opacity-50">|</span>
              <span>Deck: {opponentDeckSize}</span>
            </div>
          </div>
          <div className="flex gap-1.5 justify-center min-h-[80px] items-center">
            {Array(Math.min(opponentHandSize, 10)).fill(0).map((_, i) => (
              <div 
                key={i} 
                className="w-10 h-16 rounded-lg bg-gradient-to-br from-purple-800 to-purple-950 border border-purple-500/30 shadow-lg transform transition-all hover:-translate-y-1"
                style={{ transform: `rotate(${(i - Math.floor(opponentHandSize / 2)) * 2}deg)` }}
              />
            ))}
            {opponentHandSize > 10 && (
              <Badge variant="secondary" className="text-xs">+{opponentHandSize - 10}</Badge>
            )}
          </div>
        </div>

        <BattlefieldZone 
          cards={opponentBattlefield} 
          isOpponent={true} 
          allCards={allCards}
          onPreview={setPreviewCard}
        />

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

        <BattlefieldZone 
          cards={myBattlefield} 
          isOpponent={false} 
          allCards={allCards}
          onPreview={setPreviewCard}
          newlyDeployedCards={newlyDeployedCards}
        />

        <div className="bg-gradient-to-t from-green-900/10 to-slate-800/30 rounded-xl border-2 border-green-500/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-green-300 text-xs font-medium uppercase tracking-wider">Your Hand</span>
            <div className="flex items-center gap-2 text-xs text-green-400">
              <span className="font-medium">{myHand.length} cards</span>
              <span className="opacity-50">|</span>
              <span>Deck: {myDeckSize}</span>
              {game.currentPhase === "deployment" && isMyTurn && (
                <Badge className="bg-purple-500/50 text-xs ml-2">
                  Select {GAME_CONSTANTS.CARDS_TO_DEPLOY - selectedCards.length} more
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap justify-center min-h-[100px] items-center">
            {myHand.map((cardId) => {
              const card = getCardById(cardId);
              if (!card) return null;
              const isPlayable = game.currentPhase === "deployment" && isMyTurn;
              return (
                <MiniCard 
                  key={cardId} 
                  card={card} 
                  selected={selectedCards.includes(cardId)}
                  playable={isPlayable && !selectedCards.includes(cardId) && selectedCards.length < GAME_CONSTANTS.CARDS_TO_DEPLOY}
                  isNewlyPlayed={newlyDrawnCards.has(cardId)}
                  onClick={() => handleCardSelect(cardId)}
                  onPreview={() => setPreviewCard(card)}
                />
              );
            })}
            {myHand.length === 0 && (
              <div className="text-green-400/50 text-sm italic">No cards in hand</div>
            )}
          </div>
        </div>
      </div>

      <CardPreviewDialog 
        card={previewCard} 
        open={!!previewCard} 
        onClose={() => setPreviewCard(null)} 
      />

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
          <div className="p-2 border-t border-purple-500/20">
            <div className="flex gap-1 mb-2 flex-wrap">
              {[
                { icon: Trophy, text: "GG" },
                { icon: Swords, text: "Nice!" },
                { icon: Heart, text: "Thanks" },
                { icon: RotateCcw, text: "Thinking" },
                { icon: Flag, text: "Hurry!" },
                { icon: Shield, text: "Sorry" },
              ].map((emote) => {
                const Icon = emote.icon;
                return (
                  <Button
                    key={emote.text}
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs hover:bg-purple-500/20 gap-1"
                    onClick={() => {
                      sendGameMessage(gameId!, emote.text);
                      const newMsg: ChatMessage = {
                        id: Date.now().toString(),
                        message: emote.text,
                        senderId: user?.id || "",
                        senderName: user?.firstName || "You",
                        createdAt: new Date().toISOString(),
                      };
                      setChatMessages((prev) => [...prev, newMsg]);
                    }}
                    data-testid={`emote-${emote.text.toLowerCase().replace(/[^a-z]/g, '')}`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{emote.text}</span>
                  </Button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                className="bg-slate-900/50 border-purple-500/30 text-white text-sm h-8"
                data-testid="input-game-chat"
              />
              <Button 
                size="icon" 
                className="h-8 w-8"
                onClick={handleSendChat}
                disabled={!chatMessage.trim()}
                data-testid="button-send-game-chat"
              >
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
