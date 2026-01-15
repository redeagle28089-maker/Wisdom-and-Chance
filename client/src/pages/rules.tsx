import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Droplet, Mountain, Wind, Leaf, Trophy, Flag, Zap, Heart, Shield, ArrowRight, Plus } from "lucide-react";

const phases = [
  { name: "Draw Phase", description: "Draw 2 cards from your deck", icon: ArrowRight },
  { name: "Deployment", description: "Play up to 2 cards face-down on your battlefield, use deployment phase commander abilities", icon: Shield },
  { name: "Combat Phase", description: "Reveal and flip all deployed cards, use combat phase commander abilities", icon: Flame },
  { name: "Calculation", description: "Compare total power, loser takes damage, use calculation phase commander abilities", icon: Trophy },
  { name: "End Phase", description: "Check win conditions and prepare for next turn", icon: Flag },
];

const elements = [
  { name: "Fire", icon: Flame, color: "from-red-600 to-orange-600", textColor: "text-red-500", buffDebuffColor: "Red", description: "Aggressive, damage-focused cards with high offensive power" },
  { name: "Water", icon: Droplet, color: "from-blue-600 to-cyan-600", textColor: "text-blue-500", buffDebuffColor: "Blue", description: "Control and manipulation, drawing cards and managing resources" },
  { name: "Earth", icon: Mountain, color: "from-yellow-800 to-amber-700", textColor: "text-amber-700", buffDebuffColor: "Brown/Amber", description: "Defense and durability, high resilience and protection" },
  { name: "Air", icon: Wind, color: "from-green-400 to-teal-400", textColor: "text-green-400", buffDebuffColor: "Green", description: "Speed and mobility, light green with white swirls, fast tactical plays" },
  { name: "Nature", icon: Leaf, color: "from-green-700 to-green-900", textColor: "text-green-800", buffDebuffColor: "Dark Green", description: "Growth and life, healing and regeneration, dark green themed" },
];

const traits = [
  { name: "Quick Strike", emoji: "⚡", description: "Deal immediate damage to opponent during deployment", icon: Zap },
  { name: "Care Package", emoji: "➕", description: "Draw additional cards when deployed", icon: Plus },
  { name: "Restoration", emoji: "💚", description: "Heal HP when deployed", icon: Heart },
  { name: "Guardian", emoji: "🛡️", description: "Provides shield that reduces incoming damage during calculation", icon: Shield },
];

export default function RulesPage() {
  return (
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4" data-testid="text-rules-title">Game Rules</h1>
          <p className="text-lg md:text-xl text-purple-200">Master the mechanics of Wisdom & Chance</p>
        </div>

        <Card className="bg-slate-800/50 border-purple-500/20 mb-6 md:mb-8">
          <CardHeader>
            <CardTitle className="text-white text-xl md:text-2xl">Game Setup</CardTitle>
          </CardHeader>
          <CardContent className="text-purple-200 space-y-4">
            <div>
              <h3 className="text-white font-semibold mb-2">Deck Construction</h3>
              <ul className="list-disc list-inside space-y-2">
                <li>40 unit cards total</li>
                <li>Exactly 4 cards of each power rank (1-10)</li>
                <li>Maximum 3 copies of any single card</li>
                <li>1 commander card (not in deck)</li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-2">Starting Conditions</h3>
              <ul className="list-disc list-inside space-y-2">
                <li>Both players start with 40 HP</li>
                <li>Draw 5 cards to start</li>
                <li>Shuffle your 40-card deck</li>
                <li>Commander is placed in the command zone</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-purple-500/20 mb-6 md:mb-8">
          <CardHeader>
            <CardTitle className="text-white text-xl md:text-2xl">Turn Phases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {phases.map((phase, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-4 p-4 bg-slate-900/50 rounded-lg"
                  data-testid={`phase-${phase.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="p-3 bg-purple-600 rounded-lg shrink-0">
                    <phase.icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-base md:text-lg mb-1">{phase.name}</h3>
                    <p className="text-purple-300 text-sm md:text-base">{phase.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-purple-500/20 mb-6 md:mb-8">
          <CardHeader>
            <CardTitle className="text-white text-xl md:text-2xl">Elements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {elements.map((element, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg bg-gradient-to-br ${element.color} bg-opacity-20`}
                  data-testid={`element-info-${element.name.toLowerCase()}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <element.icon className={`w-7 h-7 md:w-8 md:h-8 ${element.textColor}`} />
                    <div>
                      <h3 className="text-white font-bold text-lg md:text-xl">{element.name}</h3>
                      <p className="text-purple-200 text-xs">Buff/Debuff Color: {element.buffDebuffColor}</p>
                    </div>
                  </div>
                  <p className="text-purple-200 text-sm">{element.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-purple-500/20 mb-6 md:mb-8">
          <CardHeader>
            <CardTitle className="text-white text-xl md:text-2xl">Card Mechanics</CardTitle>
          </CardHeader>
          <CardContent className="text-purple-200 space-y-6">
            <div>
              <h3 className="text-white font-semibold text-lg mb-3">Power System</h3>
              <ul className="list-disc list-inside space-y-2">
                <li><strong className="text-white">Base Power (Top Left):</strong> Card's inherent strength (1-10)</li>
                <li><strong className="text-white">Buff Modifier (Bottom Left):</strong> Bonus given to allied cards matching element/faction</li>
                <li><strong className="text-white">Debuff Modifier (Bottom Right):</strong> Penalty applied to enemy cards matching element/faction</li>
              </ul>
            </div>

            <div>
              <h3 className="text-white font-semibold text-lg mb-3">Buff/Debuff Color System</h3>
              <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
                <div>
                  <h4 className="text-white font-semibold mb-2">Element Colors (Targeted)</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li><span className="text-red-400">Red</span> = Fire cards only</li>
                    <li><span className="text-blue-400">Blue</span> = Water cards only</li>
                    <li><span className="text-amber-400">Amber/Brown</span> = Earth cards only</li>
                    <li><span className="text-green-400">Green</span> = Air/Nature cards only</li>
                  </ul>
                </div>
                <div className="border-t border-purple-500/30 pt-3">
                  <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                    <Badge variant="secondary" className="bg-black text-white">BLACK</Badge>
                    = Universal (All Cards)
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li><strong className="text-green-400">Black Buff:</strong> Affects ALL your other deployed units (excludes the card itself)</li>
                    <li><strong className="text-red-400">Black Debuff:</strong> Affects ALL opponent's deployed cards</li>
                    <li><strong className="text-purple-300">Strategy:</strong> Use black modifiers for universal board control</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-white font-semibold text-lg mb-3">Card Traits (Top Right)</h3>
              <div className="space-y-3">
                {traits.map((trait, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg">
                    <trait.icon className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-white font-semibold">{trait.name} {trait.emoji}</h4>
                      <p className="text-purple-300 text-sm">{trait.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-white font-semibold text-lg mb-3">Commander Abilities</h3>
              <ul className="list-disc list-inside space-y-2">
                <li><strong className="text-white">Victory Costs:</strong> Earned by winning combat rounds - used for offensive abilities</li>
                <li><strong className="text-white">Withdrawal Costs:</strong> Earned by losing combat rounds - used for defensive abilities</li>
                <li><strong className="text-white">Tactical Abilities:</strong> Each commander has 4-6 unique abilities with various effects</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-purple-500/20">
          <CardHeader>
            <CardTitle className="text-white text-xl md:text-2xl">Victory Conditions</CardTitle>
          </CardHeader>
          <CardContent className="text-purple-200 space-y-4">
            <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
              <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Win by Combat
              </h3>
              <p>Reduce your opponent's HP to 0 through successful battles</p>
            </div>
            <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
              <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                <Flag className="w-5 h-5 text-green-500" />
                Win by Depletion
              </h3>
              <p>If your opponent cannot draw cards when required, you win</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
