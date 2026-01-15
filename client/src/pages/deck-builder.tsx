import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Flame, Droplet, Mountain, Wind, Leaf, Plus, Minus, Save, Trash2, Crown } from "lucide-react";
import type { Card as CardType, Commander, Deck, Element, InsertDeck } from "@shared/schema";
import { GAME_CONSTANTS } from "@shared/schema";

const elementConfig: Record<Element, { icon: typeof Flame; color: string; bgColor: string }> = {
  Fire: { icon: Flame, color: "text-red-500", bgColor: "bg-red-600" },
  Water: { icon: Droplet, color: "text-blue-500", bgColor: "bg-blue-600" },
  Earth: { icon: Mountain, color: "text-amber-500", bgColor: "bg-amber-600" },
  Air: { icon: Wind, color: "text-green-400", bgColor: "bg-green-500" },
  Nature: { icon: Leaf, color: "text-emerald-500", bgColor: "bg-emerald-600" },
};

export default function DeckBuilderPage() {
  const { toast } = useToast();
  const [deckName, setDeckName] = useState("My Deck");
  const [selectedCommander, setSelectedCommander] = useState<string | null>(null);
  const [deckCards, setDeckCards] = useState<Map<string, number>>(new Map());
  const [selectedElement, setSelectedElement] = useState<Element | "all">("all");

  const { data: cards = [] } = useQuery<CardType[]>({
    queryKey: ["/api/cards"],
  });

  const { data: commanders = [] } = useQuery<Commander[]>({
    queryKey: ["/api/commanders"],
  });

  const { data: player } = useQuery({
    queryKey: ["/api/guest-player"],
  });

  const saveDeckMutation = useMutation({
    mutationFn: async (deck: InsertDeck) => {
      const res = await apiRequest("POST", "/api/decks", deck);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/decks"] });
      toast({ title: "Deck saved successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to save deck", variant: "destructive" });
    },
  });

  const uniqueCards = useMemo(() => {
    const seen = new Map<string, CardType>();
    cards.forEach((card) => {
      const key = `${card.element}-${card.power}`;
      if (!seen.has(key)) {
        seen.set(key, card);
      }
    });
    return Array.from(seen.values())
      .filter((card) => selectedElement === "all" || card.element === selectedElement)
      .sort((a, b) => {
        if (a.element !== b.element) return a.element.localeCompare(b.element);
        return a.power - b.power;
      });
  }, [cards, selectedElement]);

  const totalCards = Array.from(deckCards.values()).reduce((sum, count) => sum + count, 0);
  const powerCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let i = 1; i <= 10; i++) counts[i] = 0;
    
    deckCards.forEach((count, cardId) => {
      const card = cards.find((c) => c.id === cardId);
      if (card) {
        counts[card.power] = (counts[card.power] || 0) + count;
      }
    });
    return counts;
  }, [deckCards, cards]);

  const isValidDeck = totalCards === GAME_CONSTANTS.DECK_SIZE && 
    selectedCommander !== null &&
    Object.values(powerCounts).every((count) => count === GAME_CONSTANTS.CARDS_PER_POWER_RANK);

  const addCard = (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const currentCount = deckCards.get(cardId) || 0;
    const powerCount = powerCounts[card.power];

    if (currentCount >= GAME_CONSTANTS.MAX_COPIES_PER_CARD) {
      toast({ title: `Maximum ${GAME_CONSTANTS.MAX_COPIES_PER_CARD} copies of any card`, variant: "destructive" });
      return;
    }

    if (powerCount >= GAME_CONSTANTS.CARDS_PER_POWER_RANK) {
      toast({ title: `Already have ${GAME_CONSTANTS.CARDS_PER_POWER_RANK} cards of power ${card.power}`, variant: "destructive" });
      return;
    }

    if (totalCards >= GAME_CONSTANTS.DECK_SIZE) {
      toast({ title: `Deck is full (${GAME_CONSTANTS.DECK_SIZE} cards)`, variant: "destructive" });
      return;
    }

    setDeckCards(new Map(deckCards.set(cardId, currentCount + 1)));
  };

  const removeCard = (cardId: string) => {
    const currentCount = deckCards.get(cardId) || 0;
    if (currentCount <= 0) return;

    const newMap = new Map(deckCards);
    if (currentCount === 1) {
      newMap.delete(cardId);
    } else {
      newMap.set(cardId, currentCount - 1);
    }
    setDeckCards(newMap);
  };

  const clearDeck = () => {
    setDeckCards(new Map());
    setSelectedCommander(null);
  };

  const saveDeck = () => {
    if (!isValidDeck || !player) {
      toast({ title: "Please complete your deck first", variant: "destructive" });
      return;
    }

    const cardIds: string[] = [];
    deckCards.forEach((count, cardId) => {
      for (let i = 0; i < count; i++) {
        cardIds.push(cardId);
      }
    });

    saveDeckMutation.mutate({
      name: deckName,
      playerId: (player as { id: string }).id,
      commanderId: selectedCommander!,
      cardIds,
    });
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2" data-testid="text-deckbuilder-title">Deck Builder</h1>
          <p className="text-lg text-purple-200">Build your 40-card deck</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-slate-800/50 border-purple-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center gap-2">
                  <Crown className="w-5 h-5 text-yellow-500" />
                  Choose Commander
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {commanders.map((commander) => {
                    const config = elementConfig[commander.element];
                    const Icon = config.icon;
                    return (
                      <button
                        key={commander.id}
                        onClick={() => setSelectedCommander(commander.id)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          selectedCommander === commander.id
                            ? "border-yellow-500 bg-yellow-500/20"
                            : "border-purple-500/30 bg-slate-900/50 hover:border-purple-500/50"
                        }`}
                        data-testid={`commander-${commander.id}`}
                      >
                        <div className={`w-10 h-10 ${config.bgColor} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <p className="text-white text-sm font-medium truncate">{commander.name.split(' ')[0]}</p>
                        <p className="text-purple-300 text-xs">{commander.element}</p>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-purple-500/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">Available Cards</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant={selectedElement === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedElement("all")}
                    >
                      All
                    </Button>
                    {Object.entries(elementConfig).map(([element, config]) => {
                      const Icon = config.icon;
                      return (
                        <Button
                          key={element}
                          variant={selectedElement === element ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedElement(element as Element)}
                        >
                          <Icon className={`w-4 h-4 ${config.color}`} />
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {uniqueCards.map((card) => {
                      const config = elementConfig[card.element];
                      const Icon = config.icon;
                      const count = deckCards.get(card.id) || 0;
                      const powerCount = powerCounts[card.power];
                      const canAdd = count < GAME_CONSTANTS.MAX_COPIES_PER_CARD && 
                        powerCount < GAME_CONSTANTS.CARDS_PER_POWER_RANK &&
                        totalCards < GAME_CONSTANTS.DECK_SIZE;

                      return (
                        <div
                          key={card.id}
                          className={`p-3 rounded-lg border ${config.bgColor}/20 border-purple-500/30`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-8 h-8 ${config.bgColor} rounded flex items-center justify-center`}>
                              <span className="text-white font-bold">{card.power}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">{card.name.split('#')[0]}</p>
                              <p className={`text-xs ${config.color}`}>{card.element}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary" className="text-xs">
                              {count}/{GAME_CONSTANTS.MAX_COPIES_PER_CARD}
                            </Badge>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => removeCard(card.id)}
                                disabled={count === 0}
                                data-testid={`remove-${card.id}`}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => addCard(card.id)}
                                disabled={!canAdd}
                                data-testid={`add-${card.id}`}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-slate-800/50 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white">Your Deck</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  placeholder="Deck name"
                  className="bg-slate-900/50 border-purple-500/30 text-white"
                  data-testid="input-deck-name"
                />

                <div className="flex items-center justify-between">
                  <span className="text-purple-200">Total Cards</span>
                  <Badge 
                    variant={totalCards === GAME_CONSTANTS.DECK_SIZE ? "default" : "secondary"}
                    className={totalCards === GAME_CONSTANTS.DECK_SIZE ? "bg-green-600" : ""}
                  >
                    {totalCards}/{GAME_CONSTANTS.DECK_SIZE}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <p className="text-purple-300 text-sm">Power Distribution (need 4 each)</p>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((power) => (
                      <div
                        key={power}
                        className={`text-center p-2 rounded ${
                          powerCounts[power] === 4
                            ? "bg-green-600/50 border border-green-500"
                            : powerCounts[power] > 4
                            ? "bg-red-600/50 border border-red-500"
                            : "bg-slate-900/50 border border-purple-500/30"
                        }`}
                      >
                        <p className="text-white font-bold text-sm">{power}</p>
                        <p className="text-purple-300 text-xs">{powerCounts[power]}/4</p>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedCommander && (
                  <div className="p-3 bg-yellow-500/20 rounded-lg border border-yellow-500/50">
                    <p className="text-yellow-400 text-sm font-medium flex items-center gap-2">
                      <Crown className="w-4 h-4" />
                      {commanders.find((c) => c.id === selectedCommander)?.name}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={clearDeck}
                    data-testid="button-clear-deck"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
                    onClick={saveDeck}
                    disabled={!isValidDeck || saveDeckMutation.isPending}
                    data-testid="button-save-deck"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Deck
                  </Button>
                </div>

                {!isValidDeck && totalCards > 0 && (
                  <p className="text-amber-400 text-sm text-center">
                    {!selectedCommander && "Select a commander. "}
                    {totalCards !== GAME_CONSTANTS.DECK_SIZE && `Need ${GAME_CONSTANTS.DECK_SIZE} cards (have ${totalCards}). `}
                    {Object.entries(powerCounts).some(([, count]) => count !== 4) && "Each power rank needs exactly 4 cards."}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
