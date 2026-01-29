import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Flame, Droplet, Mountain, Wind, Leaf, Hammer, Trash2, Shield, Loader2 } from "lucide-react";
import { CardWithPopup, elementConfig } from "@/components/game-card";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Card as CardType, Element } from "@shared/schema";

export default function CardDatabasePage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedElement, setSelectedElement] = useState<Element | "all">("all");
  const [selectedPower, setSelectedPower] = useState<number | "all">("all");
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const { data: cards = [], isLoading } = useQuery<CardType[]>({
    queryKey: ["/api/cards"],
  });

  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    enabled: isAuthenticated,
  });

  const isAdmin = adminCheck?.isAdmin ?? false;

  const deleteMutation = useMutation({
    mutationFn: async (cardId: string) => {
      setDeletingCardId(cardId);
      const res = await apiRequest("DELETE", `/api/admin/cards/${cardId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Card Deleted",
        description: "The card has been removed from the game database.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      setDeletingCardId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete card",
        variant: "destructive",
      });
      setDeletingCardId(null);
    },
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
          <p className="text-lg text-purple-200 mb-4">Browse all available cards</p>
          <Button 
            onClick={() => navigate("/deck-builder")}
            className="bg-purple-600 hover:bg-purple-700"
            data-testid="button-build-deck"
          >
            <Hammer className="w-4 h-4 mr-2" />
            Build a Deck
          </Button>
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
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="text-purple-300" data-testid="text-card-count">
                Showing {displayCards.length} unique cards
              </p>
              {isAdmin && (
                <Badge className="bg-amber-600/50 text-amber-100 gap-1">
                  <Shield className="w-3 h-3" />
                  Admin Mode - Click trash icon to delete cards
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {displayCards.map((card) => (
                <div key={card.id} className="relative group">
                  <CardWithPopup card={card} />
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          data-testid={`button-delete-card-${card.id}`}
                          disabled={deletingCardId === card.id}
                        >
                          {deletingCardId === card.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-slate-800 border-red-500/30">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white">Delete Card</AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-300">
                            Are you sure you want to delete "{card.name}"? This will permanently remove the card from the game database. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-slate-700 text-white border-slate-600 hover:bg-slate-600">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction 
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => deleteMutation.mutate(card.id)}
                          >
                            Delete Card
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
