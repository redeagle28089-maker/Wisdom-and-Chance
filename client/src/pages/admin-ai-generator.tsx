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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Wand2, Sparkles, Save, Check, X, ChevronDown, Shield, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CardWithPopup, CommanderWithPopup } from "@/components/game-card";
import type { Card as CardType, Commander, Element, InsertCard, InsertCommander } from "@shared/schema";
import { ELEMENTS, ALLOWED_ABILITY_EFFECTS } from "@shared/schema";

type Kind = "unit" | "commander";

type GenerateResponse = {
  kind: Kind;
  candidates: (InsertCard | InsertCommander)[];
  rejectedCount: number;
  rejectedDetails: { index: number; errors: any }[];
  totalReturnedByAi: number;
};

type SavedState = "idle" | "saving" | "saved" | "discarded" | "error";

function CandidateActions({
  index,
  state,
  onSave,
  onDiscard,
}: {
  index: number;
  state: SavedState;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
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
  );
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
  const [stylePrompt, setStylePrompt] = useState("");
  const [candidateStates, setCandidateStates] = useState<Record<number, SavedState>>({});
  const [results, setResults] = useState<GenerateResponse | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        kind,
        count,
        ...(element !== "any" && { element }),
        ...(stylePrompt.trim() && { stylePrompt: stylePrompt.trim() }),
      };
      if (kind === "unit") {
        body.powerRange = [powerMin, powerMax];
      } else {
        body.costRange = [costMin, costMax];
      }
      const res = await apiRequest("POST", "/api/admin/generate-cards", body);
      return (await res.json()) as GenerateResponse;
    },
    onSuccess: (data) => {
      setResults(data);
      setCandidateStates({});
      toast({
        title: "Generation complete",
        description: `${data.candidates.length} valid candidate(s) of ${data.totalReturnedByAi} returned (${data.rejectedCount} rejected by schema)`,
      });
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
    mutationFn: async (args: { index: number; payload: InsertCard | InsertCommander }) => {
      setCandidateStates((s) => ({ ...s, [args.index]: "saving" }));
      const res = await apiRequest("POST", "/api/admin/generated-cards/save", {
        kind,
        payload: args.payload,
      });
      return { index: args.index, body: await res.json() };
    },
    onSuccess: (data) => {
      setCandidateStates((s) => ({ ...s, [data.index]: "saved" }));
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/commanders"] });
      toast({ title: "Saved", description: `Added to ${kind === "unit" ? "card" : "commander"} database.` });
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

  const previewCard = (payload: InsertCard, index: number): CardType => ({
    ...payload,
    id: `gen-card-${index}`,
  } as CardType);

  const previewCommander = (payload: InsertCommander, index: number): Commander => ({
    ...payload,
    id: `gen-commander-${index}`,
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
              <Select value={element} onValueChange={(v) => setElement(v as Element | "any")}>
                <SelectTrigger id="element" data-testid="select-element"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any element</SelectItem>
                  {ELEMENTS.map((el) => (
                    <SelectItem key={el} value={el}>{el}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          ) : (
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
                        onSave={() => saveMutation.mutate({ index: i, payload })}
                        onDiscard={() => handleDiscard(i)}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {(results.candidates as InsertCommander[]).map((payload, i) => {
                  const state = candidateStates[i] || "idle";
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
                        onSave={() => saveMutation.mutate({ index: i, payload })}
                        onDiscard={() => handleDiscard(i)}
                      />
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
