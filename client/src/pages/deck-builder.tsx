import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Minus, Save, Trash2, Crown, LogIn, Share2, Download, Copy, Check, Sparkles, Loader2, FolderOpen, Edit2 } from "lucide-react";
import { elementConfig, CommanderWithPopup, CardWithPopup, DeckBuilderCard } from "@/components/game-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Card as CardType, Commander, Element, UserDeck } from "@shared/schema";
import { GAME_CONSTANTS, getCardRarity } from "@shared/schema";
import { useFeatureFlag } from "@/lib/config";

type Playstyle = "aggressive" | "defensive" | "balanced";

interface CollectionEntry {
  cardId: string;
  quantity: number;
}

interface DeckSuggestion {
  deckName: string;
  strategy: string;
  commanderId: string;
  cards: { id: string; count: number }[];
}

export default function DeckBuilderPage() {
  const { toast } = useToast();
  const [deckName, setDeckName] = useState("My Deck");
  const [selectedCommander, setSelectedCommander] = useState<string | null>(null);
  const [deckCards, setDeckCards] = useState<Map<string, number>>(new Map());
  const [selectedElement, setSelectedElement] = useState<Element | "all">("all");
  const [importCode, setImportCode] = useState("");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [playstyle, setPlaystyle] = useState<Playstyle>("balanced");
  const [aiSuggestion, setAiSuggestion] = useState<DeckSuggestion | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [savedDecksOpen, setSavedDecksOpen] = useState(false);
  const [viewingDeckId, setViewingDeckId] = useState<string | null>(null);

  const { data: cards = [] } = useQuery<CardType[]>({
    queryKey: ["/api/cards"],
  });

  const { data: commanders = [] } = useQuery<Commander[]>({
    queryKey: ["/api/commanders"],
  });

  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const economyEnabled = useFeatureFlag("economy_enabled");

  const { data: collection = [] } = useQuery<CollectionEntry[]>({
    queryKey: ["/api/collection"],
    enabled: isAuthenticated && economyEnabled,
  });

  const ownedMap = useMemo(() => {
    const map = new Map<string, number>();
    collection.forEach(e => map.set(e.cardId, e.quantity));
    return map;
  }, [collection]);

  const { data: savedDecks = [], isLoading: decksLoading } = useQuery<UserDeck[]>({
    queryKey: ["/api/user-decks"],
    enabled: isAuthenticated,
  });

  const saveDeckMutation = useMutation({
    mutationFn: async (deck: { name: string; commanderId: string; cardIds: string[] }) => {
      if (editingDeckId) {
        const res = await apiRequest("PATCH", `/api/user-decks/${editingDeckId}`, deck);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/user-decks", deck);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-decks"] });
      toast({ title: editingDeckId ? "Deck updated!" : "Deck saved to your account!" });
      setEditingDeckId(null);
    },
    onError: () => {
      toast({ title: "Failed to save deck", variant: "destructive" });
    },
  });

  const deleteDeckMutation = useMutation({
    mutationFn: async (deckId: string) => {
      await apiRequest("DELETE", `/api/user-decks/${deckId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-decks"] });
      toast({ title: "Deck deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete deck", variant: "destructive" });
    },
  });

  const aiSuggestionMutation = useMutation({
    mutationFn: async ({ commanderId, playstyle }: { commanderId: string; playstyle: Playstyle }) => {
      const res = await apiRequest("POST", "/api/deck-suggestions", { commanderId, playstyle });
      return res.json() as Promise<DeckSuggestion>;
    },
    onSuccess: (data) => {
      setAiSuggestion(data);
      toast({ title: "AI deck suggestion generated!" });
    },
    onError: () => {
      toast({ title: "Failed to generate suggestion. Please try again.", variant: "destructive" });
    },
  });

  const applySuggestion = () => {
    if (!aiSuggestion) return;

    // Set commander
    setSelectedCommander(aiSuggestion.commanderId);
    setDeckName(aiSuggestion.deckName);

    // Set cards
    const newDeck = new Map<string, number>();
    aiSuggestion.cards.forEach(({ id, count }) => {
      newDeck.set(id, count);
    });
    setDeckCards(newDeck);
    setAiDialogOpen(false);
    setAiSuggestion(null);
    toast({ title: "Deck applied! Review and save when ready." });
  };

  const uniqueCards = useMemo(() => {
    // Show all unique cards by element-power-name (same logic as Card Database)
    const seen = new Map<string, CardType>();
    cards.forEach((card) => {
      const key = `${card.element}-${card.power}-${card.name.split('#')[0].trim()}`;
      if (!seen.has(key)) {
        seen.set(key, card);
      }
    });
    let result = Array.from(seen.values())
      .filter((card) => selectedElement === "all" || card.element === selectedElement)
      .sort((a, b) => {
        if (a.element !== b.element) return a.element.localeCompare(b.element);
        if (a.power !== b.power) return a.power - b.power;
        return a.name.localeCompare(b.name);
      });

    if (economyEnabled && isAuthenticated) {
      result = result.map(card => ({
        ...card,
        _owned: ownedMap.get(card.id) ?? 0,
      }));
    }

    return result;
  }, [cards, selectedElement, economyEnabled, isAuthenticated, ownedMap]);

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
    if (!isValidDeck || !user) {
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
      commanderId: selectedCommander!,
      cardIds,
    });
  };

  const loadSavedDeck = (deck: UserDeck) => {
    setDeckName(deck.name);
    setSelectedCommander(deck.commanderId);
    setEditingDeckId(deck.id);
    
    // Convert cardIds array to count map
    const cardCountMap = new Map<string, number>();
    deck.cardIds.forEach((cardId) => {
      cardCountMap.set(cardId, (cardCountMap.get(cardId) || 0) + 1);
    });
    setDeckCards(cardCountMap);
    setSavedDecksOpen(false);
    toast({ title: `Loaded "${deck.name}"` });
  };

  const startNewDeck = () => {
    setEditingDeckId(null);
    setDeckName("My Deck");
    setSelectedCommander(null);
    setDeckCards(new Map());
  };

  const generateDeckCode = () => {
    const deckData = {
      n: deckName,
      c: selectedCommander,
      d: Array.from(deckCards.entries()).map(([id, count]) => `${id}:${count}`),
    };
    return btoa(JSON.stringify(deckData));
  };

  const copyDeckCode = () => {
    const code = generateDeckCode();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Deck code copied to clipboard!" });
  };

  const importDeck = () => {
    try {
      const decoded = atob(importCode);
      const data = JSON.parse(decoded);
      
      // Validate commander exists
      if (data.c) {
        const commanderExists = commanders.some((c) => c.id === data.c);
        if (!commanderExists) {
          toast({ title: "Invalid commander in deck code", variant: "destructive" });
          return;
        }
        setSelectedCommander(data.c);
      }
      
      if (data.n && typeof data.n === "string") {
        setDeckName(data.n.substring(0, 50)); // Limit name length
      }
      
      if (data.d && Array.isArray(data.d)) {
        const newDeck = new Map<string, number>();
        const powerCounts: Record<number, number> = {};
        for (let i = 1; i <= 10; i++) powerCounts[i] = 0;
        let totalAdded = 0;
        
        for (const entry of data.d) {
          if (typeof entry !== "string") continue;
          const [id, countStr] = entry.split(":");
          
          // Validate card exists
          const card = cards.find((c) => c.id === id);
          if (!card) continue;
          
          let count = parseInt(countStr) || 1;
          
          // Enforce max copies per card
          count = Math.min(count, GAME_CONSTANTS.MAX_COPIES_PER_CARD);
          
          // Enforce power rank limits
          const availableForPower = GAME_CONSTANTS.CARDS_PER_POWER_RANK - (powerCounts[card.power] || 0);
          count = Math.min(count, availableForPower);
          
          // Enforce total deck size
          const availableTotal = GAME_CONSTANTS.DECK_SIZE - totalAdded;
          count = Math.min(count, availableTotal);
          
          if (count > 0) {
            newDeck.set(id, count);
            powerCounts[card.power] = (powerCounts[card.power] || 0) + count;
            totalAdded += count;
          }
        }
        setDeckCards(newDeck);
      }
      
      setImportDialogOpen(false);
      setImportCode("");
      toast({ title: "Deck imported successfully!" });
    } catch {
      toast({ title: "Invalid deck code", variant: "destructive" });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-purple-200">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-purple-500/20 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Crown className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Sign In to Build Decks</h2>
            <p className="text-purple-200 mb-6">Sign in to create and save your custom decks.</p>
            <Button 
              className="bg-gradient-to-r from-purple-600 to-pink-600" 
              data-testid="button-login"
              onClick={() => { window.location.href = "/api/login"; }}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
              <CardContent className="p-6 pt-[155px] pb-[155px]">
                <div className="flex flex-wrap justify-evenly items-center gap-6">
                  {commanders.map((commander) => (
                    <div 
                      key={commander.id}
                      className="commander-container flex items-center justify-center p-2 border-2 border-dashed border-purple-500/50 rounded-xl"
                      data-testid={`commander-container-${commander.id}`}
                    >
                      <CommanderWithPopup
                        commander={commander}
                        size="xl"
                        onClick={() => setSelectedCommander(commander.id)}
                        selected={selectedCommander === commander.id}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-purple-500/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-white">Available Cards</CardTitle>
                    <span className="text-purple-300 text-sm" data-testid="text-available-count">
                      ({uniqueCards.length} cards)
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={selectedElement === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedElement("all")}
                      data-testid="deck-filter-all"
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
                          data-testid={`deck-filter-${element.toLowerCase()}`}
                        >
                          <Icon className={`w-4 h-4 ${config.color}`} />
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="flex flex-wrap gap-4 justify-start pb-4">
                    {uniqueCards.map((card) => {
                      const count = deckCards.get(card.id) || 0;
                      const powerCount = powerCounts[card.power];
                      const owned = (card as any)._owned as number | undefined;
                      const maxByOwnership = economyEnabled && isAuthenticated && owned !== undefined
                        ? Math.min(GAME_CONSTANTS.MAX_COPIES_PER_CARD, owned)
                        : GAME_CONSTANTS.MAX_COPIES_PER_CARD;
                      const canAdd = count < maxByOwnership && 
                        powerCount < GAME_CONSTANTS.CARDS_PER_POWER_RANK &&
                        totalCards < GAME_CONSTANTS.DECK_SIZE;

                      return (
                        <div key={card.id} className="relative">
                          <DeckBuilderCard
                            card={card}
                            count={count}
                            maxCopies={maxByOwnership}
                            canAdd={canAdd}
                            onAdd={() => addCard(card.id)}
                            onRemove={() => removeCard(card.id)}
                          />
                          {economyEnabled && isAuthenticated && owned !== undefined && (
                            <Badge
                              data-testid={`badge-owned-${card.id}`}
                              className={`absolute top-1 right-1 text-[10px] px-1 py-0 ${
                                owned === 0 ? "bg-red-600/80" : "bg-emerald-600/80"
                              }`}
                            >
                              {owned === 0 ? "Not Owned" : `x${owned}`}
                            </Badge>
                          )}
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
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">
                    {editingDeckId ? (
                      <span className="flex items-center gap-2">
                        <Edit2 className="w-4 h-4 text-blue-400" />
                        Editing Deck
                      </span>
                    ) : (
                      "Your Deck"
                    )}
                  </CardTitle>
                  <Dialog open={savedDecksOpen} onOpenChange={setSavedDecksOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-saved-decks">
                        <FolderOpen className="w-4 h-4 mr-2" />
                        My Decks ({savedDecks.length})
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-800 border-purple-500/30 max-w-4xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                          <FolderOpen className="w-5 h-5 text-purple-400" />
                          Your Saved Decks
                        </DialogTitle>
                      </DialogHeader>
                      <div className="flex gap-4">
                        {/* Deck List */}
                        <div className="w-1/3 space-y-3">
                          <Button 
                            onClick={() => { startNewDeck(); setSavedDecksOpen(false); setViewingDeckId(null); }} 
                            className="w-full bg-gradient-to-r from-green-600 to-teal-600"
                            data-testid="button-new-deck"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Create New Deck
                          </Button>
                          {decksLoading ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                            </div>
                          ) : savedDecks.length === 0 ? (
                            <div className="text-center py-8">
                              <p className="text-purple-300">No saved decks yet.</p>
                              <p className="text-purple-400 text-sm">Build and save your first deck!</p>
                            </div>
                          ) : (
                            <ScrollArea className="h-[400px]">
                              <div className="space-y-2">
                                {savedDecks.map((deck) => {
                                  const cmd = commanders.find((c) => c.id === deck.commanderId);
                                  const cmdConfig = cmd ? elementConfig[cmd.element] : null;
                                  const isViewing = viewingDeckId === deck.id;
                                  return (
                                    <div 
                                      key={deck.id}
                                      className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                                        isViewing
                                          ? "bg-purple-500/20 border-purple-500/50" 
                                          : editingDeckId === deck.id 
                                            ? "bg-blue-500/20 border-blue-500/50" 
                                            : "bg-slate-900/50 border-purple-500/30 hover:border-purple-500/50"
                                      }`}
                                      onClick={() => setViewingDeckId(isViewing ? null : deck.id)}
                                      data-testid={`deck-item-${deck.id}`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-white font-medium truncate">{deck.name}</p>
                                          <p className="text-purple-300 text-sm flex items-center gap-1">
                                            {cmd && cmdConfig && (
                                              <>
                                                <Crown className="w-3 h-3 text-yellow-500" />
                                                {cmd.name}
                                              </>
                                            )}
                                          </p>
                                        </div>
                                        <div className="flex gap-1">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={(e) => { e.stopPropagation(); loadSavedDeck(deck); setSavedDecksOpen(false); setViewingDeckId(null); }}
                                            data-testid={`load-deck-${deck.id}`}
                                          >
                                            <Edit2 className="w-3 h-3 mr-1" />
                                            Load
                                          </Button>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                            onClick={(e) => { e.stopPropagation(); deleteDeckMutation.mutate(deck.id); if (viewingDeckId === deck.id) setViewingDeckId(null); }}
                                            disabled={deleteDeckMutation.isPending}
                                            data-testid={`delete-deck-${deck.id}`}
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </ScrollArea>
                          )}
                        </div>
                        
                        {/* Card Preview Panel */}
                        <div className="w-2/3 border-l border-purple-500/30 pl-4">
                          {viewingDeckId ? (
                            (() => {
                              const viewingDeck = savedDecks.find(d => d.id === viewingDeckId);
                              if (!viewingDeck) return null;
                              const viewingCards = viewingDeck.cardIds.map(id => cards.find(c => c.id === id)).filter(Boolean) as CardType[];
                              const viewingCmd = commanders.find(c => c.id === viewingDeck.commanderId);
                              
                              // Calculate power distribution for viewing deck
                              const powerCounts: Record<number, number> = {};
                              viewingCards.forEach(card => {
                                powerCounts[card.power] = (powerCounts[card.power] || 0) + 1;
                              });
                              
                              return (
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                    <h3 className="text-white font-bold text-lg">{viewingDeck.name}</h3>
                                    <Badge className="bg-purple-600">{viewingCards.length}/40 cards</Badge>
                                  </div>
                                  
                                  {/* Commander */}
                                  {viewingCmd && (
                                    <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2">
                                      <Crown className="w-5 h-5 text-yellow-500" />
                                      <span className="text-white font-medium">{viewingCmd.name}</span>
                                      <Badge variant="outline" className="text-yellow-300 border-yellow-500/50">{viewingCmd.element}</Badge>
                                    </div>
                                  )}
                                  
                                  {/* Power Distribution Chart */}
                                  <div className="bg-slate-900/50 rounded-lg p-3 border border-purple-500/20">
                                    <p className="text-purple-300 text-sm mb-2">Power Distribution (need 4 each)</p>
                                    <div className="grid grid-cols-10 gap-1">
                                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((power) => {
                                        const count = powerCounts[power] || 0;
                                        const isValid = count === 4;
                                        return (
                                          <div
                                            key={power}
                                            className={`text-center p-1 rounded text-xs ${
                                              isValid
                                                ? "bg-green-500/20 border border-green-500/50 text-green-300"
                                                : count > 4
                                                  ? "bg-red-500/20 border border-red-500/50 text-red-300"
                                                  : "bg-slate-800/50 border border-slate-600/50 text-slate-400"
                                            }`}
                                          >
                                            <div className="font-bold">{power}</div>
                                            <div className="text-[10px]">{count}/4</div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  
                                  {/* Card Grid */}
                                  <ScrollArea className="h-[250px]">
                                    <div className="flex flex-wrap gap-2 justify-start">
                                      {viewingCards.map((card, i) => (
                                        <CardWithPopup
                                          key={`${card.id}-${i}`}
                                          card={card}
                                          size="sm"
                                        />
                                      ))}
                                    </div>
                                  </ScrollArea>
                                </div>
                              );
                            })()
                          ) : (
                            <div className="h-full flex items-center justify-center text-purple-400">
                              <div className="text-center">
                                <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>Select a deck to view its cards</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
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
                    onClick={() => { clearDeck(); setEditingDeckId(null); }}
                    data-testid="button-clear-deck"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                  <Button
                    className={`flex-1 ${editingDeckId ? 'bg-gradient-to-r from-blue-600 to-cyan-600' : 'bg-gradient-to-r from-purple-600 to-pink-600'}`}
                    onClick={saveDeck}
                    disabled={!isValidDeck || saveDeckMutation.isPending}
                    data-testid="button-save-deck"
                  >
                    {saveDeckMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {editingDeckId ? "Update Deck" : "Save Deck"}
                  </Button>
                </div>

                <div className="flex gap-2 pt-2 border-t border-purple-500/20">
                  <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        disabled={totalCards === 0}
                        data-testid="button-export-deck"
                      >
                        <Share2 className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-800 border-purple-500/30">
                      <DialogHeader>
                        <DialogTitle className="text-white">Export Deck Code</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <p className="text-purple-200 text-sm">Share this code with friends to let them import your deck!</p>
                        <div className="bg-slate-900/50 p-3 rounded-lg">
                          <code className="text-xs text-green-400 break-all block max-h-32 overflow-auto">
                            {generateDeckCode()}
                          </code>
                        </div>
                        <Button onClick={copyDeckCode} className="w-full" data-testid="button-copy-code">
                          {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                          {copied ? "Copied!" : "Copy Code"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex-1" data-testid="button-import-deck">
                        <Download className="w-4 h-4 mr-2" />
                        Import
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-800 border-purple-500/30">
                      <DialogHeader>
                        <DialogTitle className="text-white">Import Deck Code</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <p className="text-purple-200 text-sm">Paste a deck code to import someone else's deck!</p>
                        <Input
                          placeholder="Paste deck code here..."
                          value={importCode}
                          onChange={(e) => setImportCode(e.target.value)}
                          className="bg-slate-900/50 border-purple-500/30 text-white"
                          data-testid="input-import-code"
                        />
                        <Button 
                          onClick={importDeck} 
                          className="w-full bg-gradient-to-r from-green-600 to-teal-600"
                          disabled={!importCode.trim()}
                          data-testid="button-apply-import"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Import Deck
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="pt-2 border-t border-purple-500/20">
                  <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600"
                        data-testid="button-ai-suggest"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        AI Deck Suggestion
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-800 border-purple-500/30 max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-purple-400" />
                          AI Deck Builder
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <p className="text-purple-200 text-sm">
                          Let AI suggest a complete deck based on your selected commander and playstyle!
                        </p>
                        
                        <div className="space-y-2">
                          <label className="text-sm text-purple-300">Commander</label>
                          <Select 
                            value={selectedCommander || ""} 
                            onValueChange={setSelectedCommander}
                          >
                            <SelectTrigger 
                              className="bg-slate-900/50 border-purple-500/30 text-white"
                              data-testid="select-ai-commander"
                            >
                              <SelectValue placeholder="Select a commander" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-purple-500/30">
                              {commanders.map((cmd) => (
                                <SelectItem key={cmd.id} value={cmd.id} className="text-white">
                                  {cmd.name} ({cmd.element})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm text-purple-300">Playstyle</label>
                          <Select 
                            value={playstyle} 
                            onValueChange={(v) => setPlaystyle(v as Playstyle)}
                          >
                            <SelectTrigger 
                              className="bg-slate-900/50 border-purple-500/30 text-white"
                              data-testid="select-ai-playstyle"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-purple-500/30">
                              <SelectItem value="aggressive" className="text-white">
                                Aggressive - High damage, fast wins
                              </SelectItem>
                              <SelectItem value="defensive" className="text-white">
                                Defensive - Survival, outlast opponents
                              </SelectItem>
                              <SelectItem value="balanced" className="text-white">
                                Balanced - Adaptable strategy
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <Button 
                          onClick={() => {
                            if (selectedCommander) {
                              aiSuggestionMutation.mutate({ commanderId: selectedCommander, playstyle });
                            } else {
                              toast({ title: "Please select a commander first", variant: "destructive" });
                            }
                          }}
                          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600"
                          disabled={!selectedCommander || aiSuggestionMutation.isPending}
                          data-testid="button-generate-suggestion"
                        >
                          {aiSuggestionMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              Generate Suggestion
                            </>
                          )}
                        </Button>

                        {aiSuggestion && (
                          <div className="p-4 bg-slate-900/50 rounded-lg border border-purple-500/30 space-y-3">
                            <div>
                              <h4 className="text-white font-semibold">{aiSuggestion.deckName}</h4>
                              <p className="text-purple-200 text-sm mt-1">{aiSuggestion.strategy}</p>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-purple-300">
                                {aiSuggestion.cards.reduce((sum, c) => sum + c.count, 0)} cards suggested
                              </span>
                              <Badge variant="secondary">
                                {commanders.find(c => c.id === aiSuggestion.commanderId)?.element}
                              </Badge>
                            </div>
                            <Button 
                              onClick={applySuggestion}
                              className="w-full bg-gradient-to-r from-green-600 to-teal-600"
                              data-testid="button-apply-suggestion"
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Apply This Deck
                            </Button>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
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
