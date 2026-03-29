import { useState, useEffect, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Coins, ArrowLeft, Sparkles, ShoppingBag, Star } from "lucide-react";
import type { CardRarity } from "@shared/schema";

interface PulledCard {
  cardId: string;
  rarity: CardRarity;
  isNew: boolean;
  cardName: string;
  element: string;
  power: number;
}

interface PackOpeningData {
  packTypeId: string;
  packName: string;
  cards: PulledCard[];
  costGold: number;
  remainingGold: number;
  remainingGems: number;
}

const RARITY_GLOW: Record<string, string> = {
  Common: "shadow-[0_0_20px_rgba(156,163,175,0.4)]",
  Rare: "shadow-[0_0_25px_rgba(59,130,246,0.5)]",
  Epic: "shadow-[0_0_30px_rgba(168,85,247,0.6)]",
  Legendary: "shadow-[0_0_40px_rgba(245,158,11,0.7)]",
};

const RARITY_BORDER: Record<string, string> = {
  Common: "border-gray-400",
  Rare: "border-blue-400",
  Epic: "border-purple-400",
  Legendary: "border-amber-400",
};

const RARITY_BG: Record<string, string> = {
  Common: "from-gray-700/60 to-gray-800/60",
  Rare: "from-blue-700/40 to-blue-900/40",
  Epic: "from-purple-700/40 to-purple-900/40",
  Legendary: "from-amber-600/40 to-amber-900/40",
};

const RARITY_TEXT: Record<string, string> = {
  Common: "text-gray-300",
  Rare: "text-blue-300",
  Epic: "text-purple-300",
  Legendary: "text-amber-300",
};

const ELEMENT_COLORS: Record<string, string> = {
  Fire: "text-red-400",
  Water: "text-blue-400",
  Earth: "text-amber-500",
  Air: "text-sky-400",
  Nature: "text-green-400",
};

export default function PackOpeningPage() {
  const searchStr = useSearch();
  const [, navigate] = useLocation();
  const [revealedCards, setRevealedCards] = useState<Set<number>>(new Set());
  const [allRevealed, setAllRevealed] = useState(false);
  const [packData, setPackData] = useState<PackOpeningData | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(searchStr);
      const dataStr = params.get("data");
      if (dataStr) {
        const parsed = JSON.parse(decodeURIComponent(dataStr));
        if (parsed?.cards?.length > 0) {
          setPackData(parsed);
        } else {
          navigate("/shop");
        }
      } else {
        navigate("/shop");
      }
    } catch {
      navigate("/shop");
    }
  }, [searchStr, navigate]);

  const revealCard = useCallback((index: number) => {
    setRevealedCards(prev => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  const revealAll = useCallback(() => {
    if (!packData) return;
    const indices = packData.cards.map((_, i) => i);
    let delay = 0;
    indices.forEach((idx) => {
      if (!revealedCards.has(idx)) {
        setTimeout(() => revealCard(idx), delay);
        delay += 200;
      }
    });
    setTimeout(() => setAllRevealed(true), delay + 300);
  }, [packData, revealedCards, revealCard]);

  useEffect(() => {
    if (packData && revealedCards.size === packData.cards.length) {
      setAllRevealed(true);
    }
  }, [revealedCards, packData]);

  if (!packData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl" data-testid="pack-opening-page">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2" data-testid="text-pack-name">
          {packData.packName}
        </h1>
        <p className="text-slate-400">
          Click each card to reveal it, or reveal all at once!
        </p>
      </div>

      <div className="flex justify-center mb-6">
        {!allRevealed && (
          <Button
            onClick={revealAll}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6"
            data-testid="button-reveal-all"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Reveal All
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-8" data-testid="pack-cards-grid">
        {packData.cards.map((card, index) => {
          const isRevealed = revealedCards.has(index);
          return (
            <div
              key={index}
              className="perspective-1000"
              onClick={() => !isRevealed && revealCard(index)}
              data-testid={`card-slot-${index}`}
            >
              <div
                className={`relative w-full aspect-[2.5/3.5] cursor-pointer transition-transform duration-700 transform-style-3d ${
                  isRevealed ? "rotate-y-180" : "hover:scale-105"
                }`}
              >
                <div
                  className={`absolute inset-0 rounded-xl backface-hidden ${
                    isRevealed ? "invisible" : ""
                  }`}
                >
                  <div className="w-full h-full rounded-xl bg-gradient-to-br from-purple-700 to-indigo-900 border-2 border-purple-400/40 flex items-center justify-center shadow-lg hover:shadow-purple-500/30 transition-shadow">
                    <div className="text-center">
                      <Star className="w-10 h-10 text-purple-300/60 mx-auto mb-2 animate-pulse" />
                      <span className="text-purple-300/60 text-xs font-medium">Click to reveal</span>
                    </div>
                  </div>
                </div>

                <div
                  className={`absolute inset-0 rounded-xl backface-hidden rotate-y-180 ${
                    isRevealed ? "" : "invisible"
                  }`}
                >
                  <div
                    className={`w-full h-full rounded-xl bg-gradient-to-br ${RARITY_BG[card.rarity]} border-2 ${RARITY_BORDER[card.rarity]} ${RARITY_GLOW[card.rarity]} flex flex-col items-center justify-between p-3 transition-shadow duration-500`}
                  >
                    {card.isNew && (
                      <Badge className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] border-0 z-10 animate-bounce">
                        NEW!
                      </Badge>
                    )}

                    <div className="text-center flex-1 flex flex-col items-center justify-center gap-1">
                      <span className={`text-2xl font-bold ${RARITY_TEXT[card.rarity]}`}>
                        {card.power}
                      </span>
                      <h3 className="text-white text-sm font-semibold leading-tight text-center">
                        {card.cardName}
                      </h3>
                      <span className={`text-xs ${ELEMENT_COLORS[card.element] || "text-slate-400"}`}>
                        {card.element}
                      </span>
                    </div>

                    <Badge
                      className={`text-[10px] border ${
                        card.rarity === "Common" ? "bg-gray-600/40 text-gray-200 border-gray-500/40" :
                        card.rarity === "Rare" ? "bg-blue-600/40 text-blue-200 border-blue-500/40" :
                        card.rarity === "Epic" ? "bg-purple-600/40 text-purple-200 border-purple-500/40" :
                        "bg-amber-600/40 text-amber-200 border-amber-500/40"
                      }`}
                    >
                      {card.rarity}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {allRevealed && (
        <div className="text-center space-y-4 animate-fade-in" data-testid="post-reveal-actions">
          <div className="flex items-center justify-center gap-4 text-sm text-slate-400">
            <div className="flex items-center gap-1">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>Spent: <span className="text-amber-300 font-semibold">{packData.costGold}</span></span>
            </div>
            <div className="flex items-center gap-1">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>Remaining: <span className="text-amber-300 font-semibold" data-testid="text-remaining-gold">{packData.remainingGold.toLocaleString()}</span></span>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => navigate("/collection")}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
              data-testid="button-view-collection"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              View Collection
            </Button>
            <Button
              onClick={() => navigate("/shop")}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              data-testid="button-buy-more"
            >
              <ShoppingBag className="w-4 h-4 mr-2" />
              Buy More Packs
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
