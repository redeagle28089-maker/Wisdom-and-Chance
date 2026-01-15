import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { 
  Users, 
  Plus, 
  Lock, 
  Unlock,
  Swords,
  LogIn,
  RefreshCw,
  Eye,
  User
} from "lucide-react";

interface GameRoom {
  id: string;
  name: string;
  hostId: string;
  guestId: string | null;
  isPrivate: boolean;
  status: string;
  createdAt: string;
  host: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
}

function getDisplayName(user: { firstName: string | null; lastName: string | null } | null | undefined): string {
  if (!user) return "Unknown";
  if (user.firstName) {
    return `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`;
  }
  return "Player";
}

function getInitials(user: { firstName: string | null; lastName: string | null } | null | undefined): string {
  if (!user) return "?";
  const name = getDisplayName(user);
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function LobbyPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [roomPassword, setRoomPassword] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  const { data: rooms = [], refetch, isLoading } = useQuery<GameRoom[]>({
    queryKey: ["/api/rooms"],
    refetchInterval: 5000,
  });

  const createRoomMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/rooms", {
        name: roomName,
        isPrivate,
        password: isPrivate ? roomPassword : undefined,
      });
      return res.json();
    },
    onSuccess: (room) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      toast({ title: "Room created!" });
      setRoomName("");
      setIsPrivate(false);
      setRoomPassword("");
      setIsCreateDialogOpen(false);
      navigate(`/room/${room.id}`);
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to create room", variant: "destructive" });
    },
  });

  const joinRoomMutation = useMutation({
    mutationFn: async ({ roomId, password }: { roomId: string; password?: string }) => {
      const res = await apiRequest("POST", `/api/rooms/${roomId}/join`, { password });
      return res.json();
    },
    onSuccess: (room) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      toast({ title: "Joined room!" });
      setJoiningRoomId(null);
      setJoinPassword("");
      navigate(`/room/${room.id}`);
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to join room", variant: "destructive" });
    },
  });

  const spectateRoomMutation = useMutation({
    mutationFn: async (roomId: string) => {
      const res = await apiRequest("POST", `/api/rooms/${roomId}/spectate`);
      return res.json();
    },
    onSuccess: (_, roomId) => {
      toast({ title: "Spectating room" });
      navigate(`/room/${roomId}`);
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to spectate", variant: "destructive" });
    },
  });

  const handleJoinRoom = (room: GameRoom) => {
    if (room.isPrivate) {
      setJoiningRoomId(room.id);
    } else {
      joinRoomMutation.mutate({ roomId: room.id });
    }
  };

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
            <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-orange-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Swords className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Sign In to Play</h2>
            <p className="text-purple-200 mb-6">Sign in to create or join multiplayer rooms.</p>
            <a href="/api/login">
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600" data-testid="button-login">
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  const publicRooms = rooms.filter(r => !r.isPrivate && !r.guestId);
  const allRooms = rooms.filter(r => !r.guestId);

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2" data-testid="text-lobby-title">Game Lobby</h1>
            <p className="text-purple-200">Join a room or create your own</p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => refetch()}
              disabled={isLoading}
              data-testid="button-refresh"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600" data-testid="button-create-room">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Room
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-800 border-purple-500/20">
                <DialogHeader>
                  <DialogTitle className="text-white">Create Room</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label className="text-purple-200">Room Name</Label>
                    <Input
                      placeholder="Enter room name"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      className="mt-2 bg-slate-900/50 border-purple-500/30 text-white"
                      data-testid="input-room-name"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-purple-400" />
                      <Label className="text-purple-200">Private Room</Label>
                    </div>
                    <Switch 
                      checked={isPrivate} 
                      onCheckedChange={setIsPrivate}
                      data-testid="switch-private"
                    />
                  </div>
                  {isPrivate && (
                    <div>
                      <Label className="text-purple-200">Password</Label>
                      <Input
                        type="password"
                        placeholder="Enter room password"
                        value={roomPassword}
                        onChange={(e) => setRoomPassword(e.target.value)}
                        className="mt-2 bg-slate-900/50 border-purple-500/30 text-white"
                        data-testid="input-room-password"
                      />
                    </div>
                  )}
                  <Button 
                    onClick={() => createRoomMutation.mutate()}
                    disabled={!roomName || createRoomMutation.isPending}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                    data-testid="button-create-confirm"
                  >
                    {createRoomMutation.isPending ? "Creating..." : "Create Room"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {joiningRoomId && (
          <Dialog open={true} onOpenChange={() => setJoiningRoomId(null)}>
            <DialogContent className="bg-slate-800 border-purple-500/20">
              <DialogHeader>
                <DialogTitle className="text-white">Enter Room Password</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  className="bg-slate-900/50 border-purple-500/30 text-white"
                  data-testid="input-join-password"
                />
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setJoiningRoomId(null)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => joinRoomMutation.mutate({ roomId: joiningRoomId, password: joinPassword })}
                    disabled={!joinPassword || joinRoomMutation.isPending}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
                    data-testid="button-join-confirm"
                  >
                    {joinRoomMutation.isPending ? "Joining..." : "Join"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {allRooms.length === 0 ? (
          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardContent className="p-8 text-center">
              <Users className="w-16 h-16 text-purple-400/50 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">No Rooms Available</h2>
              <p className="text-purple-300 mb-4">Be the first to create a room!</p>
              <Button 
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Room
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {allRooms.map((room) => (
              <Card 
                key={room.id} 
                className="bg-slate-800/50 border-purple-500/20 hover:border-purple-500/40 transition-all"
                data-testid={`room-${room.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                        <Swords className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-bold text-lg">{room.name}</h3>
                          {room.isPrivate ? (
                            <Lock className="w-4 h-4 text-yellow-400" />
                          ) : (
                            <Unlock className="w-4 h-4 text-green-400" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Avatar className="w-6 h-6">
                            {room.host?.profileImageUrl && (
                              <AvatarImage src={room.host.profileImageUrl} />
                            )}
                            <AvatarFallback className="bg-purple-600 text-white text-xs">
                              {getInitials(room.host)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-purple-300 text-sm">Hosted by {getDisplayName(room.host)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-purple-400" />
                        <span className="text-purple-300">{room.guestId ? "2/2" : "1/2"}</span>
                      </div>
                      {room.hostId === user?.id ? (
                        <Button 
                          onClick={() => navigate(`/room/${room.id}`)}
                          className="bg-gradient-to-r from-green-600 to-emerald-600"
                          data-testid={`button-enter-${room.id}`}
                        >
                          Enter Room
                        </Button>
                      ) : room.guestId ? (
                        <Button 
                          variant="outline"
                          onClick={() => spectateRoomMutation.mutate(room.id)}
                          disabled={spectateRoomMutation.isPending}
                          data-testid={`button-spectate-${room.id}`}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Spectate
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => handleJoinRoom(room)}
                          disabled={joinRoomMutation.isPending}
                          className="bg-gradient-to-r from-purple-600 to-pink-600"
                          data-testid={`button-join-${room.id}`}
                        >
                          Join
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
