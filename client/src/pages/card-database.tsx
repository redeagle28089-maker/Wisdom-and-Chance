import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Flame, Droplet, Mountain, Wind, Leaf } from "lucide-react";
import { GameCard, elementConfig } from "@/components/game-card";
import type { Card as CardType, Element } from "@shared/schema";

export default function CardDatabasePage() {
  const [search, setSearch] = useState("");
  const [selectedElement, setSelectedElement] = useState<Element | "all">("all");
  const [selectedPower, setSelectedPower] = useState<number | "all">("all");

  const { data: cards = [], isLoading } = useQuery<CardType[]>({
    queryKey: ["/api/cards"],
  });

  const filteredCards = cards.filter((card) => {
    const matchesSearch = card.name.toLowerCase().includes(search.toLowerCase());
    const matchesElement = selectedElement === "all" || card.element === selectedElement;
    const matchesPower = selectedPower === "all" || card.power === selectedPower;
    return matchesSearch && matchesElement && matchesPower;
  });

  const uniqueCards = filteredCards.reduce((acc, card) => {
    const key = `${card.element}-${card.power}-${card.name.split('#')[0].trim()}`;
    if (!acc.has(key)) {
      acc.set(key, card);
    }
    return acc;
  }, new Map<string, CardType>());

  const displayCards = Array.from(uniqueCards.values()).sort((a, b) => {
    if (a.element !== b.element) return a.element.localeCompare(b.element);
    return a.power - b.power;
  });

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4" data-testid="text-database-title">Card Database</h1>
          <p className="text-lg text-purple-200">Browse all available cards</p>
        </div>

        <Card className="bg-slate-800/50 border-purple-500/20 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                <Input
                  placeholder="Search cards..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-slate-900/50 border-purple-500/30 text-white"
                  data-testid="input-search"
                />
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={selectedElement === "all" ? "default" : "outline"}
                  onClick={() => setSelectedElement("all")}
                  className="text-sm"
                  data-testid="filter-all"
                >
                  All
                </Button>
                {Object.entries(elementConfig).map(([element, config]) => {
                  const Icon = config.icon;
                  return (
                    <Button
                      key={element}
                      variant={selectedElement === element ? "default" : "outline"}
                      onClick={() => setSelectedElement(element as Element)}
                      className="text-sm"
                      data-testid={`filter-${element.toLowerCase()}`}
                    >
                      <Icon className={`w-4 h-4 mr-1 ${config.color}`} />
                      {element}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 mt-4 flex-wrap">
              <Button
                variant={selectedPower === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPower("all")}
                data-testid="power-all"
              >
                All Powers
              </Button>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((power) => (
                <Button
                  key={power}
                  variant={selectedPower === power ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPower(power)}
                  data-testid={`power-${power}`}
                >
                  {power}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <p className="text-purple-300 mb-4" data-testid="text-card-count">
              Showing {displayCards.length} unique cards
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {displayCards.map((card) => (
                <GameCard key={card.id} card={card} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
