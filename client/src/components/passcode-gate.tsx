import { useState, useEffect, useRef } from "react";
import { LogIn, Smartphone, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const POST_LOGIN_KEY = "wc_post_login";
const EXPO_PROJECT_URL = "https://expo.dev/accounts/redeagle2808/projects/wisdom-chance-tcg";

const ELEMENT_COLORS = [
  { label: "Fire",   color: "#ef4444" },
  { label: "Water",  color: "#3b82f6" },
  { label: "Earth",  color: "#d97706" },
  { label: "Air",    color: "#94a3b8" },
  { label: "Nature", color: "#22c55e" },
];

function PostLoginSplash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"hold" | "fadeout">("hold");

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase("fadeout"), 900);
    return () => clearTimeout(holdTimer);
  }, []);

  useEffect(() => {
    if (phase === "fadeout") {
      const doneTimer = setTimeout(onDone, 600);
      return () => clearTimeout(doneTimer);
    }
  }, [phase, onDone]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 40%, #0f172a 100%)",
        opacity: phase === "fadeout" ? 0 : 1,
        transition: phase === "fadeout" ? "opacity 0.6s ease" : "none",
        pointerEvents: phase === "fadeout" ? "none" : "all",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px",
          animation: "splashFadeIn 0.5s ease both",
        }}
      >
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 24,
            background: "linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)",
            boxShadow: "0 0 60px rgba(168, 85, 247, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width={44} height={44}>
            <rect x="4" y="8" width="18" height="26" rx="3" fill="white" fillOpacity="0.95" />
            <rect x="9" y="13" width="8" height="2" rx="1" fill="#7e22ce" />
            <rect x="9" y="17" width="6" height="2" rx="1" fill="#7e22ce" fillOpacity="0.6" />
            <rect x="14" y="8" width="18" height="26" rx="3" fill="white" fillOpacity="0.8" transform="rotate(-8 23 21)" />
            <rect x="26" y="8" width="18" height="26" rx="3" fill="white" fillOpacity="0.6" transform="rotate(6 35 21)" />
          </svg>
        </div>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ color: "white", fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px", margin: 0 }}>
            You're in!
          </h1>
          <p style={{ color: "#c4b5fd", fontSize: 14, marginTop: 6 }}>Loading your account…</p>
        </div>
      </div>
      <style>{`
        @keyframes splashFadeIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

function StartupShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 40%, #0f172a 100%)",
      }}
    >
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center mb-5"
            style={{
              background: "linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)",
              boxShadow: "0 0 40px rgba(168, 85, 247, 0.4)",
            }}
          >
            <svg
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-12 h-12"
            >
              <rect x="4" y="8" width="18" height="26" rx="3" fill="white" fillOpacity="0.95" />
              <rect x="9" y="13" width="8" height="2" rx="1" fill="#7e22ce" />
              <rect x="9" y="17" width="6" height="2" rx="1" fill="#7e22ce" fillOpacity="0.6" />
              <rect x="14" y="8" width="18" height="26" rx="3" fill="white" fillOpacity="0.8" transform="rotate(-8 23 21)" />
              <rect x="26" y="8" width="18" height="26" rx="3" fill="white" fillOpacity="0.6" transform="rotate(6 35 21)" />
            </svg>
          </div>

          <h1 className="text-4xl font-bold text-white mb-1 tracking-tight">
            Wisdom &amp; Chance
          </h1>
          <p className="text-purple-300 font-medium text-base mb-1">Trading Card Game</p>
          <p className="text-slate-400 text-sm text-center leading-relaxed">
            Master the elements. Build your deck. Battle for glory.
          </p>
        </div>

        <div className="flex justify-center gap-2 mb-8">
          {ELEMENT_COLORS.map(({ label, color }) => (
            <div
              key={label}
              title={label}
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}80` }}
            />
          ))}
        </div>

        {children}
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .panel-fade-in {
          animation: fadeSlideIn 0.4s ease both;
        }
      `}</style>
    </div>
  );
}

function PanelCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-6 panel-fade-in"
      style={{
        background: "rgba(30, 27, 75, 0.6)",
        border: "1px solid rgba(168, 85, 247, 0.25)",
        backdropFilter: "blur(12px)",
      }}
    >
      {children}
    </div>
  );
}

export function PasscodeGate({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(false);
  const splashShown = useRef(false);
  const { user, isLoading } = useAuth();

  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  useEffect(() => {
    if (!isLoading && user && !splashShown.current) {
      const postLogin = sessionStorage.getItem(POST_LOGIN_KEY);
      if (postLogin === "true") {
        sessionStorage.removeItem(POST_LOGIN_KEY);
        splashShown.current = true;
        setShowSplash(true);
      }
    }
  }, [isLoading, user]);

  function handleLogin(provider: "replit" | "google") {
    sessionStorage.setItem(POST_LOGIN_KEY, "true");
    const base = provider === "google" ? "/api/login/google" : "/api/login";
    const loginUrl = `${base}?redirect=web`;
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
      window.open(loginUrl, "_blank");
    } else {
      window.location.href = loginUrl;
    }
  }

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 40%, #0f172a 100%)" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 rounded-full border-4 border-purple-500/30 border-t-purple-400"
            style={{ animation: "spin 0.8s linear infinite" }}
          />
          <p className="text-purple-300 text-sm">Loading…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="app-reveal">
        {showSplash && <PostLoginSplash onDone={() => setShowSplash(false)} />}
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <StartupShell>
        <PanelCard>
          <div className="flex flex-col items-center gap-4 text-center mb-5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #10b981 0%, #0d9488 100%)" }}
            >
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg">Play on Mobile</p>
              <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                Wisdom &amp; Chance has a dedicated mobile app. Sign in and play on the go.
              </p>
            </div>
          </div>

          <Button
            data-testid="button-open-expo"
            className="w-full h-12 font-semibold text-base text-white"
            style={{ background: "linear-gradient(90deg, #9333ea 0%, #7e22ce 100%)" }}
            onClick={() => window.open(EXPO_PROJECT_URL, "_blank")}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in Expo Go
          </Button>

          <p className="text-slate-500 text-xs text-center mt-4">
            Sign in with your email in the Expo Go app.
          </p>
        </PanelCard>
      </StartupShell>
    );
  }

  return (
    <StartupShell>
      <PanelCard>
        <p className="text-slate-300 text-sm text-center mb-6">
          Sign in to play.
        </p>

        <div className="flex flex-col gap-3">
          <Button
            data-testid="button-signin-replit"
            className="w-full h-12 font-semibold text-base text-white"
            style={{ background: "linear-gradient(90deg, #9333ea 0%, #7e22ce 100%)" }}
            disabled={isLoading}
            onClick={() => handleLogin("replit")}
          >
            <LogIn className="w-4 h-4 mr-2" />
            Sign in with Replit
          </Button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-slate-500 text-xs">or</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          <Button
            data-testid="button-signin-google"
            variant="outline"
            className="w-full h-12 font-semibold text-base border-slate-600 bg-slate-900/60 text-white hover:bg-slate-800"
            disabled={isLoading}
            onClick={() => handleLogin("google")}
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </Button>
        </div>

        <p className="text-slate-500 text-xs text-center mt-4">
          Your progress, collection, and decks are saved to your account.
        </p>
      </PanelCard>
    </StartupShell>
  );
}
