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
  Filter,
  Bot,
  FlaskConical,
  Eye,
  EyeOff,
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

const TEST_EMAIL_PATTERNS = ["@test", "@example", "@fake", "@dummy", "@temp", "@sample", "test@", "testing@", "demo@"];

function isTestUser(user: AdminUser): boolean {
  const email = user.email.toLowerCase();
  return TEST_EMAIL_PATTERNS.some((pattern) => email.includes(pattern));
}

function isAiGeneratedUser(user: AdminUser): boolean {
  if (!user.firstName && !user.lastName && !user.profileImageUrl) return true;
  const name = `${user.firstName || ""} ${user.lastName || ""}`.toLowerCase().trim();
  if (!name) return true;
  const genericNames = ["test", "user", "player", "guest", "anonymous", "unknown", "testuser", "test user"];
  if (genericNames.includes(name)) return true;
  return false;
}

export default function AdminUserDatabasePage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [hideTestUsers, setHideTestUsers] = useState(false);
  const [hideAiUsers, setHideAiUsers] = useState(false);

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

  const testUserCount = allUsers.filter(isTestUser).length;
  const aiUserCount = allUsers.filter(isAiGeneratedUser).length;

  const filteredUsers = allUsers.filter((u) => {
    if (hideTestUsers && isTestUser(u)) return false;
    if (hideAiUsers && isAiGeneratedUser(u)) return false;
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

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-400" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-800/50 border-purple-500/30 text-white"
            data-testid="input-search-users"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-6">
          <div className="flex items-center gap-1 text-purple-300 text-sm mr-1">
            <Filter className="w-4 h-4" />
            Filters:
          </div>
          <Button
            size="sm"
            variant={hideTestUsers ? "destructive" : "outline"}
            onClick={() => setHideTestUsers(!hideTestUsers)}
            data-testid="button-filter-test-users"
          >
            {hideTestUsers ? <EyeOff className="w-3.5 h-3.5 mr-1.5" /> : <FlaskConical className="w-3.5 h-3.5 mr-1.5" />}
            {hideTestUsers ? "Test Users Hidden" : `Hide Test Users (${testUserCount})`}
          </Button>
          <Button
            size="sm"
            variant={hideAiUsers ? "secondary" : "outline"}
            onClick={() => setHideAiUsers(!hideAiUsers)}
            data-testid="button-filter-ai-users"
          >
            {hideAiUsers ? <EyeOff className="w-3.5 h-3.5 mr-1.5" /> : <Bot className="w-3.5 h-3.5 mr-1.5" />}
            {hideAiUsers ? "AI/Generic Hidden" : `Hide AI/Generic (${aiUserCount})`}
          </Button>
          {(hideTestUsers || hideAiUsers) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setHideTestUsers(false); setHideAiUsers(false); }}
              data-testid="button-clear-filters"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              Show All
            </Button>
          )}
          {(hideTestUsers || hideAiUsers) && (
            <span className="text-purple-400 text-xs ml-auto">
              Showing {filteredUsers.length} of {allUsers.length} users
            </span>
          )}
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
  const testUser = isTestUser(user);
  const aiUser = isAiGeneratedUser(user);
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
          <div className="flex items-center gap-2">
            <p className="text-white font-medium">{getDisplayName(user)}</p>
            {testUser && (
              <Badge variant="destructive" className="text-xs" data-testid={`badge-test-${user.id}`}>
                <FlaskConical className="w-2.5 h-2.5 mr-0.5" />
                Test
              </Badge>
            )}
            {aiUser && !testUser && (
              <Badge variant="secondary" className="text-xs" data-testid={`badge-ai-${user.id}`}>
                <Bot className="w-2.5 h-2.5 mr-0.5" />
                AI/Generic
              </Badge>
            )}
          </div>
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
