import { useState, useEffect } from "react";
import { Shield, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PASSCODE = "4838";
const STORAGE_KEY = "wc_access_granted";

export function PasscodeGate({ children }: { children: React.ReactNode }) {
  const [granted, setGranted] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "true") {
      setGranted(true);
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input === PASSCODE) {
      localStorage.setItem(STORAGE_KEY, "true");
      setGranted(true);
      setError("");
    } else {
      setError("Incorrect passcode. Please try again.");
      setShake(true);
      setInput("");
      setTimeout(() => setShake(false), 600);
    }
  }

  if (granted) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-purple-600/20 border-2 border-purple-500/50 flex items-center justify-center">
              <Shield className="w-10 h-10 text-purple-400" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">Wisdom & Chance</h1>
          <p className="text-purple-300 font-medium">TCG — Beta Access</p>
          <p className="text-slate-400 text-sm mt-3">
            This game is currently in closed beta.<br />Enter your access passcode to continue.
          </p>
        </div>

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
                className="pl-10 pr-10 text-center text-xl tracking-[0.5em] bg-slate-800/80 border-slate-600 text-white placeholder:text-slate-500 placeholder:tracking-normal focus:border-purple-500 h-14"
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
              className="w-full h-12 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-base"
            >
              Unlock Access
            </Button>
          </div>
        </form>

        <p className="text-slate-500 text-xs text-center mt-6">
          Passcodes are available to Kickstarter backers pledging $10+
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
