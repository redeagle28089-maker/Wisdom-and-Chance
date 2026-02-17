import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, X, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("pwa-install-dismissed");
    if (stored) {
      const dismissedAt = parseInt(stored, 10);
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) {
        setDismissed(true);
      }
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
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  };

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