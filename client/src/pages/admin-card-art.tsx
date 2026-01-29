import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
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
  Trash2,
  Upload,
  Database,
  ArrowRightLeft,
  Plus,
  Sparkles,
  Palette,
  BarChart3
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Card as CardType, Commander, Element, CardImage } from "@shared/schema";

const elementConfig: Record<Element, { icon: typeof Flame; color: string; bg: string }> = {
  Fire: { icon: Flame, color: "text-red-500", bg: "bg-red-600/20" },
  Water: { icon: Droplet, color: "text-blue-500", bg: "bg-blue-600/20" },
  Earth: { icon: Mountain, color: "text-amber-500", bg: "bg-amber-600/20" },
  Air: { icon: Wind, color: "text-green-400", bg: "bg-green-400/20" },
  Nature: { icon: Leaf, color: "text-emerald-500", bg: "bg-emerald-600/20" },
};

const TRAITS = ["Quick Strike", "Care Package", "Restoration", "Guardian"] as const;
const BUFF_DEBUFF_COLORS = ["Red", "Blue", "Amber", "Green", "Black"] as const;

type GenerationMode = "art" | "stats" | "both";

export default function AdminCardArtPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceImageInputRef = useRef<HTMLInputElement>(null);
  
  // Generation settings
  const [generationMode, setGenerationMode] = useState<GenerationMode>("art");
  const [selectedElement, setSelectedElement] = useState<Element>("Fire");
  const [prompt, setPrompt] = useState("");
  const [cardName, setCardName] = useState("");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedStats, setGeneratedStats] = useState<any>(null);
  
  // Toggleable stat options
  const [generatePower, setGeneratePower] = useState(true);
  const [powerValue, setPowerValue] = useState<number>(5);
  const [generateTrait, setGenerateTrait] = useState(false);
  const [traitValue, setTraitValue] = useState<string>("");
  const [traitModifier, setTraitModifier] = useState<number>(1);
  const [generateBuff, setGenerateBuff] = useState(false);
  const [buffColor, setBuffColor] = useState<string>("");
  const [buffValue, setBuffValue] = useState<number>(1);
  const [generateDebuff, setGenerateDebuff] = useState(false);
  const [debuffColor, setDebuffColor] = useState<string>("");
  const [debuffValue, setDebuffValue] = useState<number>(1);
  
  // Card selection
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedCommanderId, setSelectedCommanderId] = useState<string | null>(null);
  const [cardType, setCardType] = useState<"unit" | "commander">("unit");
  
  // Image database dialogs
  const [showImageDatabase, setShowImageDatabase] = useState(false);
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [selectedImageForSwap, setSelectedImageForSwap] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [saveToDbName, setSaveToDbName] = useState("");

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

  const { data: cardImages = [] } = useQuery<CardImage[]>({
    queryKey: ["/api/admin/card-images"],
    enabled: adminCheck?.isAdmin,
  });

  // Generate card mutation (enhanced)
  const generateMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        mode: generationMode,
        prompt,
        element: selectedElement,
        cardName: cardName || undefined,
        referenceImageBase64: referenceImage || undefined,
        generatePower,
        powerValue: generatePower ? powerValue : undefined,
        generateTrait,
        traitValue: generateTrait && traitValue ? traitValue : undefined,
        traitModifier: generateTrait ? traitModifier : undefined,
        generateBuff,
        buffColor: generateBuff && buffColor ? buffColor : undefined,
        buffValue: generateBuff ? buffValue : undefined,
        generateDebuff,
        debuffColor: generateDebuff && debuffColor ? debuffColor : undefined,
        debuffValue: generateDebuff ? debuffValue : undefined,
      };
      
      const res = await apiRequest("POST", "/api/admin/generate-card", payload);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.imageUrl) {
        setGeneratedImage(data.imageUrl);
      }
      if (data.stats) {
        setGeneratedStats(data.stats);
      }
      if (data.card) {
        toast({
          title: "Card Created",
          description: `New card "${data.card.name}" has been added to the game database!`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      } else {
        toast({
          title: "Generation Complete",
          description: generationMode === "art" ? "Art generated!" : generationMode === "stats" ? "Stats generated!" : "Card generated!",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate",
        variant: "destructive",
      });
    },
  });

  // Save to image database mutation
  const saveToDbMutation = useMutation({
    mutationFn: async () => {
      if (!generatedImage || !saveToDbName) throw new Error("No image or name");
      const res = await apiRequest("POST", "/api/admin/card-images", {
        name: saveToDbName,
        imageUrl: generatedImage,
        element: selectedElement,
        cardType: cardType,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Saved to Image Database",
        description: "Art has been saved to your image database!",
      });
      setSaveToDbName("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/card-images"] });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save to database",
        variant: "destructive",
      });
    },
  });

  // Upload image from computer mutation
  const uploadMutation = useMutation({
    mutationFn: async (imageBase64: string) => {
      const res = await apiRequest("POST", "/api/admin/upload-card-image", {
        name: uploadName,
        imageBase64,
        element: selectedElement,
        cardType: cardType,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Image Uploaded",
        description: "Image has been uploaded to the database!",
      });
      setUploadName("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/card-images"] });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
    },
  });

  // Swap image mutation
  const swapImageMutation = useMutation({
    mutationFn: async ({ cardId, commanderId, imageId }: { cardId?: string; commanderId?: string; imageId: string }) => {
      if (commanderId) {
        const res = await apiRequest("POST", "/api/admin/swap-commander-image", { commanderId, imageId });
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/admin/swap-card-image", { cardId, imageId });
        return res.json();
      }
    },
    onSuccess: () => {
      toast({
        title: "Image Swapped",
        description: "Card/Commander image has been updated!",
      });
      setShowSwapDialog(false);
      setSelectedImageForSwap(null);
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/commanders"] });
    },
    onError: (error: any) => {
      toast({
        title: "Swap Failed",
        description: error.message || "Failed to swap image",
        variant: "destructive",
      });
    },
  });

  // Delete image mutation
  const deleteImageMutation = useMutation({
    mutationFn: async (imageId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/card-images/${imageId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Image Deleted",
        description: "Image has been removed from the database.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/card-images"] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete image",
        variant: "destructive",
      });
    },
  });

  // Delete game card mutation
  const deleteCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/cards/${cardId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Card Deleted",
        description: "Card has been removed from the game database.",
      });
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

  // Update card with generated art
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

  const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadName) {
      const reader = new FileReader();
      reader.onloadend = () => {
        uploadMutation.mutate(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else if (!uploadName) {
      toast({
        title: "Name Required",
        description: "Please enter a name for the image before uploading.",
        variant: "destructive",
      });
    }
  };

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
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Admin: Card Art Generator</h1>
              <p className="text-purple-300 text-sm">Generate AI-powered artwork and stats for cards</p>
            </div>
          </div>
          
          <Link href="/admin/image-database">
            <Button variant="outline" className="gap-2" data-testid="button-image-database">
              <Database className="w-4 h-4" />
              Image Database
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Generation Mode Selection */}
            <Card className="bg-slate-800/80 border-purple-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  Generation Mode
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    variant={generationMode === "art" ? "default" : "outline"}
                    className="gap-2 h-auto py-4 flex-col"
                    onClick={() => setGenerationMode("art")}
                    data-testid="button-mode-art"
                  >
                    <Palette className="w-6 h-6" />
                    <span>Art Only</span>
                    <span className="text-xs opacity-70">Save to Image DB</span>
                  </Button>
                  <Button
                    variant={generationMode === "stats" ? "default" : "outline"}
                    className="gap-2 h-auto py-4 flex-col"
                    onClick={() => setGenerationMode("stats")}
                    data-testid="button-mode-stats"
                  >
                    <BarChart3 className="w-6 h-6" />
                    <span>Stats Only</span>
                    <span className="text-xs opacity-70">Generate values</span>
                  </Button>
                  <Button
                    variant={generationMode === "both" ? "default" : "outline"}
                    className="gap-2 h-auto py-4 flex-col"
                    onClick={() => setGenerationMode("both")}
                    data-testid="button-mode-both"
                  >
                    <Plus className="w-6 h-6" />
                    <span>Art + Stats</span>
                    <span className="text-xs opacity-70">Add to Game DB</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Art Generation Section */}
            {(generationMode === "art" || generationMode === "both") && (
              <Card className="bg-slate-800/80 border-purple-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Wand2 className="w-5 h-5 text-purple-400" />
                    Art Generation
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

                  {generationMode === "both" && (
                    <div className="space-y-2">
                      <Label className="text-purple-200">Card Name</Label>
                      <Input
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        placeholder="Enter card name..."
                        className="bg-slate-700/50 border-purple-500/30 text-white"
                        data-testid="input-card-name"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-purple-200">Art Description</Label>
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe the art you want to generate..."
                      className="min-h-[100px] bg-slate-700/50 border-purple-500/30 text-white placeholder:text-slate-400"
                      data-testid="input-prompt"
                    />
                  </div>

                  {/* Reference Image Upload */}
                  <div className="space-y-2">
                    <Label className="text-purple-200">Reference Image (Optional)</Label>
                    <div className="flex gap-2 items-center">
                      <input
                        ref={referenceImageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleReferenceImageUpload}
                      />
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => referenceImageInputRef.current?.click()}
                        data-testid="button-upload-reference"
                      >
                        <Upload className="w-4 h-4" />
                        Upload Reference
                      </Button>
                      {referenceImage && (
                        <>
                          <Badge className="bg-green-600/50">Reference loaded</Badge>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => setReferenceImage(null)}
                            className="h-8 w-8"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                    {referenceImage && (
                      <img 
                        src={referenceImage} 
                        alt="Reference" 
                        className="w-24 h-24 object-cover rounded-lg border border-purple-500/30"
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Stats Generation Section */}
            {(generationMode === "stats" || generationMode === "both") && (
              <Card className="bg-slate-800/80 border-purple-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <BarChart3 className="w-5 h-5 text-purple-400" />
                    Stats Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Power */}
                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={generatePower}
                        onCheckedChange={setGeneratePower}
                        data-testid="toggle-power"
                      />
                      <Label className="text-purple-200">Power/Rank</Label>
                    </div>
                    {generatePower && (
                      <Select value={String(powerValue)} onValueChange={(v) => setPowerValue(Number(v))}>
                        <SelectTrigger className="w-24 bg-slate-700/50 border-purple-500/30" data-testid="select-power">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Trait */}
                  <div className="p-3 bg-slate-700/30 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={generateTrait}
                          onCheckedChange={setGenerateTrait}
                          data-testid="toggle-trait"
                        />
                        <Label className="text-purple-200">Trait</Label>
                      </div>
                    </div>
                    {generateTrait && (
                      <div className="grid grid-cols-2 gap-3">
                        <Select value={traitValue} onValueChange={setTraitValue}>
                          <SelectTrigger className="bg-slate-700/50 border-purple-500/30" data-testid="select-trait">
                            <SelectValue placeholder="Select trait" />
                          </SelectTrigger>
                          <SelectContent>
                            {TRAITS.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          value={traitModifier}
                          onChange={(e) => setTraitModifier(Number(e.target.value))}
                          placeholder="Modifier"
                          className="bg-slate-700/50 border-purple-500/30 text-white"
                          data-testid="input-trait-modifier"
                        />
                      </div>
                    )}
                  </div>

                  {/* Buff */}
                  <div className="p-3 bg-slate-700/30 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={generateBuff}
                          onCheckedChange={setGenerateBuff}
                          data-testid="toggle-buff"
                        />
                        <Label className="text-purple-200">Buff</Label>
                      </div>
                    </div>
                    {generateBuff && (
                      <div className="grid grid-cols-2 gap-3">
                        <Select value={buffColor} onValueChange={setBuffColor}>
                          <SelectTrigger className="bg-slate-700/50 border-purple-500/30" data-testid="select-buff-color">
                            <SelectValue placeholder="Buff color" />
                          </SelectTrigger>
                          <SelectContent>
                            {BUFF_DEBUFF_COLORS.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          value={buffValue}
                          onChange={(e) => setBuffValue(Number(e.target.value))}
                          placeholder="Value"
                          className="bg-slate-700/50 border-purple-500/30 text-white"
                          data-testid="input-buff-value"
                        />
                      </div>
                    )}
                  </div>

                  {/* Debuff */}
                  <div className="p-3 bg-slate-700/30 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={generateDebuff}
                          onCheckedChange={setGenerateDebuff}
                          data-testid="toggle-debuff"
                        />
                        <Label className="text-purple-200">Debuff</Label>
                      </div>
                    </div>
                    {generateDebuff && (
                      <div className="grid grid-cols-2 gap-3">
                        <Select value={debuffColor} onValueChange={setDebuffColor}>
                          <SelectTrigger className="bg-slate-700/50 border-purple-500/30" data-testid="select-debuff-color">
                            <SelectValue placeholder="Debuff color" />
                          </SelectTrigger>
                          <SelectContent>
                            {BUFF_DEBUFF_COLORS.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          value={debuffValue}
                          onChange={(e) => setDebuffValue(Number(e.target.value))}
                          placeholder="Value"
                          className="bg-slate-700/50 border-purple-500/30 text-white"
                          data-testid="input-debuff-value"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Generate Button */}
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={
                generateMutation.isPending || 
                ((generationMode === "art" || generationMode === "both") && !prompt.trim())
              }
              className="w-full gap-2 h-12 text-lg"
              data-testid="button-generate"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  {generationMode === "art" ? "Generate Art" : generationMode === "stats" ? "Generate Stats" : "Generate Card"}
                </>
              )}
            </Button>

            {/* Generated Results */}
            {(generatedImage || generatedStats) && (
              <Card className="bg-slate-800/80 border-purple-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <ImageIcon className="w-5 h-5 text-green-400" />
                    Generated Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {generatedImage && (
                    <div className="space-y-4">
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

                        {generationMode === "art" && (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" className="gap-2" data-testid="button-save-to-db">
                                <Database className="w-4 h-4" />
                                Save to Image DB
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-800 border-purple-500/30">
                              <DialogHeader>
                                <DialogTitle className="text-white">Save to Image Database</DialogTitle>
                                <DialogDescription className="text-slate-300">
                                  Give this image a name to save it to your image database.
                                </DialogDescription>
                              </DialogHeader>
                              <Input
                                value={saveToDbName}
                                onChange={(e) => setSaveToDbName(e.target.value)}
                                placeholder="Image name..."
                                className="bg-slate-700/50 border-purple-500/30 text-white"
                                data-testid="input-save-name"
                              />
                              <DialogFooter>
                                <Button
                                  onClick={() => saveToDbMutation.mutate()}
                                  disabled={!saveToDbName || saveToDbMutation.isPending}
                                  data-testid="button-confirm-save"
                                >
                                  {saveToDbMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </div>
                  )}

                  {generatedStats && (
                    <div className="p-4 bg-slate-700/30 rounded-lg">
                      <h4 className="text-white font-medium mb-2">Generated Stats:</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {generatedStats.element && (
                          <div className="text-purple-200">Element: <span className="text-white">{generatedStats.element}</span></div>
                        )}
                        {generatedStats.power && (
                          <div className="text-purple-200">Power: <span className="text-white">{generatedStats.power}</span></div>
                        )}
                        {generatedStats.trait && (
                          <div className="text-purple-200">Trait: <span className="text-white">{generatedStats.trait} ({generatedStats.traitValue})</span></div>
                        )}
                        {generatedStats.buffModifier > 0 && (
                          <div className="text-purple-200">Buff: <span className="text-white">+{generatedStats.buffModifier} ({generatedStats.buffColor})</span></div>
                        )}
                        {generatedStats.debuffModifier > 0 && (
                          <div className="text-purple-200">Debuff: <span className="text-white">-{generatedStats.debuffModifier} ({generatedStats.debuffColor})</span></div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Sidebar - Card Selection */}
          <div className="space-y-6">
            {/* Upload Image to Database */}
            <Card className="bg-slate-800/80 border-purple-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Upload className="w-5 h-5 text-green-400" />
                  Upload Image
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="Image name..."
                  className="bg-slate-700/50 border-purple-500/30 text-white"
                  data-testid="input-upload-name"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!uploadName || uploadMutation.isPending}
                  data-testid="button-upload-file"
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Upload from Computer
                </Button>
              </CardContent>
            </Card>

            {/* Card Selection for applying generated art */}
            <Card className="bg-slate-800/80 border-purple-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <ElementIcon className={`w-5 h-5 ${elementConfig[selectedElement].color}`} />
                  {cardType === "unit" ? "Unit Cards" : "Commanders"} - {selectedElement}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
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
                              onClick={() => setSelectedCardId(card.id)}
                              className={`p-3 rounded-lg cursor-pointer transition-all ${
                                selectedCardId === card.id
                                  ? "bg-purple-600/30 border border-purple-500"
                                  : "bg-slate-700/30 hover:bg-slate-700/50 border border-transparent"
                              }`}
                              data-testid={`card-select-${card.id}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-white font-medium text-sm truncate flex-1">{card.name}</span>
                                <Badge variant="outline" className="text-xs shrink-0">
                                  Power {card.power}
                                </Badge>
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
                        <div className="text-center space-y-4">
                          {(() => {
                            const selectedCard = cards.find((c) => c.id === selectedCardId);
                            if (!selectedCard) return <p className="text-slate-400">Card not found</p>;
                            return (
                              <>
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
                                    {updateCardMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Apply Generated Art
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  className="w-full gap-2"
                                  onClick={() => {
                                    setShowSwapDialog(true);
                                  }}
                                  data-testid="button-swap-from-db"
                                >
                                  <ArrowRightLeft className="w-4 h-4" />
                                  Swap from Image DB
                                </Button>
                              </>
                            );
                          })()}
                        </div>
                      ) : cardType === "commander" && selectedCommanderId ? (
                        <div className="text-center space-y-4">
                          {(() => {
                            const selectedCommander = commanders.find((c) => c.id === selectedCommanderId);
                            if (!selectedCommander) return <p className="text-slate-400">Commander not found</p>;
                            return (
                              <>
                                <div className="text-white font-bold">{selectedCommander.name}</div>
                                <p className="text-purple-300 text-sm italic">{selectedCommander.title}</p>
                                {selectedCommander.imageUrl ? (
                                  <img
                                    src={selectedCommander.imageUrl}
                                    alt={selectedCommander.name}
                                    className="w-full max-w-[200px] mx-auto rounded-lg border border-purple-500/50"
                                  />
                                ) : (
                                  <div className="w-full max-w-[200px] mx-auto aspect-square rounded-lg bg-slate-700/50 flex items-center justify-center">
                                    <ImageIcon className="w-12 h-12 text-slate-500" />
                                  </div>
                                )}
                                {generatedImage && (
                                  <Button
                                    onClick={() => updateCommanderMutation.mutate(selectedCommanderId)}
                                    disabled={updateCommanderMutation.isPending}
                                    className="w-full gap-2"
                                    data-testid="button-save-to-commander"
                                  >
                                    {updateCommanderMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Apply Generated Art
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  className="w-full gap-2"
                                  onClick={() => setShowSwapDialog(true)}
                                  data-testid="button-swap-commander-from-db"
                                >
                                  <ArrowRightLeft className="w-4 h-4" />
                                  Swap from Image DB
                                </Button>
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <p className="text-slate-400 text-center py-4">Select a {cardType} to preview</p>
                      )}
                    </TabsContent>
                  </Tabs>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Manage Game Cards Section */}
        <Card className="bg-slate-800/80 border-purple-500/30 mt-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-400" />
                Manage Game Cards
              </div>
              <Badge className="bg-amber-600/50">
                {cards.length} cards in database
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-400 text-sm mb-4">
              Delete cards from the game database. Use with caution - this action cannot be undone.
            </p>
            <ScrollArea className="h-[300px]">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {cards.slice(0, 50).map((card) => {
                  const ElementIcon = elementConfig[card.element]?.icon;
                  return (
                    <div 
                      key={card.id} 
                      className="relative group bg-slate-700/30 rounded-lg p-2 border border-slate-600/30"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {ElementIcon && (
                          <ElementIcon className={`w-4 h-4 ${elementConfig[card.element]?.color}`} />
                        )}
                        <span className="text-white text-xs font-medium truncate flex-1">{card.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          Power {card.power}
                        </Badge>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                              data-testid={`admin-delete-card-${card.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-slate-800 border-red-500/30">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-white">Delete Card</AlertDialogTitle>
                              <AlertDialogDescription className="text-slate-300">
                                Are you sure you want to delete "{card.name}"? This will permanently remove the card from the game. This action cannot be undone.
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
                                Delete Card
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  );
                })}
              </div>
              {cards.length > 50 && (
                <p className="text-slate-400 text-center mt-4 text-sm">
                  Showing first 50 cards. Use the Card Database page to manage all {cards.length} cards.
                </p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Swap from Image Database Dialog */}
      <Dialog open={showSwapDialog} onOpenChange={setShowSwapDialog}>
        <DialogContent className="bg-slate-800 border-purple-500/30 max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Select Image from Database</DialogTitle>
            <DialogDescription className="text-slate-300">
              Choose an image to apply to the selected {cardType === "unit" ? "card" : "commander"}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-3 gap-4 py-4">
            {cardImages.length > 0 ? (
              cardImages.map((img) => (
                <div
                  key={img.id}
                  onClick={() => setSelectedImageForSwap(img.id)}
                  className={`relative rounded-lg overflow-hidden cursor-pointer transition-all ${
                    selectedImageForSwap === img.id 
                      ? "ring-2 ring-purple-500" 
                      : "hover:ring-1 hover:ring-purple-500/50"
                  }`}
                  data-testid={`swap-image-${img.id}`}
                >
                  <img 
                    src={img.imageUrl} 
                    alt={img.name} 
                    className="w-full aspect-square object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2">
                    <p className="text-white text-xs truncate">{img.name}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="col-span-3 text-slate-400 text-center py-8">
                No images in database yet. Generate some art first!
              </p>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSwapDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedImageForSwap) {
                  if (cardType === "unit" && selectedCardId) {
                    swapImageMutation.mutate({ cardId: selectedCardId, imageId: selectedImageForSwap });
                  } else if (cardType === "commander" && selectedCommanderId) {
                    swapImageMutation.mutate({ commanderId: selectedCommanderId, imageId: selectedImageForSwap });
                  }
                }
              }}
              disabled={!selectedImageForSwap || swapImageMutation.isPending}
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
