import { Link, useSearch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Swords, BookOpen, Layers, Database, Flame, Droplet, Mountain, Wind, Leaf, AlertTriangle, X, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

const features = [
  {
    icon: BookOpen,
    title: "Learn the Rules",
    description: "Master the game mechanics and strategy",
    href: "/rules",
    gradient: "from-cyan-600 to-blue-600",
  },
  {
    icon: Database,
    title: "Card Database",
    description: "Browse all available cards by element",
    href: "/cards",
    gradient: "from-purple-600 to-pink-600",
  },
  {
    icon: Layers,
    title: "Deck Builder",
    description: "Create your perfect 40-card deck",
    href: "/deck-builder",
    gradient: "from-yellow-600 to-orange-600",
  },
  {
    icon: Swords,
    title: "Practice Battle",
    description: "Test your deck against AI opponents",
    href: "/practice",
    gradient: "from-red-600 to-orange-600",
  },
];

const elements = [
  { name: "Fire", icon: Flame, color: "from-red-500 to-orange-500", textColor: "text-red-400" },
  { name: "Water", icon: Droplet, color: "from-blue-500 to-cyan-500", textColor: "text-blue-400" },
  { name: "Earth", icon: Mountain, color: "from-amber-600 to-yellow-600", textColor: "text-amber-400" },
  { name: "Air", icon: Wind, color: "from-green-400 to-teal-400", textColor: "text-green-400" },
  { name: "Nature", icon: Leaf, color: "from-green-700 to-emerald-600", textColor: "text-emerald-400" },
];

export default function HomePage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);

  const { data: adminCheck, isLoading: adminLoading } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    const params = new URLSearchParams(search);
    const error = params.get("error");
    const message = params.get("message");

    if (error) {
      setAuthError(message || "Authentication failed. Please try again.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [search]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (adminLoading) return;
    if (adminCheck && adminCheck.isAdmin === false) {
      setLocation("/lobby");
    }
  }, [isAuthenticated, adminLoading, adminCheck, setLocation]);

  if (isAuthenticated && (adminLoading || (adminCheck && !adminCheck.isAdmin))) {
    return (
      <div
        className="min-h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900"
        data-testid="home-admin-gate-loading"
      >
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900">
      {authError && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4">
          <div className="bg-red-900/90 border border-red-500/50 rounded-lg p-4 flex items-start gap-3 shadow-xl">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-white font-medium">Login Error</p>
              <p className="text-red-200 text-sm mt-1">{authError}</p>
            </div>
            <button 
              onClick={() => setAuthError(null)}
              className="text-red-400 hover:text-red-300"
              data-testid="button-dismiss-error"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/50" />
        <div className="relative px-6 py-16 md:py-24 landscape-mobile:py-4 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 md:w-24 md:h-24 landscape-mobile:w-12 landscape-mobile:h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl landscape-mobile:rounded-xl mb-6 md:mb-8 landscape-mobile:mb-2 shadow-2xl shadow-purple-500/50">
            <Swords className="w-10 h-10 md:w-12 md:h-12 landscape-mobile:w-6 landscape-mobile:h-6 text-white" />
          </div>
          <h1 className="text-4xl md:text-6xl landscape-mobile:text-2xl font-bold text-white mb-4 md:mb-6 landscape-mobile:mb-2" data-testid="text-title">
            Wisdom & Chance
          </h1>
          <p className="text-lg md:text-2xl landscape-mobile:text-sm text-purple-200 mb-6 md:mb-8 landscape-mobile:mb-3 max-w-2xl mx-auto">
            Master strategy, harness elemental powers, and command legendary armies in tactical card battles
          </p>
          <div className="flex gap-4 landscape-mobile:gap-2 justify-center flex-wrap">
            <Link href="/rules">
              <Button
                className="bg-gradient-to-r from-cyan-600 to-blue-600 text-base md:text-lg landscape-mobile:text-sm px-6 md:px-8 landscape-mobile:px-4 py-5 md:py-6 landscape-mobile:py-3 shadow-xl shadow-cyan-500/30"
                data-testid="button-learn-rules"
              >
                <BookOpen className="w-5 h-5 landscape-mobile:w-4 landscape-mobile:h-4 mr-2" />
                Learn the Rules
              </Button>
            </Link>
            <Link href="/deck-builder">
              <Button
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-base md:text-lg landscape-mobile:text-sm px-6 md:px-8 landscape-mobile:px-4 py-5 md:py-6 landscape-mobile:py-3 shadow-xl shadow-purple-500/30"
                data-testid="button-build-deck"
              >
                <Layers className="w-5 h-5 landscape-mobile:w-4 landscape-mobile:h-4 mr-2" />
                Build Your Deck
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 landscape-mobile:px-3 py-12 landscape-mobile:py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 landscape-mobile:grid-cols-2 gap-6 landscape-mobile:gap-3 mb-12 landscape-mobile:mb-4">
          {features.map((feature) => (
            <Link key={feature.title} href={feature.href}>
              <Card
                className="bg-slate-800/50 border-purple-500/20 cursor-pointer transition-all duration-300 overflow-hidden group h-full hover-elevate"
                data-testid={`card-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <CardContent className="p-6 md:p-8 landscape-mobile:p-3">
                  <div className={`inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 landscape-mobile:w-10 landscape-mobile:h-10 bg-gradient-to-br ${feature.gradient} rounded-xl landscape-mobile:rounded-lg mb-4 md:mb-6 landscape-mobile:mb-2 shadow-xl`}>
                    <feature.icon className="w-7 h-7 md:w-8 md:h-8 landscape-mobile:w-5 landscape-mobile:h-5 text-white" />
                  </div>
                  <h3 className="text-xl md:text-2xl landscape-mobile:text-base font-bold text-white mb-2 md:mb-3 landscape-mobile:mb-1">{feature.title}</h3>
                  <p className="text-purple-200 landscape-mobile:text-xs">{feature.description}</p>
                  <div className="mt-4 md:mt-6 landscape-mobile:mt-2">
                    <span className="text-purple-400 group-hover:text-purple-300 transition-colors landscape-mobile:text-xs">
                      Get Started →
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="text-center">
          <h2 className="text-2xl md:text-3xl landscape-mobile:text-lg font-bold text-white mb-6 md:mb-8 landscape-mobile:mb-3">Master the Elements</h2>
          <div className="grid grid-cols-3 md:grid-cols-5 landscape-mobile:grid-cols-5 gap-4 md:gap-6 landscape-mobile:gap-3">
            {elements.map((element) => (
              <div key={element.name} className="flex flex-col items-center" data-testid={`element-${element.name.toLowerCase()}`}>
                <div className={`w-14 h-14 md:w-20 md:h-20 landscape-mobile:w-10 landscape-mobile:h-10 bg-gradient-to-br ${element.color} rounded-2xl landscape-mobile:rounded-lg flex items-center justify-center mb-2 md:mb-3 landscape-mobile:mb-1 shadow-xl`}>
                  <element.icon className="w-7 h-7 md:w-10 md:h-10 landscape-mobile:w-5 landscape-mobile:h-5 text-white" />
                </div>
                <span className={`text-sm md:text-base landscape-mobile:text-xs font-medium ${element.textColor}`}>{element.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
