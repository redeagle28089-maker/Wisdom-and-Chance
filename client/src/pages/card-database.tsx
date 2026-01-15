import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Flame, Droplet, Mountain, Wind, Leaf, Zap, Plus, Heart, Shield } from "lucide-react";
import type { Card as CardType, Element } from "@shared/schema";

const elementConfig: Record<Element, { icon: typeof Flame; color: string; bgColor: string; borderColor: string }> = {
  Fire: { icon: Flame, color: "text-red-500", bgColor: "bg-gradient-to-br from-red-600 to-orange-600", borderColor: "border-red-500/50" },
  Water: { icon: Droplet, color: "text-blue-500", bgColor: "bg-gradient-to-br from-blue-600 to-cyan-600", borderColor: "border-blue-500/50" },
  Earth: { icon: Mountain, color: "text-amber-500", bgColor: "bg-gradient-to-br from-amber-700 to-yellow-600", borderColor: "border-amber-500/50" },
  Air: { icon: Wind, color: "text-green-400", bgColor: "bg-gradient-to-br from-green-400 to-teal-400", borderColor: "border-green-400/50" },
  Nature: { icon: Leaf, color: "text-emerald-500", bgColor: "bg-gradient-to-br from-green-700 to-emerald-600", borderColor: "border-emerald-500/50" },
};

const traitIcons: Record<string, typeof Zap> = {
  "Quick Strike": Zap,
  "Care Package": Plus,
  "Restoration": Heart,
  "Guardian": Shield,
};

function GameCard({ card }: { card: CardType }) {
  const config = elementConfig[card.element];
  const ElementIcon = config.icon;
  const TraitIcon = card.trait ? traitIcons[card.trait] : null;

  return (
    <div
      className={`relative w-full aspect-[3/4] rounded-lg border-2 ${config.borderColor} overflow-hidden shadow-lg hover-elevate cursor-pointer`}
      data-testid={`card-${card.id}`}
    >
      <div className={`absolute inset-0 ${config.bgColor} opacity-90`} />
      <div className="relative h-full p-3 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <div className="w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white font-bold text-lg">
            {card.power}
          </div>
          {TraitIcon && (
            <div className="w-6 h-6 bg-black/40 rounded flex items-center justify-center">
              <TraitIcon className="w-4 h-4 text-yellow-400" />
            </div>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center">
          <ElementIcon className="w-12 h-12 text-white/80" />
        </div>

        <div className="mt-auto">
          <h3 className="text-white font-bold text-sm truncate mb-1">{card.name}</h3>
          <div className="flex justify-between text-xs">
            {card.buffModifier > 0 && (
              <Badge variant="secondary" className="bg-green-600/80 text-white text-xs px-1">
                +{card.buffModifier}
              </Badge>
            )}
            {card.debuffModifier > 0 && (
              <Badge variant="secondary" className="bg-red-600/80 text-white text-xs px-1 ml-auto">
                -{card.debuffModifier}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

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
