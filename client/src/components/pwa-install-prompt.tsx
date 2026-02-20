import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, X, Smartphone, Share, ArrowUp } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isInStandaloneMode(): boolean {
  return ('standalone' in window.navigator && (window.navigator as any).standalone) ||
    window.matchMedia('(display-mode: standalone)').matches;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) return;

    const stored = localStorage.getItem("pwa-install-dismissed");
    if (stored) {
      const dismissedAt = parseInt(stored, 10);
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) {
        setDismissed(true);
        return;
      }
    }

    if (isIOS()) {
      const timer = setTimeout(() => {
        if (!dismissed) setShowIOSGuide(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!dismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [dismissed]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSGuide(false);
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  };

  if (showIOSGuide && !dismissed) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 flex justify-center" data-testid="pwa-ios-install-guide">
        <Card className="max-w-md w-full bg-gradient-to-r from-purple-900/95 to-indigo-900/95 border-purple-500/40 p-4 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20 shrink-0">
              <Smartphone className="w-6 h-6 text-purple-300" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white text-sm">Install as App</h3>
              <p className="text-purple-200/80 text-xs mt-1 mb-2">
                Add Wisdom & Chance to your home screen:
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-purple-100">
                  <div className="w-5 h-5 rounded bg-purple-500/30 flex items-center justify-center shrink-0">
                    <Share className="w-3 h-3" />
                  </div>
                  <span>Tap the <strong>Share</strong> button in Safari</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-purple-100">
                  <div className="w-5 h-5 rounded bg-purple-500/30 flex items-center justify-center shrink-0">
                    <ArrowUp className="w-3 h-3" />
                  </div>
                  <span>Scroll down, tap <strong>"Add to Home Screen"</strong></span>
                </div>
                <div className="flex items-center gap-2 text-xs text-purple-100">
                  <div className="w-5 h-5 rounded bg-purple-500/30 flex items-center justify-center shrink-0">
                    <Download className="w-3 h-3" />
                  </div>
                  <span>Tap <strong>"Add"</strong> to install</span>
                </div>
              </div>
              <Button
                onClick={handleDismiss}
                size="sm"
                variant="ghost"
                className="text-purple-300 mt-2"
                data-testid="button-pwa-ios-dismiss"
              >
                Got it
              </Button>
            </div>
            <Button onClick={handleDismiss} size="icon" variant="ghost" className="text-purple-400 shrink-0" data-testid="button-pwa-ios-close">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!showPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex justify-center" data-testid="pwa-install-prompt">
      <Card className="max-w-md w-full bg-gradient-to-r from-purple-900/95 to-indigo-900/95 border-purple-500/40 p-4 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <Smartphone className="w-6 h-6 text-purple-300" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white text-sm">Install Wisdom & Chance</h3>
            <p className="text-purple-200/80 text-xs mt-1">
              Add to your home screen for a full-screen app experience
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button
                onClick={handleInstall}
                size="sm"
                className="bg-purple-600"
                data-testid="button-pwa-install"
              >
                <Download className="w-3 h-3 mr-1" />
                Install
              </Button>
              <Button
                onClick={handleDismiss}
                size="sm"
                variant="ghost"
                className="text-purple-300"
                data-testid="button-pwa-dismiss"
              >
                Not now
              </Button>
            </div>
          </div>
          <Button onClick={handleDismiss} size="icon" variant="ghost" className="text-purple-400" data-testid="button-pwa-close">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}