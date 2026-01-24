import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { 
  Users, 
  Check, 
  X, 
  Swords,
  LogOut,
  Crown,
  Send,
  Layers,
  Play,
  Clock,
  Eye
} from "lucide-react";
import type { Deck, Commander, Element, InsertGame, Game, GameState } from "@shared/schema";
import { GAME_CONSTANTS } from "@shared/schema";
import { createCardInstances } from "@/lib/card-utils";

interface RoomDetails {
  id: string;
  name: string;
  hostId: string;
  guestId: string | null;
  isPrivate: boolean;
  status: string;
  hostDeckId: string | null;
  guestDeckId: string | null;
  hostReady: boolean;
  guestReady: boolean;
  gameId: string | null;
  host: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
  guest: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  } | null;
  spectators: {
    id: string;
    userId: string;
    user: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      profileImageUrl: string | null;
    };
  }[];
}

interface ChatMessage {
  id: string;
  message: string;
  createdAt: string;
  sender: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
}

function getDisplayName(user: { firstName: string | null; lastName: string | null; email?: string } | null | undefined): string {
  if (!user) return "Unknown";
  if (user.firstName) {
    return `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`;
  }
  return user.email?.split('@')[0] || "Player";
}

function getInitials(user: { firstName: string | null; lastName: string | null } | null | undefined): string {
  if (!user) return "?";
  const name = getDisplayName(user);
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function RoomPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/room/:id");
  const [, navigate] = useLocation();
  const roomId = params?.id;
  const { user, isAuthenticated } = useAuth();
  const { joinRoom, leaveRoom, subscribe, sendRoomMessage } = useWebSocket();

  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const { data: room, refetch: refetchRoom } = useQuery<RoomDetails>({
    queryKey: ["/api/rooms", roomId],
    enabled: !!roomId,
    refetchInterval: 3000,
  });

  const { data: decks = [] } = useQuery<Deck[]>({
    queryKey: ["/api/decks"],
    enabled: isAuthenticated,
  });

  const { data: allCards = [] } = useQuery<any[]>({
    queryKey: ["/api/cards"],
  });

  const { data: initialMessages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/rooms", roomId, "messages"],
    enabled: !!roomId,
  });

  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  useEffect(() => {
    if (roomId) {
      joinRoom(roomId);
    }
    return () => {
      if (roomId) {
        leaveRoom(roomId);
      }
    };
  }, [roomId, joinRoom, leaveRoom]);

  useEffect(() => {
    const unsubscribe = subscribe("chat_message", (msg) => {
      if (msg.payload?.roomId === roomId) {
        setMessages((prev) => [...prev, {
          id: Date.now().toString(),
          message: msg.payload.message,
          createdAt: msg.payload.createdAt,
          sender: { id: msg.payload.senderId, firstName: null, lastName: null, profileImageUrl: null },
        }]);
      }
    });
    return unsubscribe;
  }, [subscribe, roomId]);

  useEffect(() => {
    const unsubscribe = subscribe("player_joined", () => {
      refetchRoom();
      toast({ title: "A player joined the room!" });
    });
    return unsubscribe;
  }, [subscribe, refetchRoom, toast]);

  useEffect(() => {
    const unsubscribe = subscribe("player_left", () => {
      refetchRoom();
      toast({ title: "A player left the room" });
    });
    return unsubscribe;
  }, [subscribe, refetchRoom, toast]);

  useEffect(() => {
    const unsubscribe = subscribe("player_ready_update", () => {
      refetchRoom();
    });
    return unsubscribe;
  }, [subscribe, refetchRoom]);

  useEffect(() => {
    const unsubscribe = subscribe("game_start", (msg) => {
      if (msg.payload?.gameId) {
        navigate(`/game/${msg.payload.gameId}`);
      }
    });
    return unsubscribe;
  }, [subscribe, navigate]);

  const leaveRoomMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/rooms/${roomId}/leave`);
      return res.json();
    },
    onSuccess: () => {
      navigate("/lobby");
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to leave room", variant: "destructive" });
    },
  });

  const setReadyMutation = useMutation({
    mutationFn: async ({ ready, deckId }: { ready: boolean; deckId?: string }) => {
      const res = await apiRequest("POST", `/api/rooms/${roomId}/ready`, { ready, deckId });
      return res.json();
    },
    onSuccess: () => {
      refetchRoom();
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to update ready status", variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", `/api/rooms/${roomId}/messages`, { message });
      return res.json();
    },
    onSuccess: () => {
      setChatMessage("");
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to send message", variant: "destructive" });
    },
  });

  const startGameMutation = useMutation({
    mutationFn: async () => {
      if (!room || !room.hostDeckId || !room.guestDeckId) {
        throw new Error("Both players need to select a deck");
      }

      const hostDeck = decks.find(d => d.id === room.hostDeckId);
      const guestDeck = decks.find(d => d.id === room.guestDeckId);

      if (!hostDeck || !guestDeck) {
        throw new Error("Could not find selected decks");
      }

      const player1Deck = shuffleArray(createCardInstances([...hostDeck.cardIds]));
      const player2Deck = shuffleArray(createCardInstances([...guestDeck.cardIds]));

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
        player1Id: room.hostId,
        player2Id: room.guestId,
        player1DeckId: room.hostDeckId,
        player2DeckId: room.guestDeckId,
        player1HP: GAME_CONSTANTS.STARTING_HP,
        player2HP: GAME_CONSTANTS.STARTING_HP,
        player1VictoryPoints: 0,
        player2VictoryPoints: 0,
        player1WithdrawalPoints: 0,
        player2WithdrawalPoints: 0,
        currentPhase: "draw",
        currentTurn: 1,
        activePlayer: room.hostId,
        status: "in_progress",
        gameType: "multiplayer",
        aiDifficulty: null,
        winnerId: null,
        gameState: initialGameState,
        gameHistory: [],
      };

      const res = await apiRequest("POST", "/api/games", gameData);
      return res.json() as Promise<Game>;
    },
    onSuccess: (game) => {
      sendRoomMessage(roomId!, `Game started!`);
      navigate(`/game/${game.id}`);
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to start game", variant: "destructive" });
    },
  });

  const handleReadyToggle = () => {
    if (!isReady && !selectedDeckId) {
      toast({ title: "Please select a deck first", variant: "destructive" });
      return;
    }
    const newReady = !isReady;
    setIsReady(newReady);
    setReadyMutation.mutate({ ready: newReady, deckId: selectedDeckId || undefined });
  };

  const handleSendMessage = () => {
    if (chatMessage.trim()) {
      sendMessageMutation.mutate(chatMessage.trim());
    }
  };

  const playerDecks = decks.filter(d => d.playerId === user?.id);
  const isHost = room?.hostId === user?.id;
  const isGuest = room?.guestId === user?.id;
  const isSpectator = !isHost && !isGuest;
  const canStart = room?.hostReady && room?.guestReady && isHost;

  if (!room) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1" data-testid="text-room-name">{room.name}</h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{room.status}</Badge>
              {isSpectator && <Badge className="bg-cyan-600">Spectating</Badge>}
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => leaveRoomMutation.mutate()}
            disabled={leaveRoomMutation.isPending}
            data-testid="button-leave-room"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Leave Room
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Card className={`bg-slate-800/50 ${room.hostReady ? 'border-green-500/50' : 'border-purple-500/20'}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-white flex items-center gap-2 text-base">
                    <Crown className="w-4 h-4 text-yellow-400" />
                    Host
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      {room.host?.profileImageUrl && <AvatarImage src={room.host.profileImageUrl} />}
                      <AvatarFallback className="bg-purple-600 text-white">
                        {getInitials(room.host)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-white font-medium">{getDisplayName(room.host)}</p>
                      {room.hostReady ? (
                        <Badge className="bg-green-600 text-xs">Ready</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Not Ready</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`bg-slate-800/50 ${room.guestReady ? 'border-green-500/50' : 'border-purple-500/20'}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-white flex items-center gap-2 text-base">
                    <Users className="w-4 h-4 text-blue-400" />
                    Opponent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {room.guest ? (
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        {room.guest?.profileImageUrl && <AvatarImage src={room.guest.profileImageUrl} />}
                        <AvatarFallback className="bg-blue-600 text-white">
                          {getInitials(room.guest)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-white font-medium">{getDisplayName(room.guest)}</p>
                        {room.guestReady ? (
                          <Badge className="bg-green-600 text-xs">Ready</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Not Ready</Badge>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-purple-400">
                      <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center">
                        <Clock className="w-6 h-6" />
                      </div>
                      <p>Waiting for opponent...</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {(isHost || isGuest) && (
              <Card className="bg-slate-800/50 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-purple-400" />
                    Select Your Deck
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {playerDecks.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-purple-300 mb-4">You need a deck to play!</p>
                      <Button onClick={() => navigate("/deck-builder")}>
                        Build a Deck
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Select value={selectedDeckId || ""} onValueChange={setSelectedDeckId}>
                        <SelectTrigger className="bg-slate-900/50 border-purple-500/30 text-white">
                          <SelectValue placeholder="Choose a deck" />
                        </SelectTrigger>
                        <SelectContent>
                          {playerDecks.map((deck) => (
                            <SelectItem key={deck.id} value={deck.id}>
                              {deck.name} ({deck.cardIds.length} cards)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-3">
                        <Button
                          onClick={handleReadyToggle}
                          disabled={setReadyMutation.isPending}
                          className={isReady ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
                          data-testid="button-ready"
                        >
                          {isReady ? (
                            <>
                              <X className="w-4 h-4 mr-2" />
                              Cancel Ready
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4 mr-2" />
                              Ready Up
                            </>
                          )}
                        </Button>
                        {canStart && (
                          <Button
                            onClick={() => startGameMutation.mutate()}
                            disabled={startGameMutation.isPending}
                            className="bg-gradient-to-r from-red-600 to-orange-600"
                            data-testid="button-start-game"
                          >
                            <Play className="w-4 h-4 mr-2" />
                            {startGameMutation.isPending ? "Starting..." : "Start Game"}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {isSpectator && (
              <Card className="bg-slate-800/50 border-cyan-500/20">
                <CardContent className="p-6 text-center">
                  <Eye className="w-12 h-12 text-cyan-400 mx-auto mb-3" />
                  <h3 className="text-white font-bold text-lg mb-2">You are spectating</h3>
                  <p className="text-purple-300">Waiting for the game to start...</p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card className="bg-slate-800/50 border-purple-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center gap-2 text-base">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  Spectators ({room.spectators?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(room.spectators?.length || 0) === 0 ? (
                  <p className="text-purple-400 text-sm">No spectators</p>
                ) : (
                  <div className="space-y-2">
                    {room.spectators?.map((spec) => (
                      <div key={spec.id} className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          {spec.user?.profileImageUrl && <AvatarImage src={spec.user.profileImageUrl} />}
                          <AvatarFallback className="bg-cyan-600 text-white text-xs">
                            {getInitials(spec.user)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-purple-300 text-sm">{getDisplayName(spec.user)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-purple-500/20 flex flex-col h-80">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base">Chat</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-2">
                    {messages.map((msg) => (
                      <div key={msg.id} className="text-sm">
                        <span className="text-purple-400 font-medium">
                          {getDisplayName(msg.sender)}:
                        </span>{" "}
                        <span className="text-white">{msg.message}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="flex gap-2 mt-3">
                  <Input
                    placeholder="Type a message..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    className="bg-slate-900/50 border-purple-500/30 text-white"
                    data-testid="input-chat"
                  />
                  <Button 
                    size="icon" 
                    onClick={handleSendMessage}
                    disabled={!chatMessage.trim() || sendMessageMutation.isPending}
                    data-testid="button-send-chat"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
