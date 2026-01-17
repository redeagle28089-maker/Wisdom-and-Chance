import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { 
  Wand2, 
  Image as ImageIcon, 
  Loader2, 
  Shield, 
  LogIn,
  Flame,
  Droplet,
  Mountain,
  Wind,
  Leaf,
  Crown,
  Download,
  Trash2
} from "lucide-react";
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
import type { Card as CardType, Commander, Element } from "@shared/schema";

const elementConfig: Record<Element, { icon: typeof Flame; color: string; bg: string }> = {
  Fire: { icon: Flame, color: "text-red-500", bg: "bg-red-600/20" },
  Water: { icon: Droplet, color: "text-blue-500", bg: "bg-blue-600/20" },
  Earth: { icon: Mountain, color: "text-amber-500", bg: "bg-amber-600/20" },
  Air: { icon: Wind, color: "text-green-400", bg: "bg-green-400/20" },
  Nature: { icon: Leaf, color: "text-emerald-500", bg: "bg-emerald-600/20" },
};

export default function AdminCardArtPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [selectedElement, setSelectedElement] = useState<Element>("Fire");
  const [prompt, setPrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedCommanderId, setSelectedCommanderId] = useState<string | null>(null);
  const [cardType, setCardType] = useState<"unit" | "commander">("unit");

  const { data: adminCheck, isLoading: adminLoading } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    enabled: isAuthenticated,
  });

  const { data: cards = [] } = useQuery<CardType[]>({
    queryKey: ["/api/cards"],
    enabled: adminCheck?.isAdmin,
  });

  const { data: commanders = [] } = useQuery<Commander[]>({
    queryKey: ["/api/commanders"],
    enabled: adminCheck?.isAdmin,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/generate-card-art", {
        prompt,
        element: selectedElement,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedImage(data.imageUrl);
      toast({
        title: "Art Generated",
        description: "Your card art has been generated successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate art",
        variant: "destructive",
      });
    },
  });

  const updateCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      if (!generatedImage) throw new Error("No image to save");
      const res = await apiRequest("PATCH", `/api/admin/cards/${cardId}`, {
        imageUrl: generatedImage,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Card Updated",
        description: "Card art has been saved successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update card",
        variant: "destructive",
      });
    },
  });

  const updateCommanderMutation = useMutation({
    mutationFn: async (commanderId: string) => {
      if (!generatedImage) throw new Error("No image to save");
      const res = await apiRequest("PATCH", `/api/admin/commanders/${commanderId}`, {
        imageUrl: generatedImage,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Commander Updated",
        description: "Commander art has been saved successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/commanders"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update commander",
        variant: "destructive",
      });
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/cards/${cardId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Card Deleted",
        description: "Card has been removed from the database.",
      });
      setSelectedCardId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete card",
        variant: "destructive",
      });
    },
  });

  const filteredCards = cards.filter((c) => c.element === selectedElement);
  const filteredCommanders = commanders.filter((c) => c.element === selectedElement);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-purple-200">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-6 flex items-center justify-center">
        <Card className="max-w-md bg-slate-800/80 border-purple-500/30">
          <CardContent className="p-8 text-center">
            <LogIn className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Login Required</h2>
            <p className="text-purple-200 mb-6">Please sign in to access this page.</p>
            <Button 
              className="gap-2" 
              data-testid="button-login"
              onClick={() => { window.location.href = "/api/login"; }}
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!adminCheck?.isAdmin) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-6 flex items-center justify-center">
        <Card className="max-w-md bg-slate-800/80 border-red-500/30">
          <CardContent className="p-8 text-center">
            <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-slate-300 mb-4">This page is restricted to administrators only.</p>
            <Link href="/">
              <Button variant="outline" data-testid="button-go-home">
                Return Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ElementIcon = elementConfig[selectedElement].icon;

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Admin: Card Art Generator</h1>
            <p className="text-purple-300 text-sm">Generate AI-powered artwork for cards and commanders</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-slate-800/80 border-purple-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Wand2 className="w-5 h-5 text-purple-400" />
                  Generate Card Art
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-purple-200">Element</Label>
                    <Select 
                      value={selectedElement} 
                      onValueChange={(v) => setSelectedElement(v as Element)}
                    >
                      <SelectTrigger className="bg-slate-700/50 border-purple-500/30" data-testid="select-element">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["Fire", "Water", "Earth", "Air", "Nature"] as Element[]).map((el) => {
                          const Icon = elementConfig[el].icon;
                          return (
                            <SelectItem key={el} value={el}>
                              <span className="flex items-center gap-2">
                                <Icon className={`w-4 h-4 ${elementConfig[el].color}`} />
                                {el}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-purple-200">Card Type</Label>
                    <Select value={cardType} onValueChange={(v) => setCardType(v as "unit" | "commander")}>
                      <SelectTrigger className="bg-slate-700/50 border-purple-500/30" data-testid="select-card-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unit">Unit Card</SelectItem>
                        <SelectItem value="commander">Commander</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-purple-200">Art Description</Label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the art you want to generate... e.g., 'A fierce fire warrior in battle stance with flames swirling around'"
                    className="min-h-[100px] bg-slate-700/50 border-purple-500/30 text-white placeholder:text-slate-400"
                    data-testid="input-prompt"
                  />
                </div>

                <Button
                  onClick={() => generateMutation.mutate()}
                  disabled={!prompt.trim() || generateMutation.isPending}
                  className="w-full gap-2"
                  data-testid="button-generate"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      Generate Art
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {generatedImage && (
              <Card className="bg-slate-800/80 border-purple-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <ImageIcon className="w-5 h-5 text-green-400" />
                    Generated Art
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative aspect-square max-w-md mx-auto rounded-lg overflow-hidden border-2 border-purple-500/50">
                    <img 
                      src={generatedImage} 
                      alt="Generated card art"
                      className="w-full h-full object-cover"
                      data-testid="img-generated"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 justify-center">
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = generatedImage;
                        link.download = `card-art-${selectedElement.toLowerCase()}-${Date.now()}.png`;
                        link.click();
                      }}
                      data-testid="button-download"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card className="bg-slate-800/80 border-purple-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <ElementIcon className={`w-5 h-5 ${elementConfig[selectedElement].color}`} />
                  {cardType === "unit" ? "Unit Cards" : "Commanders"} - {selectedElement}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  <Tabs defaultValue="select">
                    <TabsList className="w-full mb-4">
                      <TabsTrigger value="select" className="flex-1">Select</TabsTrigger>
                      <TabsTrigger value="preview" className="flex-1">Preview</TabsTrigger>
                    </TabsList>

                    <TabsContent value="select" className="space-y-2">
                      {cardType === "unit" ? (
                        filteredCards.length > 0 ? (
                          filteredCards.slice(0, 40).map((card) => (
                            <div
                              key={card.id}
                              className={`p-3 rounded-lg transition-all ${
                                selectedCardId === card.id
                                  ? "bg-purple-600/30 border border-purple-500"
                                  : "bg-slate-700/30 hover:bg-slate-700/50 border border-transparent"
                              }`}
                              data-testid={`card-select-${card.id}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div 
                                  className="flex-1 cursor-pointer" 
                                  onClick={() => setSelectedCardId(card.id)}
                                >
                                  <span className="text-white font-medium text-sm truncate block">{card.name}</span>
                                </div>
                                <Badge variant="outline" className="text-xs shrink-0">
                                  Power {card.power}
                                </Badge>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="h-7 w-7 shrink-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                                      data-testid={`button-delete-${card.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="bg-slate-800 border-purple-500/30">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="text-white">Delete Card</AlertDialogTitle>
                                      <AlertDialogDescription className="text-slate-300">
                                        Are you sure you want to delete "{card.name}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="bg-slate-700 text-white border-slate-600 hover:bg-slate-600">
                                        Cancel
                                      </AlertDialogCancel>
                                      <AlertDialogAction 
                                        className="bg-red-600 hover:bg-red-700"
                                        onClick={() => deleteCardMutation.mutate(card.id)}
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                              {card.imageUrl && (
                                <Badge className="mt-1 text-xs bg-green-600/50">Has Custom Art</Badge>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-slate-400 text-center py-4">No cards found</p>
                        )
                      ) : (
                        filteredCommanders.length > 0 ? (
                          filteredCommanders.map((commander) => (
                            <div
                              key={commander.id}
                              onClick={() => setSelectedCommanderId(commander.id)}
                              className={`p-3 rounded-lg cursor-pointer transition-all ${
                                selectedCommanderId === commander.id
                                  ? "bg-purple-600/30 border border-purple-500"
                                  : "bg-slate-700/30 hover:bg-slate-700/50 border border-transparent"
                              }`}
                              data-testid={`commander-select-${commander.id}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-white font-medium text-sm">{commander.name}</span>
                                <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-400/50">
                                  Commander
                                </Badge>
                              </div>
                              <p className="text-purple-300 text-xs italic mt-1">{commander.title}</p>
                              {commander.imageUrl && (
                                <Badge className="mt-1 text-xs bg-green-600/50">Has Custom Art</Badge>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-slate-400 text-center py-4">No commanders found</p>
                        )
                      )}
                    </TabsContent>

                    <TabsContent value="preview">
                      {cardType === "unit" && selectedCardId ? (
                        <div className="text-center">
                          {(() => {
                            const selectedCard = cards.find((c) => c.id === selectedCardId);
                            if (!selectedCard) return <p className="text-slate-400">Card not found</p>;
                            return (
                              <div className="space-y-4">
                                <div className="text-white font-bold">{selectedCard.name}</div>
                                {selectedCard.imageUrl ? (
                                  <img
                                    src={selectedCard.imageUrl}
                                    alt={selectedCard.name}
                                    className="w-full max-w-[200px] mx-auto rounded-lg border border-purple-500/50"
                                  />
                                ) : (
                                  <div className="w-full max-w-[200px] mx-auto aspect-square rounded-lg bg-slate-700/50 flex items-center justify-center">
                                    <ImageIcon className="w-12 h-12 text-slate-500" />
                                  </div>
                                )}
                                {generatedImage && (
                                  <Button
                                    onClick={() => updateCardMutation.mutate(selectedCardId)}
                                    disabled={updateCardMutation.isPending}
                                    className="w-full gap-2"
                                    data-testid="button-save-to-card"
                                  >
                                    {updateCardMutation.isPending ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : null}
                                    Save Generated Art to Card
                                  </Button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      ) : cardType === "commander" && selectedCommanderId ? (
                        <div className="text-center">
                          {(() => {
                            const selectedCommander = commanders.find((c) => c.id === selectedCommanderId);
                            if (!selectedCommander) return <p className="text-slate-400">Commander not found</p>;
                            return (
                              <div className="space-y-4">
                                <div className="text-white font-bold">{selectedCommander.name}</div>
                                <p className="text-purple-300 text-sm italic">{selectedCommander.title}</p>
                                {selectedCommander.imageUrl ? (
                                  <img
                                    src={selectedCommander.imageUrl}
                                    alt={selectedCommander.name}
                                    className="w-full max-w-[200px] mx-auto rounded-lg border border-yellow-500/50"
                                  />
                                ) : (
                                  <div className="w-full max-w-[200px] mx-auto aspect-square rounded-lg bg-slate-700/50 flex items-center justify-center">
                                    <Crown className="w-12 h-12 text-yellow-500/50" />
                                  </div>
                                )}
                                {generatedImage && (
                                  <Button
                                    onClick={() => updateCommanderMutation.mutate(selectedCommanderId)}
                                    disabled={updateCommanderMutation.isPending}
                                    className="w-full gap-2"
                                    data-testid="button-save-to-commander"
                                  >
                                    {updateCommanderMutation.isPending ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : null}
                                    Save Generated Art to Commander
                                  </Button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <p className="text-slate-400 text-center py-4">
                          Select a {cardType === "unit" ? "card" : "commander"} from the Select tab
                        </p>
                      )}
                    </TabsContent>
                  </Tabs>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
