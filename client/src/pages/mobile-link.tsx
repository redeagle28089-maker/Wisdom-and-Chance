import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, QrCode, ExternalLink, Download, Wifi } from "lucide-react";
import { SiExpo, SiApple, SiGoogleplay } from "react-icons/si";

const EXPO_PROJECT_URL = "https://expo.dev/accounts/redeagle2808/projects/wisdom-chance-tcg";

export default function MobileLinkPage() {

  return (
    <div className="min-h-full p-4 md:p-8 max-w-4xl mx-auto" data-testid="page-mobile-link">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30 mb-4">
          <Smartphone className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Mobile App</h1>
        <p className="text-purple-300 max-w-lg mx-auto">
          Play Wisdom & Chance TCG on the go. Download the mobile app to your iOS or Android device.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card className="bg-slate-800/50 border-purple-500/20 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <SiExpo className="w-6 h-6 text-purple-300" />
              </div>
              <div>
                <h2 className="font-semibold text-white text-lg">Expo Go</h2>
                <p className="text-sm text-purple-400">Preview Build</p>
              </div>
            </div>
            <p className="text-purple-200/80 text-sm mb-4">
              Open the app instantly using Expo Go. No app store download required — just scan and play.
            </p>
            <Button
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              onClick={() => window.open(EXPO_PROJECT_URL, "_blank")}
              data-testid="button-open-expo"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in Expo
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-purple-500/20 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Download className="w-6 h-6 text-emerald-300" />
              </div>
              <div>
                <h2 className="font-semibold text-white text-lg">App Stores</h2>
                <p className="text-sm text-emerald-400">Coming Soon</p>
              </div>
            </div>
            <p className="text-purple-200/80 text-sm mb-4">
              Native iOS and Android downloads will be available once the app is published to the stores.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-purple-500/30 text-purple-300" disabled data-testid="button-app-store">
                <SiApple className="w-4 h-4 mr-2" />
                iOS
              </Button>
              <Button variant="outline" className="flex-1 border-purple-500/30 text-purple-300" disabled data-testid="button-play-store">
                <SiGoogleplay className="w-4 h-4 mr-2" />
                Android
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-800/50 border-purple-500/20">
        <CardContent className="p-6">
          <h2 className="font-semibold text-white text-lg mb-4 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-purple-400" />
            How to Get Started
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-600/30 flex items-center justify-center shrink-0 text-purple-300 font-bold text-sm">1</div>
              <div>
                <p className="text-white font-medium text-sm">Download Expo Go</p>
                <p className="text-purple-300/70 text-xs mt-1">
                  Get the free Expo Go app from the App Store or Google Play.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-600/30 flex items-center justify-center shrink-0 text-purple-300 font-bold text-sm">2</div>
              <div>
                <p className="text-white font-medium text-sm">Open the Project</p>
                <p className="text-purple-300/70 text-xs mt-1">
                  Click "Open in Expo" above or scan the QR code from the project page.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-600/30 flex items-center justify-center shrink-0 text-purple-300 font-bold text-sm">3</div>
              <div>
                <p className="text-white font-medium text-sm">Play Anywhere</p>
                <p className="text-purple-300/70 text-xs mt-1">
                  Sign in with your email and your progress syncs across web and mobile.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-800/30 border-purple-500/10 mt-6">
        <CardContent className="p-4 flex items-center gap-3">
          <Wifi className="w-5 h-5 text-purple-400 shrink-0" />
          <p className="text-purple-300/70 text-sm">
            The mobile app connects to the same server as this website. Your cards, decks, achievements, and friends are shared across both platforms.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
