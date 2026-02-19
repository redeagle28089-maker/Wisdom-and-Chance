import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Users,
  Circle,
  UserPlus,
  Search,
  Shield,
  LogIn,
} from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  createdAt: string;
  isOnline: boolean;
}

function getDisplayName(user: { firstName: string | null; lastName: string | null; email: string }): string {
  if (user.firstName) {
    return `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`;
  }
  return user.email?.split("@")[0] || "Unknown";
}

function getInitials(user: { firstName: string | null; lastName: string | null; email: string }): string {
  const name = getDisplayName(user);
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function AdminUserDatabasePage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    enabled: isAuthenticated,
  });

  const { data: allUsers = [], isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAuthenticated && adminCheck?.isAdmin === true,
    refetchInterval: 15000,
  });

  const forceAddFriendMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const res = await apiRequest("POST", "/api/admin/force-add-friend", { targetUserId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      toast({ title: "Friend added successfully" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to add friend", variant: "destructive" });
    },
  });

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
            <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Sign In Required</h2>
            <p className="text-purple-200 mb-6">Admin access only.</p>
            <Button
              className="bg-gradient-to-r from-purple-600 to-pink-600"
              data-testid="button-login"
              onClick={() => { window.location.href = "/api/login"; }}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (adminCheck && !adminCheck.isAdmin) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-red-500/20 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-purple-200">This page is restricted to administrators.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredUsers = allUsers.filter((u) => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    return (
      u.email.toLowerCase().includes(term) ||
      (u.firstName || "").toLowerCase().includes(term) ||
      (u.lastName || "").toLowerCase().includes(term)
    );
  });

  const onlineUsers = filteredUsers.filter((u) => u.isOnline);
  const offlineUsers = filteredUsers.filter((u) => !u.isOnline);

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3" data-testid="text-admin-users-title">
              <Shield className="w-8 h-8 text-red-400" />
              User Database
            </h1>
            <p className="text-purple-200">
              {allUsers.length} total players - {onlineUsers.length} online
            </p>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-400" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-800/50 border-purple-500/30 text-white"
            data-testid="input-search-users"
          />
        </div>

        {usersLoading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-purple-200">Loading users...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {onlineUsers.length > 0 && (
              <Card className="bg-slate-800/50 border-green-500/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Circle className="w-4 h-4 text-green-500 fill-green-500" />
                    Online ({onlineUsers.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {onlineUsers.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      onForceAdd={() => forceAddFriendMutation.mutate(user.id)}
                      isPending={forceAddFriendMutation.isPending}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className="bg-slate-800/50 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  {onlineUsers.length > 0 ? `Offline (${offlineUsers.length})` : `All Players (${filteredUsers.length})`}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(onlineUsers.length > 0 ? offlineUsers : filteredUsers).length === 0 ? (
                  <p className="text-purple-300 text-center py-4">No players found</p>
                ) : (
                  (onlineUsers.length > 0 ? offlineUsers : filteredUsers).map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      onForceAdd={() => forceAddFriendMutation.mutate(user.id)}
                      isPending={forceAddFriendMutation.isPending}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function UserRow({ user, onForceAdd, isPending }: { user: AdminUser; onForceAdd: () => void; isPending: boolean }) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-slate-900/50 border border-purple-500/10"
      data-testid={`user-row-${user.id}`}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar>
            {user.profileImageUrl && <AvatarImage src={user.profileImageUrl} />}
            <AvatarFallback className="bg-purple-600 text-white">
              {getInitials(user)}
            </AvatarFallback>
          </Avatar>
          {user.isOnline && (
            <Circle className="absolute bottom-0 right-0 w-3 h-3 text-green-500 fill-green-500" />
          )}
        </div>
        <div>
          <p className="text-white font-medium">{getDisplayName(user)}</p>
          <p className="text-purple-400 text-sm">{user.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={user.isOnline ? "default" : "secondary"} className="text-xs">
          {user.isOnline ? "Online" : "Offline"}
        </Badge>
        <Button
          size="sm"
          variant="outline"
          onClick={onForceAdd}
          disabled={isPending}
          data-testid={`button-force-add-${user.id}`}
        >
          <UserPlus className="w-4 h-4 mr-1" />
          Add Friend
        </Button>
      </div>
    </div>
  );
}
