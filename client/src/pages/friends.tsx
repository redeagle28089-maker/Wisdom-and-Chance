import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { 
  Users, 
  UserPlus, 
  Check, 
  X, 
  Mail, 
  LogIn,
  Circle,
  Clock,
  UserX,
  Search
} from "lucide-react";
import { useEffect } from "react";

interface Friend {
  id: string;
  friendId: string;
  createdAt: string;
  friend: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
  isOnline: boolean;
}

interface FriendRequest {
  id: string;
  senderId?: string;
  receiverId?: string;
  status: string;
  createdAt: string;
  sender?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
  receiver?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
}

function getDisplayName(user: { firstName: string | null; lastName: string | null; email: string } | null | undefined): string {
  if (!user) return "Unknown";
  if (user.firstName) {
    return `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`;
  }
  return user.email?.split('@')[0] || "Unknown";
}

function getInitials(user: { firstName: string | null; lastName: string | null; email: string } | null | undefined): string {
  if (!user) return "?";
  const name = getDisplayName(user);
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function FriendsPage() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { subscribe } = useWebSocket();
  const [addFriendEmail, setAddFriendEmail] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { data: friends = [], refetch: refetchFriends } = useQuery<Friend[]>({
    queryKey: ["/api/friends"],
    enabled: isAuthenticated,
  });

  const { data: requests } = useQuery<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>({
    queryKey: ["/api/friend-requests"],
    enabled: isAuthenticated,
  });

  const sendRequestMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/friend-requests", { email });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friend-requests"] });
      toast({ title: "Friend request sent!" });
      setAddFriendEmail("");
      setIsAddDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to send friend request", variant: "destructive" });
    },
  });

  const acceptRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/friend-requests/${id}/accept`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friend-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      toast({ title: "Friend request accepted!" });
    },
    onError: () => {
      toast({ title: "Failed to accept request", variant: "destructive" });
    },
  });

  const declineRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/friend-requests/${id}/decline`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friend-requests"] });
      toast({ title: "Friend request declined" });
    },
    onError: () => {
      toast({ title: "Failed to decline request", variant: "destructive" });
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: async (friendId: string) => {
      const res = await apiRequest("DELETE", `/api/friends/${friendId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      toast({ title: "Friend removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove friend", variant: "destructive" });
    },
  });

  useEffect(() => {
    const unsubscribe = subscribe("presence_update", () => {
      refetchFriends();
    });
    return unsubscribe;
  }, [subscribe, refetchFriends]);

  useEffect(() => {
    const unsubscribe = subscribe("friend_request", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friend-requests"] });
      toast({ title: "New friend request received!" });
    });
    return unsubscribe;
  }, [subscribe, toast]);

  useEffect(() => {
    const unsubscribe = subscribe("friend_request_accepted", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      toast({ title: "Friend request was accepted!" });
    });
    return unsubscribe;
  }, [subscribe, toast]);

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
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Users className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Sign In to View Friends</h2>
            <p className="text-purple-200 mb-6">Sign in to add friends and see who's online.</p>
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

  const onlineFriends = friends.filter(f => f.isOnline);
  const offlineFriends = friends.filter(f => !f.isOnline);
  const incomingRequests = requests?.incoming || [];
  const outgoingRequests = requests?.outgoing || [];

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2" data-testid="text-friends-title">Friends</h1>
            <p className="text-purple-200">Manage your friends list</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600" data-testid="button-add-friend">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Friend
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-purple-500/20">
              <DialogHeader>
                <DialogTitle className="text-white">Add Friend</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-400" />
                  <Input
                    placeholder="Enter friend's email"
                    value={addFriendEmail}
                    onChange={(e) => setAddFriendEmail(e.target.value)}
                    className="pl-10 bg-slate-900/50 border-purple-500/30 text-white"
                    data-testid="input-friend-email"
                  />
                </div>
                <Button 
                  onClick={() => sendRequestMutation.mutate(addFriendEmail)}
                  disabled={!addFriendEmail || sendRequestMutation.isPending}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                  data-testid="button-send-request"
                >
                  {sendRequestMutation.isPending ? "Sending..." : "Send Friend Request"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {incomingRequests.length > 0 && (
          <Card className="bg-slate-800/50 border-yellow-500/30 mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-400" />
                Pending Requests ({incomingRequests.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {incomingRequests.map((request) => (
                <div 
                  key={request.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-yellow-500/20"
                  data-testid={`friend-request-${request.id}`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      {request.sender?.profileImageUrl && (
                        <AvatarImage src={request.sender.profileImageUrl} />
                      )}
                      <AvatarFallback className="bg-purple-600 text-white">
                        {getInitials(request.sender)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-white font-medium">{getDisplayName(request.sender)}</p>
                      <p className="text-purple-400 text-sm">{request.sender?.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => acceptRequestMutation.mutate(request.id)}
                      disabled={acceptRequestMutation.isPending}
                      data-testid={`button-accept-${request.id}`}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                      onClick={() => declineRequestMutation.mutate(request.id)}
                      disabled={declineRequestMutation.isPending}
                      data-testid={`button-decline-${request.id}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {outgoingRequests.length > 0 && (
          <Card className="bg-slate-800/50 border-blue-500/20 mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-400" />
                Sent Requests ({outgoingRequests.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {outgoingRequests.map((request) => (
                <div 
                  key={request.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-blue-500/20"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      {request.receiver?.profileImageUrl && (
                        <AvatarImage src={request.receiver.profileImageUrl} />
                      )}
                      <AvatarFallback className="bg-blue-600 text-white">
                        {getInitials(request.receiver)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-white font-medium">{getDisplayName(request.receiver)}</p>
                      <p className="text-purple-400 text-sm">{request.receiver?.email}</p>
                    </div>
                  </div>
                  <Badge variant="secondary">Pending</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-slate-800/50 border-green-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Circle className="w-4 h-4 text-green-500 fill-green-500" />
                Online ({onlineFriends.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {onlineFriends.length === 0 ? (
                <p className="text-purple-300 text-center py-4">No friends online</p>
              ) : (
                <div className="space-y-3">
                  {onlineFriends.map((friend) => (
                    <div 
                      key={friend.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-green-500/20"
                      data-testid={`friend-${friend.friendId}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar>
                            {friend.friend?.profileImageUrl && (
                              <AvatarImage src={friend.friend.profileImageUrl} />
                            )}
                            <AvatarFallback className="bg-purple-600 text-white">
                              {getInitials(friend.friend)}
                            </AvatarFallback>
                          </Avatar>
                          <Circle className="absolute bottom-0 right-0 w-3 h-3 text-green-500 fill-green-500" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{getDisplayName(friend.friend)}</p>
                          <Badge variant="secondary" className="text-xs">Online</Badge>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                        onClick={() => removeFriendMutation.mutate(friend.friendId)}
                        data-testid={`button-remove-${friend.friendId}`}
                      >
                        <UserX className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Circle className="w-4 h-4 text-gray-500" />
                Offline ({offlineFriends.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {offlineFriends.length === 0 ? (
                <p className="text-purple-300 text-center py-4">No offline friends</p>
              ) : (
                <div className="space-y-3">
                  {offlineFriends.map((friend) => (
                    <div 
                      key={friend.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-purple-500/20"
                      data-testid={`friend-${friend.friendId}`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="opacity-70">
                          {friend.friend?.profileImageUrl && (
                            <AvatarImage src={friend.friend.profileImageUrl} />
                          )}
                          <AvatarFallback className="bg-purple-600 text-white">
                            {getInitials(friend.friend)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-white/70 font-medium">{getDisplayName(friend.friend)}</p>
                          <Badge variant="secondary" className="text-xs opacity-70">Offline</Badge>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                        onClick={() => removeFriendMutation.mutate(friend.friendId)}
                        data-testid={`button-remove-${friend.friendId}`}
                      >
                        <UserX className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {friends.length === 0 && incomingRequests.length === 0 && outgoingRequests.length === 0 && (
          <Card className="bg-slate-800/50 border-purple-500/20 mt-6">
            <CardContent className="p-8 text-center">
              <Users className="w-16 h-16 text-purple-400/50 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">No Friends Yet</h2>
              <p className="text-purple-300 mb-4">Add friends to play multiplayer games together!</p>
              <Button 
                onClick={() => setIsAddDialogOpen(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Your First Friend
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
