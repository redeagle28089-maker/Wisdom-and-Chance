import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
/**
 * DROPDOWN NAVIGATION HEADER
 * TO REVERT TO SIDEBAR: Replace NavHeader with GameSidebar + SidebarProvider setup
 * See game-sidebar.tsx for the original sidebar code
 */
import { NavHeader } from "@/components/nav-header";
/**
 * MOBILE LANDSCAPE ORIENTATION OVERLAY
 * TO REVERT: Remove this import and the <LandscapeOverlay /> component below
 */
import { LandscapeOverlay } from "@/components/landscape-overlay";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
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
import AnalyticsPage from "@/pages/analytics";
import LiveMatchesPage from "@/pages/live-matches";
import LoreArchivesPage from "@/pages/lore-archives";
import AdminCardArtPage from "@/pages/admin-card-art";
import AdminImageDatabasePage from "@/pages/admin-image-database";
import NotFound from "@/pages/not-found";

/**
 * FULL-WIDTH LAYOUT WITH DROPDOWN NAVIGATION
 * TO REVERT TO SIDEBAR: See game-sidebar.tsx for original SidebarProvider setup
 */
function AppContent() {
  return (
    <div className="flex flex-col h-screen w-full bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      <NavHeader />
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
          <Route path="/analytics" component={AnalyticsPage} />
          <Route path="/live-matches" component={LiveMatchesPage} />
          <Route path="/lore" component={LoreArchivesPage} />
          <Route path="/admin/card-art" component={AdminCardArtPage} />
          <Route path="/admin/image-database" component={AdminImageDatabasePage} />
          <Route path="/admin-card-art" component={AdminCardArtPage} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="wisdom-chance-theme">
        <TooltipProvider>
          <Toaster />
          {/* MOBILE LANDSCAPE OVERLAY - TO REVERT: Remove this component */}
          <LandscapeOverlay />
          <PWAInstallPrompt />
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
