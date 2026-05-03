import { Switch, Route, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { X, Smartphone } from "lucide-react";
/**
 * DROPDOWN NAVIGATION HEADER
 * TO REVERT TO SIDEBAR: Replace NavHeader with GameSidebar + SidebarProvider setup
 * See game-sidebar.tsx for the original sidebar code
 */
import { NavHeader } from "@/components/nav-header";
import { ConfigProvider } from "@/lib/config";
import { PasscodeGate } from "@/components/passcode-gate";
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
import AdminUserDatabasePage from "@/pages/admin-user-database";
import AdminAiGeneratorPage from "@/pages/admin-ai-generator";
import AdminPresentationPage from "@/pages/admin-presentation";
import AboutCreatorPage from "@/pages/about-creator";
import CollectionPage from "@/pages/collection";
import ShopPage from "@/pages/shop";
import PackOpeningPage from "@/pages/pack-opening";
import SeasonPage from "@/pages/season";
import BattlePassPage from "@/pages/battle-pass";
import PurchaseHistoryPage from "@/pages/purchase-history";
import MobileLinkPage from "@/pages/mobile-link";
import NotFound from "@/pages/not-found";

/**
 * FULL-WIDTH LAYOUT WITH DROPDOWN NAVIGATION
 * TO REVERT TO SIDEBAR: See game-sidebar.tsx for original SidebarProvider setup
 */
function MobileBanner() {
  const [dismissed, setDismissed] = useState(() =>
    sessionStorage.getItem("mobile_banner_dismissed") === "true"
  );

  const isMobileBrowser =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  useEffect(() => {
    if (dismissed) sessionStorage.setItem("mobile_banner_dismissed", "true");
  }, [dismissed]);

  if (!isMobileBrowser || dismissed) return null;

  return (
    <div
      className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-white"
      style={{
        background: "linear-gradient(90deg, #7e22ce 0%, #9333ea 100%)",
        minHeight: "44px",
      }}
    >
      <div className="flex items-center gap-2 flex-1">
        <Smartphone className="w-4 h-4 shrink-0" />
        <span>
          Using a phone?{" "}
          <a
            href="/mobile-app"
            className="underline font-semibold hover:text-purple-200"
            data-testid="link-mobile-app-banner"
          >
            Try the Wisdom &amp; Chance mobile app →
          </a>
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded hover:bg-white/20 transition-colors shrink-0"
        aria-label="Dismiss banner"
        data-testid="button-dismiss-mobile-banner"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function AppContent() {
  const [location] = useLocation();
  const isGameBoard = location.startsWith("/game/");

  return (
    <div className="flex flex-col h-screen w-full bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {!isGameBoard && <NavHeader />}
      <main className="flex-1 overflow-auto">
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/rules" component={RulesPage} />
          <Route path="/tutorial" component={TutorialPage} />
          <Route path="/cards" component={CardDatabasePage} />
          <Route path="/deck-builder" component={DeckBuilderPage} />
          <Route path="/collection" component={CollectionPage} />
          <Route path="/shop" component={ShopPage} />
          <Route path="/pack-opening" component={PackOpeningPage} />
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
          <Route path="/about" component={AboutCreatorPage} />
          <Route path="/season" component={SeasonPage} />
          <Route path="/battle-pass" component={BattlePassPage} />
          <Route path="/purchase-history" component={PurchaseHistoryPage} />
          <Route path="/mobile-app" component={MobileLinkPage} />
          <Route path="/admin/card-art" component={AdminCardArtPage} />
          <Route path="/admin/image-database" component={AdminImageDatabasePage} />
          <Route path="/admin/user-database" component={AdminUserDatabasePage} />
          <Route path="/admin/ai-generator" component={AdminAiGeneratorPage} />
          <Route path="/admin/presentation" component={AdminPresentationPage} />
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
      <ConfigProvider>
        <ThemeProvider defaultTheme="dark" storageKey="wisdom-chance-theme">
          <TooltipProvider>
            <Toaster />
            <MobileBanner />
            <PasscodeGate>
              <AppContent />
            </PasscodeGate>
          </TooltipProvider>
        </ThemeProvider>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export default App;
