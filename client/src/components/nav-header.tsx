/**
 * DROPDOWN NAVIGATION HEADER
 * 
 * Replaces the sidebar with a compact header bar.
 * Logo on left (clickable for dropdown menu), title next to it, theme toggle on right.
 * 
 * TO REVERT TO SIDEBAR:
 * 1. In App.tsx, replace <NavHeader /> with the old GameSidebar + SidebarProvider setup
 * 2. Delete this file
 */

import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  Home, BookOpen, Database, Layers, Swords, Trophy, User, GraduationCap, 
  LogIn, LogOut, Users, Gamepad2, Medal, Calendar, BarChart3, Eye, 
  BookMarked, Palette, ImageIcon, ChevronDown, X, UserCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
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
  { title: "About the Creator", url: "/about", icon: UserCircle },
];

export function NavHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [location] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    enabled: isAuthenticated,
  });

  const displayName = user?.firstName 
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
    : user?.email?.split('@')[0] || 'Player';

  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close menu when navigating
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location]);

  const NavGroup = ({ label, items, labelColor = "text-purple-400" }: { 
    label: string; 
    items: { title: string; url: string; icon: React.ElementType }[];
    labelColor?: string;
  }) => (
    <div className="mb-3 landscape-mobile:mb-2">
      <p className={`text-xs font-semibold uppercase tracking-wider mb-2 landscape-mobile:mb-1 ${labelColor}`}>{label}</p>
      <div className="space-y-1 landscape-mobile:space-y-0 landscape-mobile:grid landscape-mobile:grid-cols-2 landscape-mobile:gap-1">
        {items.map((item) => (
          <Link key={item.title} href={item.url}>
            <div
              className={`flex items-center gap-3 landscape-mobile:gap-2 px-3 py-2 landscape-mobile:py-1.5 rounded-lg cursor-pointer hover-elevate active-elevate-2
                ${location === item.url 
                  ? 'bg-purple-600/30 text-white' 
                  : 'text-purple-200'
                }`}
              data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <item.icon className="w-4 h-4 landscape-mobile:w-3.5 landscape-mobile:h-3.5" />
              <span className="text-sm landscape-mobile:text-xs">{item.title}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <header className="sticky top-0 z-[9999] flex items-center justify-between gap-4 border-b border-purple-500/20 px-4 py-2 landscape-mobile:py-1 landscape-mobile:px-2 bg-slate-900/95 backdrop-blur">
      {/* Left side: Logo + Title */}
      <div className="relative flex items-center gap-3 landscape-mobile:gap-2" ref={menuRef}>
        {/* Clickable Logo */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="flex items-center gap-3 landscape-mobile:gap-2 hover-elevate rounded-lg p-1 pr-3 landscape-mobile:pr-2 transition-all"
          data-testid="button-nav-menu"
        >
          <div className="w-10 h-10 landscape-mobile:w-7 landscape-mobile:h-7 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Swords className="w-6 h-6 landscape-mobile:w-4 landscape-mobile:h-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-bold text-white text-lg landscape-mobile:text-sm leading-tight">Wisdom & Chance</h1>
            <p className="text-xs text-purple-300 landscape-mobile:hidden">TCG</p>
          </div>
          <ChevronDown className={`w-4 h-4 landscape-mobile:w-3 landscape-mobile:h-3 text-purple-400 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <div className="absolute top-full left-0 mt-2 w-72 landscape-mobile:w-[90vw] landscape-mobile:max-w-lg max-h-[80vh] landscape-mobile:max-h-[70vh] overflow-y-auto bg-slate-900 border border-purple-500/30 rounded-xl shadow-2xl shadow-purple-900/50 p-4 landscape-mobile:p-3 z-[9999]">
            {/* Close button for mobile */}
            <button
              onClick={() => setIsMenuOpen(false)}
              className="absolute top-2 right-2 p-1 text-purple-400 hover-elevate rounded sm:hidden"
              data-testid="button-close-menu"
            >
              <X className="w-5 h-5" />
            </button>

            <NavGroup label="Navigation" items={menuItems} />
            <NavGroup label="Play" items={playItems} />
            <NavGroup label="Progress" items={progressItems} />
            <NavGroup label="Lore" items={loreItems} />

            {adminCheck?.isAdmin && (
              <NavGroup 
                label="Admin" 
                items={[
                  { title: "Card Art Generator", url: "/admin/card-art", icon: Palette },
                  { title: "Image Database", url: "/admin/image-database", icon: ImageIcon },
                  { title: "User Database", url: "/admin/user-database", icon: Users },
                ]} 
                labelColor="text-amber-400"
              />
            )}

            {/* User section */}
            <div className="border-t border-purple-500/20 pt-3 mt-3">
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
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full border-purple-500/30 text-purple-200"
                    data-testid="button-logout"
                    onClick={() => { window.location.href = "/api/logout"; }}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-purple-300">
                    <User className="w-4 h-4" />
                    <span>Guest Player</span>
                  </div>
                  <Button 
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                    data-testid="button-login"
                    onClick={() => { window.location.href = "/api/login"; }}
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In with Google
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right side: Title (mobile visible) + Theme Toggle */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-purple-300 hidden md:block">Wisdom & Chance TCG</span>
        <ThemeToggle />
      </div>
    </header>
  );
}
