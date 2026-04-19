import { useState, useEffect, useRef } from "react";
import { Lock, Eye, EyeOff, LogIn, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

const POST_LOGIN_KEY = "wc_post_login";

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
            Welcome to the Arena
          </h1>
          <p style={{ color: "#c4b5fd", fontSize: 14, marginTop: 6 }}>Preparing your experience…</p>
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

const PASSCODE = "4838";
const STORAGE_KEY = "wc_access_granted";

const ELEMENT_COLORS = [
  { label: "Fire",   color: "#ef4444" },
  { label: "Water",  color: "#3b82f6" },
  { label: "Earth",  color: "#d97706" },
  { label: "Air",    color: "#94a3b8" },
  { label: "Nature", color: "#22c55e" },
];

function StartupShell({ children, fading }: { children: React.ReactNode; fading?: boolean }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 40%, #0f172a 100%)",
      }}
    >
      <div
        className="w-full max-w-sm"
        style={{
          opacity: fading ? 0 : 1,
          transform: fading ? "translateY(8px)" : "translateY(0)",
          transition: "opacity 0.3s ease, transform 0.3s ease",
        }}
      >
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
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%  { transform: translateX(-8px); }
          40%  { transform: translateX(8px); }
          60%  { transform: translateX(-6px); }
          80%  { transform: translateX(6px); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes popIn {
          0%   { opacity: 0; transform: scale(0.7); }
          60%  { transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1); }
        }
        .panel-fade-in {
          animation: fadeSlideIn 0.4s ease both;
        }
        .check-pop-in {
          animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
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

type Screen = "passcode" | "success" | "signin";

export function PasscodeGate({ children }: { children: React.ReactNode }) {
  const [granted, setGranted] = useState(false);
  const [screen, setScreen] = useState<Screen>("passcode");
  const [visible, setVisible] = useState(true);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [shake, setShake] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const splashShown = useRef(false);

  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "true") {
      setGranted(true);
    }
  }, []);

  useEffect(() => {
    if (granted && !isLoading && user && !splashShown.current) {
      const postLogin = sessionStorage.getItem(POST_LOGIN_KEY);
      if (postLogin === "true") {
        sessionStorage.removeItem(POST_LOGIN_KEY);
        splashShown.current = true;
        setShowSplash(true);
      }
    }
  }, [granted, isLoading, user]);

  function transitionTo(next: Screen) {
    setVisible(false);
    setTimeout(() => {
      setScreen(next);
      setVisible(true);
    }, 300);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input === PASSCODE) {
      localStorage.setItem(STORAGE_KEY, "true");
      setError("");
      setGranted(true);
      transitionTo("success");
      setTimeout(() => transitionTo("signin"), 1200);
    } else {
      setError("Incorrect passcode. Please try again.");
      setShake(true);
      setInput("");
      setTimeout(() => setShake(false), 600);
    }
  }

  // Returning user: already has access grant, waiting for auth to confirm
  if (granted && isLoading) {
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

  // Granted and authenticated — reveal the app
  if (granted && !isLoading && user && screen !== "signin" && screen !== "success") {
    return (
      <div className="app-reveal">
        {showSplash && <PostLoginSplash onDone={() => setShowSplash(false)} />}
        {children}
      </div>
    );
  }

  if (screen === "success") {
    return (
      <StartupShell fading={!visible}>
        <div
          className="rounded-2xl p-8 flex flex-col items-center gap-4"
          style={{
            background: "rgba(30, 27, 75, 0.6)",
            border: "1px solid rgba(34, 197, 94, 0.4)",
            backdropFilter: "blur(12px)",
          }}
        >
          <CheckCircle2
            className="check-pop-in"
            style={{ width: 56, height: 56, color: "#22c55e" }}
          />
          <div className="text-center">
            <p className="text-white font-semibold text-lg mb-1">Access Granted!</p>
            <p className="text-slate-400 text-sm">Welcome, brave challenger…</p>
          </div>
        </div>
      </StartupShell>
    );
  }

  if (!granted) {
    return (
      <StartupShell fading={!visible}>
        <PanelCard key="passcode">
          <p className="text-slate-300 text-sm text-center mb-4">
            Closed beta — enter your backer passcode to continue.
          </p>

          <form onSubmit={handleSubmit}>
            <div className={`transition-all duration-150 ${shake ? "animate-[shake_0.5s_ease-in-out]" : ""}`}>
              <div className="relative mb-3">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  data-testid="input-passcode"
                  type={showCode ? "text" : "password"}
                  inputMode="numeric"
                  placeholder="Enter passcode"
                  value={input}
                  onChange={(e) => { setInput(e.target.value); setError(""); }}
                  className="pl-10 pr-10 text-center text-xl tracking-[0.5em] bg-slate-900/80 border-slate-600 text-white placeholder:text-slate-500 placeholder:tracking-normal focus:border-purple-500 h-14"
                  maxLength={10}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {error && (
                <p data-testid="text-passcode-error" className="text-red-400 text-sm text-center mb-3">
                  {error}
                </p>
              )}

              <Button
                data-testid="button-unlock"
                type="submit"
                className="w-full h-12 font-semibold text-base text-white"
                style={{ background: "linear-gradient(90deg, #9333ea 0%, #7e22ce 100%)" }}
              >
                Unlock Access
              </Button>
            </div>
          </form>

          <p className="text-slate-500 text-xs text-center mt-4">
            Passcodes are available to Kickstarter backers pledging $10+
          </p>
        </PanelCard>
      </StartupShell>
    );
  }

  return (
    <StartupShell fading={!visible}>
      <PanelCard key="login">
        <p className="text-slate-300 text-sm text-center mb-6">
          Sign in to enter the arena and start playing.
        </p>

        <Button
          data-testid="button-enter-arena"
          className="w-full h-12 font-semibold text-base text-white"
          style={{ background: "linear-gradient(90deg, #9333ea 0%, #7e22ce 100%)" }}
          disabled={isLoading}
          onClick={() => { sessionStorage.setItem(POST_LOGIN_KEY, "true"); window.location.href = "/api/login"; }}
        >
          <LogIn className="w-4 h-4 mr-2" />
          {isLoading ? "Checking…" : "Enter the Arena"}
        </Button>

        <p className="text-slate-500 text-xs text-center mt-4">
          Sign in with your Replit account to continue.
        </p>
      </PanelCard>
    </StartupShell>
  );
}
