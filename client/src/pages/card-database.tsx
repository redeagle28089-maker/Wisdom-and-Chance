import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Flame, Droplet, Mountain, Wind, Leaf, Hammer, Trash2, Shield, Loader2, ImageIcon } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Card as CardType, Element, CardImage } from "@shared/schema";

export default function CardDatabasePage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedElement, setSelectedElement] = useState<Element | "all">("all");
  const [selectedPower, setSelectedPower] = useState<number | "all">("all");
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [swapCardId, setSwapCardId] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const { data: cards = [], isLoading } = useQuery<CardType[]>({
    queryKey: ["/api/cards"],
  });

  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    enabled: isAuthenticated,
  });

  const { data: cardImages = [] } = useQuery<CardImage[]>({
    queryKey: ["/api/admin/card-images"],
    enabled: adminCheck?.isAdmin,
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

  const swapImageMutation = useMutation({
    mutationFn: async ({ cardId, imageId }: { cardId: string; imageId: string }) => {
      const res = await apiRequest("POST", "/api/admin/swap-card-image", { cardId, imageId });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Image Swapped",
        description: "Card image has been updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      setShowSwapDialog(false);
      setSwapCardId(null);
      setSelectedImageId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Swap Failed",
        description: error.message || "Failed to swap image",
        variant: "destructive",
      });
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
                  Admin Mode - Hover cards for delete/swap options
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-4 justify-start">
              {displayCards.map((card) => (
                <div key={card.id} className="relative group">
                  <CardWithPopup card={card} size="md" />
                  {isAdmin && (
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <Button
                        size="sm"
                        variant="default"
                        data-testid={`button-swap-image-${card.id}`}
                        onClick={() => {
                          setSwapCardId(card.id);
                          setSelectedImageId(null);
                          setShowSwapDialog(true);
                        }}
                      >
                        <ImageIcon className="w-3 h-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="destructive"
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
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Swap Image Dialog */}
      <Dialog open={showSwapDialog} onOpenChange={setShowSwapDialog}>
        <DialogContent className="bg-slate-800 border-purple-500/30 max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Select Image from Database
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 py-4">
            {cardImages.map((img) => (
              <div
                key={img.id}
                onClick={() => setSelectedImageId(img.id)}
                className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                  selectedImageId === img.id 
                    ? "border-purple-500 ring-2 ring-purple-500/50" 
                    : "border-slate-600 hover:border-purple-400"
                }`}
                data-testid={`swap-select-image-${img.id}`}
              >
                <img 
                  src={img.imageUrl} 
                  alt={img.name}
                  className="w-full aspect-[2/3] object-cover"
                />
                <div className="p-1 bg-slate-700/80">
                  <p className="text-xs text-white truncate text-center">{img.name}</p>
                </div>
              </div>
            ))}
            {cardImages.length === 0 && (
              <div className="col-span-full text-center py-8 text-slate-400">
                No images in database. Upload images in Admin &gt; Image Database first.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSwapDialog(false)} data-testid="button-cancel-swap">Cancel</Button>
            <Button 
              onClick={() => {
                if (swapCardId && selectedImageId) {
                  swapImageMutation.mutate({ cardId: swapCardId, imageId: selectedImageId });
                }
              }}
              disabled={!selectedImageId || swapImageMutation.isPending}
              data-testid="button-confirm-swap"
            >
              {swapImageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply Image"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
