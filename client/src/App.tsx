import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { GameSidebar } from "@/components/game-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import HomePage from "@/pages/home";
import RulesPage from "@/pages/rules";
import CardDatabasePage from "@/pages/card-database";
import DeckBuilderPage from "@/pages/deck-builder";
import PracticePage from "@/pages/practice";
import GameBoardPage from "@/pages/game-board";
import TutorialPage from "@/pages/tutorial";
import ProfilePage from "@/pages/profile";
import FriendsPage from "@/pages/friends";
import LobbyPage from "@/pages/lobby";
import RoomPage from "@/pages/room";
import AchievementsPage from "@/pages/achievements";
import LeaderboardPage from "@/pages/leaderboard";
import DailyChallengesPage from "@/pages/daily-challenges";
import NotFound from "@/pages/not-found";

function AppContent() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
        <GameSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 border-b border-purple-500/20 px-4 py-2 bg-slate-900/80 backdrop-blur">
            <SidebarTrigger data-testid="button-sidebar-toggle" className="text-purple-200 hover:text-white" />
            <div className="flex items-center gap-2">
              <span className="text-sm text-purple-300 hidden md:block">Wisdom & Chance TCG</span>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/" component={HomePage} />
              <Route path="/rules" component={RulesPage} />
              <Route path="/tutorial" component={TutorialPage} />
              <Route path="/cards" component={CardDatabasePage} />
              <Route path="/deck-builder" component={DeckBuilderPage} />
              <Route path="/practice" component={PracticePage} />
              <Route path="/game/:id" component={GameBoardPage} />
              <Route path="/profile" component={ProfilePage} />
              <Route path="/friends" component={FriendsPage} />
              <Route path="/lobby" component={LobbyPage} />
              <Route path="/room/:id" component={RoomPage} />
              <Route path="/achievements" component={AchievementsPage} />
              <Route path="/leaderboard" component={LeaderboardPage} />
              <Route path="/challenges" component={DailyChallengesPage} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="wisdom-chance-theme">
        <TooltipProvider>
          <Toaster />
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
