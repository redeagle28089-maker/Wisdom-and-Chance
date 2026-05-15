import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Wand2, Sparkles, Save, Check, X, ChevronDown, Shield, LogIn, Image as ImageIcon, Upload, Palette } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CardWithPopup, CommanderWithPopup } from "@/components/game-card";
import type { Card as CardType, Commander, Element, InsertCard, InsertCommander, FieldCard, InsertFieldCard } from "@shared/schema";
import { ELEMENTS, ALLOWED_ABILITY_EFFECTS } from "@shared/schema";
import { BattlefieldFieldCard } from "@/components/battlefield-field-card";

type Kind = "unit" | "commander" | "battlefield";

type GenerateResponse = {
  kind: Kind;
  candidates: (InsertCard | InsertCommander | InsertFieldCard)[];
  rejectedCount: number;
  rejectedDetails: { index: number; errors: any }[];
  totalReturnedByAi: number;
};

type SavedState = "idle" | "saving" | "saved" | "discarded" | "error";
type ArtState = "idle" | "generating" | "done" | "error";

function CandidateActions({
  index,
  state,
  artState,
  hasArt,
  onSave,
  onDiscard,
  onGenerateArt,
}: {
  index: number;
  state: SavedState;
  artState: ArtState;
  hasArt: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onGenerateArt: () => void;
}) {
  const generatingArt = artState === "generating";
  return (
    <div className="space-y-2">
      <Button
        size="sm"
        variant="secondary"
        className="w-full"
        onClick={onGenerateArt}
        disabled={generatingArt || state === "saved" || state === "discarded"}
        data-testid={`button-generate-art-${index}`}
      >
        {generatingArt ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Palette className="w-3 h-3 mr-1" />}
        {generatingArt ? "Generating art…" : hasArt ? "Regenerate art" : "Generate art"}
      </Button>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={onSave}
          disabled={state === "saving" || state === "saved" || state === "discarded"}
          data-testid={`button-save-${index}`}
        >
          {state === "saving" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
          {state === "saved" && <Check className="w-3 h-3 mr-1" />}
          {state !== "saving" && state !== "saved" && <Save className="w-3 h-3 mr-1" />}
          {state === "saved" ? "Saved" : state === "saving" ? "Saving…" : "Save"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onDiscard}
          disabled={state === "saved" || state === "discarded"}
          data-testid={`button-discard-${index}`}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function AdminAiGeneratorPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: adminCheck, isLoading: adminLoading } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    enabled: isAuthenticated,
  });

  const [kind, setKind] = useState<Kind>("unit");
  const [count, setCount] = useState<number>(3);
  const [element, setElement] = useState<Element | "any">("any");
  const [powerMin, setPowerMin] = useState<number>(1);
  const [powerMax, setPowerMax] = useState<number>(10);
  const [costMin, setCostMin] = useState<number>(0);
  const [costMax, setCostMax] = useState<number>(2);
  const [deployLimitMin, setDeployLimitMin] = useState<number>(1);
  const [deployLimitMax, setDeployLimitMax] = useState<number>(4);
  const [stylePrompt, setStylePrompt] = useState("");
  const [artReferenceText, setArtReferenceText] = useState("");
  const [artReferenceImage, setArtReferenceImage] = useState<string | null>(null);
  const [artReferenceImageName, setArtReferenceImageName] = useState<string | null>(null);
  const [autoGenerateArt, setAutoGenerateArt] = useState(false);
  const [candidateStates, setCandidateStates] = useState<Record<number, SavedState>>({});
  const [artStates, setArtStates] = useState<Record<number, ArtState>>({});
  const [generatedArt, setGeneratedArt] = useState<Record<number, string>>({});
  const [results, setResults] = useState<GenerateResponse | null>(null);

  const handleReferenceImageChange = async (file: File | null) => {
    if (!file) {
      setArtReferenceImage(null);
      setArtReferenceImageName(null);
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Reference image must be under 6 MB.", variant: "destructive" });
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setArtReferenceImage(dataUrl);
      setArtReferenceImageName(file.name);
    } catch {
      toast({ title: "Could not read image", variant: "destructive" });
    }
  };

  const runArtGeneration = async (
    index: number,
    payload: InsertCard | InsertCommander,
    candidateKind: Kind,
  ): Promise<{ ok: true; index: number; imageUrl: string } | { ok: false; index: number; error: any }> => {
    setArtStates((s) => ({ ...s, [index]: "generating" }));
    try {
      const body: any = {
        kind: candidateKind,
        name: (payload as any).name,
        element: (payload as any).element,
        description: (payload as any).description,
      };
      if (candidateKind === "commander") body.title = (payload as InsertCommander).title;
      if (artReferenceText.trim()) body.artReferenceText = artReferenceText.trim();
      if (artReferenceImage) body.artReferenceImageBase64 = artReferenceImage;
      const res = await apiRequest("POST", "/api/admin/generated-cards/generate-art", body);
      const data = (await res.json()) as { imageUrl: string };
      setArtStates((s) => ({ ...s, [index]: "done" }));
      setGeneratedArt((g) => ({ ...g, [index]: data.imageUrl }));
      return { ok: true, index, imageUrl: data.imageUrl };
    } catch (err: any) {
      setArtStates((s) => ({ ...s, [index]: "error" }));
      return { ok: false, index, error: err };
    }
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        kind,
        count,
        ...(element !== "any" && kind !== "battlefield" && { element }),
        ...(stylePrompt.trim() && { stylePrompt: stylePrompt.trim() }),
      };
      if (kind === "unit") {
        body.powerRange = [powerMin, powerMax];
      } else if (kind === "commander") {
        body.costRange = [costMin, costMax];
      } else {
        body.deployLimitRange = [deployLimitMin, deployLimitMax];
      }
      const res = await apiRequest("POST", "/api/admin/generate-cards", body);
      return (await res.json()) as GenerateResponse;
    },
    onSuccess: async (data) => {
      setResults(data);
      setCandidateStates({});
      setArtStates({});
      setGeneratedArt({});
      toast({
        title: "Generation complete",
        description: `${data.candidates.length} valid candidate(s) of ${data.totalReturnedByAi} returned (${data.rejectedCount} rejected by schema)`,
      });

      if (autoGenerateArt && data.candidates.length > 0) {
        toast({
          title: "Generating art for all candidates…",
          description: `Fanning out ${data.candidates.length} parallel image jobs.`,
        });
        const outcomes = await Promise.all(
          data.candidates.map((payload, i) => runArtGeneration(i, payload, data.kind)),
        );
        const okCount = outcomes.filter((o) => o.ok).length;
        const failCount = outcomes.length - okCount;
        toast({
          title: "Auto-art finished",
          description: failCount === 0
            ? `Generated art for ${okCount} candidate(s).`
            : `Generated ${okCount} / ${outcomes.length}. ${failCount} failed — retry individually.`,
          variant: failCount > 0 ? "destructive" : undefined,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Generation failed",
        description: error?.message || "Failed to generate candidates",
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (args: { index: number; payload: InsertCard | InsertCommander | InsertFieldCard }) => {
      setCandidateStates((s) => ({ ...s, [args.index]: "saving" }));
      const art = generatedArt[args.index];
      const payloadWithArt = art ? { ...args.payload, imageUrl: art } : args.payload;
      const res = await apiRequest("POST", "/api/admin/generated-cards/save", {
        kind,
        payload: payloadWithArt,
      });
      return { index: args.index, body: await res.json() };
    },
    onSuccess: (data) => {
      setCandidateStates((s) => ({ ...s, [data.index]: "saved" }));
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/commanders"] });
      if (kind === "battlefield") queryClient.invalidateQueries({ queryKey: ["/api/cards/battlefield"] });
      const label = kind === "unit" ? "card" : kind === "commander" ? "commander" : "battlefield card";
      toast({ title: "Saved", description: `Added to ${label} database.` });
    },
    onError: (error: any, vars) => {
      setCandidateStates((s) => ({ ...s, [vars.index]: "error" }));
      toast({
        title: "Save failed",
        description: error?.message || "Could not save candidate",
        variant: "destructive",
      });
    },
  });

  const handleDiscard = (index: number) => {
    setCandidateStates((s) => ({ ...s, [index]: "discarded" }));
  };

  const artMutation = useMutation({
    mutationFn: async (args: { index: number; payload: InsertCard | InsertCommander }) => {
      const outcome = await runArtGeneration(args.index, args.payload, kind);
      if (!outcome.ok) {
        throw outcome.error instanceof Error ? outcome.error : new Error("Could not generate art");
      }
      return outcome;
    },
    onSuccess: () => {
      toast({ title: "Art generated", description: "Click Save to attach it to this candidate." });
    },
    onError: (error: any) => {
      toast({
        title: "Art generation failed",
        description: error?.message || "Could not generate art",
        variant: "destructive",
      });
    },
  });

  const previewCard = (payload: InsertCard, index: number): CardType => ({
    ...payload,
    id: `gen-card-${index}`,
    imageUrl: generatedArt[index] || payload.imageUrl,
  } as CardType);

  const previewCommander = (payload: InsertCommander, index: number): Commander => ({
    ...payload,
    id: `gen-commander-${index}`,
    imageUrl: generatedArt[index] || payload.imageUrl,
  } as Commander);

  const sortedEffects = useMemo(() => [...ALLOWED_ABILITY_EFFECTS].sort((a, b) => a.type.localeCompare(b.type)), []);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full bg-slate-900/80 border-purple-500/30">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 mx-auto text-purple-400 mb-2" />
            <CardTitle>Admin access required</CardTitle>
            <CardDescription>You must be signed in as an admin to use the AI generator.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <a href="/api/login">
              <Button data-testid="button-admin-login">
                <LogIn className="w-4 h-4 mr-2" /> Sign in
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!adminCheck?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full bg-slate-900/80 border-red-500/30">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 mx-auto text-red-400 mb-2" />
            <CardTitle>Forbidden</CardTitle>
            <CardDescription>This page is admin-only.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Link href="/">
              <Button variant="outline" data-testid="button-go-home">Back to home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <Sparkles className="w-7 h-7 text-purple-400" />
        <div>
          <h1 className="text-3xl font-bold text-white" data-testid="heading-ai-generator">AI Card &amp; Commander Generator</h1>
          <p className="text-slate-400 text-sm">Batch-generate playable units &amp; commanders. Every effect is constrained to what the engine actually implements.</p>
        </div>
      </div>

      <Card className="bg-slate-900/80 border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-white">Generate batch</CardTitle>
          <CardDescription>Pick a kind, count, and optional bias parameters.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="kind">Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
                <SelectTrigger id="kind" data-testid="select-kind"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unit">Unit</SelectItem>
                  <SelectItem value="commander">Commander</SelectItem>
                  <SelectItem value="battlefield">Battlefield</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="count">Count (1–10)</Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={10}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(10, parseInt(e.target.value || "1", 10))))}
                data-testid="input-count"
              />
            </div>

            <div>
              <Label htmlFor="element">Element filter</Label>
              <Select value={element} onValueChange={(v) => setElement(v as Element | "any")} disabled={kind === "battlefield"}>
                <SelectTrigger id="element" data-testid="select-element"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any element</SelectItem>
                  {ELEMENTS.map((el) => (
                    <SelectItem key={el} value={el}>{el}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {kind === "battlefield" && <p className="text-xs text-slate-500 mt-1">Not applicable to battlefield cards.</p>}
            </div>
          </div>

          {kind === "unit" ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="power-min">Power min</Label>
                <Input id="power-min" type="number" min={1} max={10} value={powerMin}
                  onChange={(e) => setPowerMin(Math.max(1, Math.min(10, parseInt(e.target.value || "1", 10))))}
                  data-testid="input-power-min" />
              </div>
              <div>
                <Label htmlFor="power-max">Power max</Label>
                <Input id="power-max" type="number" min={1} max={10} value={powerMax}
                  onChange={(e) => setPowerMax(Math.max(1, Math.min(10, parseInt(e.target.value || "10", 10))))}
                  data-testid="input-power-max" />
              </div>
            </div>
          ) : kind === "commander" ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cost-min">Ability cost min</Label>
                <Input id="cost-min" type="number" min={0} max={4} value={costMin}
                  onChange={(e) => setCostMin(Math.max(0, Math.min(4, parseInt(e.target.value || "0", 10))))}
                  data-testid="input-cost-min" />
              </div>
              <div>
                <Label htmlFor="cost-max">Ability cost max</Label>
                <Input id="cost-max" type="number" min={0} max={4} value={costMax}
                  onChange={(e) => setCostMax(Math.max(0, Math.min(4, parseInt(e.target.value || "2", 10))))}
                  data-testid="input-cost-max" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="deploy-limit-min">Deploy limit min (1–4)</Label>
                <Input id="deploy-limit-min" type="number" min={1} max={4} value={deployLimitMin}
                  onChange={(e) => setDeployLimitMin(Math.max(1, Math.min(4, parseInt(e.target.value || "1", 10))))}
                  data-testid="input-deploy-limit-min" />
              </div>
              <div>
                <Label htmlFor="deploy-limit-max">Deploy limit max (1–4)</Label>
                <Input id="deploy-limit-max" type="number" min={1} max={4} value={deployLimitMax}
                  onChange={(e) => setDeployLimitMax(Math.max(1, Math.min(4, parseInt(e.target.value || "4", 10))))}
                  data-testid="input-deploy-limit-max" />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="style">Style prompt (optional)</Label>
            <Textarea
              id="style"
              placeholder='e.g. "tribal volcanic spirits, aggressive"'
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              maxLength={500}
              data-testid="input-style-prompt"
            />
          </div>

          <div className="rounded-lg border border-purple-500/30 bg-slate-950/40 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-purple-400" />
              <h3 className="text-white font-semibold text-sm">Art reference (optional)</h3>
            </div>
            <p className="text-slate-400 text-xs">
              Used by the per-candidate <span className="font-semibold text-slate-300">Generate art</span> button below.
              Combine a written description and/or a reference image — both are sent to the image model.
            </p>
            <div>
              <Label htmlFor="art-ref-text" className="text-xs">Written art reference</Label>
              <Textarea
                id="art-ref-text"
                placeholder='e.g. "moody chiaroscuro, oil-paint texture, low-angle hero shot"'
                value={artReferenceText}
                onChange={(e) => setArtReferenceText(e.target.value)}
                maxLength={800}
                data-testid="input-art-reference-text"
              />
            </div>
            <div>
              <Label htmlFor="art-ref-image" className="text-xs">Reference image upload</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="art-ref-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleReferenceImageChange(e.target.files?.[0] ?? null)}
                  className="flex-1"
                  data-testid="input-art-reference-image"
                />
                {artReferenceImage && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReferenceImageChange(null)}
                    data-testid="button-clear-art-reference-image"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
              {artReferenceImage && (
                <div className="mt-2 flex items-center gap-3">
                  <img
                    src={artReferenceImage}
                    alt="reference"
                    className="w-16 h-16 object-cover rounded border border-slate-700"
                    data-testid="img-art-reference-preview"
                  />
                  <span className="text-slate-400 text-xs truncate">{artReferenceImageName}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-purple-500/30 bg-slate-950/40 p-3">
            <Switch
              id="auto-generate-art"
              checked={autoGenerateArt}
              onCheckedChange={setAutoGenerateArt}
              data-testid="switch-auto-generate-art"
            />
            <div className="space-y-0.5">
              <Label htmlFor="auto-generate-art" className="text-white text-sm cursor-pointer">
                Generate art now
              </Label>
              <p className="text-slate-400 text-xs">
                After candidates are generated, fan out one parallel image job per candidate using the art-reference fields above. You can still regenerate art per-candidate afterwards.
              </p>
            </div>
          </div>

          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="w-full md:w-auto"
            data-testid="button-generate"
          >
            {generateMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</>
            ) : (
              <><Wand2 className="w-4 h-4 mr-2" /> Generate {count} {kind}{count > 1 ? "s" : ""}</>
            )}
          </Button>
        </CardContent>
      </Card>

      <Collapsible>
        <Card className="bg-slate-900/80 border-amber-500/30">
          <CollapsibleTrigger className="w-full" data-testid="toggle-effects-cheatsheet">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="text-left">
                <CardTitle className="text-white text-base">Implemented effect cheat-sheet</CardTitle>
                <CardDescription>{ALLOWED_ABILITY_EFFECTS.length} effect types — every generated commander ability is constrained to this list.</CardDescription>
              </div>
              <ChevronDown className="w-5 h-5 text-amber-400 shrink-0" />
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sortedEffects.map((e) => (
                  <div key={e.type} className="p-3 rounded-md bg-slate-800/60 border border-slate-700" data-testid={`effect-row-${e.type}`}>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <code className="text-amber-300 text-sm font-mono">{e.type}</code>
                      {e.acceptsValue && <Badge variant="secondary" className="text-[10px]">value</Badge>}
                      {e.targetMode === "element" && <Badge variant="secondary" className="text-[10px]">target: element</Badge>}
                    </div>
                    <p className="text-slate-300 text-xs leading-snug">{e.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {results && (
        <Card className="bg-slate-900/80 border-emerald-500/30">
          <CardHeader>
            <CardTitle className="text-white" data-testid="heading-results">
              Candidates ({results.candidates.length} valid / {results.totalReturnedByAi} returned)
            </CardTitle>
            {results.rejectedCount > 0 && (
              <CardDescription className="text-amber-400">
                {results.rejectedCount} candidate(s) were rejected because they failed schema validation.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {results.candidates.length === 0 ? (
              <p className="text-slate-400 text-sm">No valid candidates this batch — try generating again.</p>
            ) : results.kind === "unit" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {(results.candidates as InsertCard[]).map((payload, i) => {
                  const state = candidateStates[i] || "idle";
                  const artState = artStates[i] || "idle";
                  const hasArt = !!generatedArt[i];
                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${state === "saved" ? "border-emerald-500/60 bg-emerald-900/20" : state === "discarded" ? "border-slate-700 bg-slate-900/30 opacity-50" : "border-slate-700 bg-slate-800/40"}`}
                      data-testid={`candidate-${i}`}
                    >
                      <div className="flex justify-center mb-3">
                        <CardWithPopup card={previewCard(payload, i)} size="xl" />
                      </div>
                      <div className="text-center mb-3">
                        <div className="text-white font-semibold text-sm truncate" data-testid={`candidate-name-${i}`}>
                          {payload.name}
                        </div>
                        <div className="text-slate-400 text-xs">
                          {payload.element} • Power {payload.power}
                        </div>
                      </div>
                      <CandidateActions
                        index={i}
                        state={state}
                        artState={artState}
                        hasArt={hasArt}
                        onSave={() => saveMutation.mutate({ index: i, payload })}
                        onDiscard={() => handleDiscard(i)}
                        onGenerateArt={() => artMutation.mutate({ index: i, payload })}
                      />
                    </div>
                  );
                })}
              </div>
            ) : results.kind === "commander" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {(results.candidates as InsertCommander[]).map((payload, i) => {
                  const state = candidateStates[i] || "idle";
                  const artState = artStates[i] || "idle";
                  const hasArt = !!generatedArt[i];
                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${state === "saved" ? "border-emerald-500/60 bg-emerald-900/20" : state === "discarded" ? "border-slate-700 bg-slate-900/30 opacity-50" : "border-slate-700 bg-slate-800/40"}`}
                      data-testid={`candidate-${i}`}
                    >
                      <div className="flex justify-center mb-3">
                        <CommanderWithPopup commander={previewCommander(payload, i)} size="xl" />
                      </div>
                      <div className="text-center mb-3">
                        <div className="text-white font-semibold text-sm truncate" data-testid={`candidate-name-${i}`}>
                          {payload.name}
                        </div>
                        <div className="text-slate-400 text-xs">
                          {payload.element} • {payload.abilities.length} abilities
                        </div>
                      </div>
                      <CandidateActions
                        index={i}
                        state={state}
                        artState={artState}
                        hasArt={hasArt}
                        onSave={() => saveMutation.mutate({ index: i, payload })}
                        onDiscard={() => handleDiscard(i)}
                        onGenerateArt={() => artMutation.mutate({ index: i, payload })}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(results.candidates as InsertFieldCard[]).map((payload, i) => {
                  const state = candidateStates[i] || "idle";
                  const previewBf: FieldCard = { ...payload, id: `gen-bf-${i}` };
                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${state === "saved" ? "border-emerald-500/60 bg-emerald-900/20" : state === "discarded" ? "border-slate-700 bg-slate-900/30 opacity-50" : "border-slate-700 bg-slate-800/40"}`}
                      data-testid={`candidate-${i}`}
                    >
                      <div className="flex justify-center mb-3">
                        <BattlefieldFieldCard card={previewBf} size="md" />
                      </div>
                      <div className="text-center mb-3">
                        <div className="text-white font-semibold text-sm truncate" data-testid={`candidate-name-${i}`}>
                          {payload.name}
                        </div>
                        <div className="text-slate-400 text-xs">{payload.effects.length} effect(s)</div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => saveMutation.mutate({ index: i, payload })}
                          disabled={state === "saving" || state === "saved" || state === "discarded"}
                          data-testid={`button-save-${i}`}
                        >
                          {state === "saving" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                          {state === "saved" && <Check className="w-3 h-3 mr-1" />}
                          {state !== "saving" && state !== "saved" && <Save className="w-3 h-3 mr-1" />}
                          {state === "saved" ? "Saved" : state === "saving" ? "Saving…" : "Save"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDiscard(i)}
                          disabled={state === "saved" || state === "discarded"}
                          data-testid={`button-discard-${i}`}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
