import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Home, BookOpen, Database, Layers, Swords, Trophy, User, GraduationCap, LogIn, LogOut, Users, Gamepad2, Medal, Calendar, Crown, BarChart3, Eye, BookMarked } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";

const menuItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Rules", url: "/rules", icon: BookOpen },
  { title: "Tutorial", url: "/tutorial", icon: GraduationCap },
  { title: "Card Database", url: "/cards", icon: Database },
  { title: "Deck Builder", url: "/deck-builder", icon: Layers },
];

const playItems = [
  { title: "Practice", url: "/practice", icon: Swords },
  { title: "Multiplayer", url: "/lobby", icon: Gamepad2 },
  { title: "Live Matches", url: "/live-matches", icon: Eye },
  { title: "Friends", url: "/friends", icon: Users },
];

const progressItems = [
  { title: "Achievements", url: "/achievements", icon: Trophy },
  { title: "Leaderboard", url: "/leaderboard", icon: Medal },
  { title: "Daily Challenges", url: "/challenges", icon: Calendar },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Profile", url: "/profile", icon: User },
];

const loreItems = [
  { title: "Lore Archives", url: "/lore", icon: BookMarked },
];

export function GameSidebar() {
  const [location] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();

  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    enabled: isAuthenticated,
  });

  const displayName = user?.firstName 
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
    : user?.email?.split('@')[0] || 'Player';

  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Sidebar className="border-r border-purple-500/20">
      <SidebarHeader className="border-b border-purple-500/20 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Swords className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg leading-tight">Wisdom</h1>
            <p className="text-xs text-purple-300">& Chance TCG</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="text-purple-400">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-purple-400">Play</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {playItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-purple-400">Progress</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {progressItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-purple-400">Lore</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {loreItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {adminCheck?.isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-amber-400">Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === "/admin/card-art"}
                    data-testid="nav-admin-card-art"
                  >
                    <Link href="/admin/card-art">
                      <Crown className="w-4 h-4" />
                      <span>Card Art Generator</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-purple-500/20 p-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-purple-300">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 animate-pulse" />
            <span>Loading...</span>
          </div>
        ) : isAuthenticated && user ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                {user.profileImageUrl && <AvatarImage src={user.profileImageUrl} alt={displayName} />}
                <AvatarFallback className="bg-purple-600 text-white text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{displayName}</p>
                <p className="text-xs text-purple-400 truncate">{user.email}</p>
              </div>
            </div>
            <a href="/api/logout" data-testid="button-logout">
              <Button variant="outline" size="sm" className="w-full border-purple-500/30 text-purple-200 hover:bg-purple-500/20">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-purple-300">
              <User className="w-4 h-4" />
              <span>Guest Player</span>
            </div>
            <a href="/api/login" data-testid="button-login">
              <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600">
                <LogIn className="w-4 h-4 mr-2" />
                Sign In with Google
              </Button>
            </a>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
