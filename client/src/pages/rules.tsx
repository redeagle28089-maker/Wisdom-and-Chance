import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Droplet, Mountain, Wind, Leaf, Trophy, Flag, Zap, Heart, Shield, ArrowRight, Plus, Swords, Crown, Users, Layers, Map, Skull, Sword } from "lucide-react";

const phases = [
  { name: "Draw Phase", description: "Draw 2 cards from your deck. In Battlefield Mode, one field card also flips from each player's battlefield deck at the start of this phase.", icon: ArrowRight },
  { name: "Deployment", description: "Play up to 2 cards face-down on your battlefield (may be overridden by field cards). Use deployment phase commander abilities. Vanguard auto-deploys the top deck card if eligible.", icon: Shield },
  { name: "Combat Phase", description: "Reveal and flip all deployed cards, use combat phase commander abilities", icon: Flame },
  { name: "Calculation", description: "Resolve combat via 8-step flow: deploy & reveal, calculate power, Quick Strike, Guardian blocking, healing, determine winner, apply net damage, Care Package. Active field cards apply their effects throughout.", icon: Trophy },
  { name: "End Phase", description: "Check win conditions, clear active field card effects, and prepare for next turn.", icon: Flag },
];

const elements = [
  { name: "Fire", icon: Flame, color: "from-red-600 to-orange-600", textColor: "text-red-500", buffDebuffColor: "Red", description: "Aggressive, damage-focused cards with high offensive power" },
  { name: "Water", icon: Droplet, color: "from-blue-600 to-cyan-600", textColor: "text-blue-500", buffDebuffColor: "Blue", description: "Control and manipulation, drawing cards and managing resources" },
  { name: "Earth", icon: Mountain, color: "from-yellow-800 to-amber-700", textColor: "text-amber-700", buffDebuffColor: "Brown/Amber", description: "Defense and durability, high resilience and protection" },
  { name: "Air", icon: Wind, color: "from-green-400 to-teal-400", textColor: "text-green-400", buffDebuffColor: "Green", description: "Speed and mobility, light green with white swirls, fast tactical plays" },
  { name: "Nature", icon: Leaf, color: "from-green-700 to-green-900", textColor: "text-green-800", buffDebuffColor: "Dark Green", description: "Growth and life, healing and regeneration, dark green themed" },
];

const originalTraits = [
  { name: "Quick Strike", emoji: "⚡", description: "Deals direct HP damage to the opponent, bypassing power comparison. Resolves even on draws. Guardian can block it.", icon: Zap },
  { name: "Care Package", emoji: "➕", description: "Draw additional cards from your deck after combat resolves.", icon: Plus },
  { name: "Restoration", emoji: "💚", description: "Heals your HP before damage is applied (capped at max 40 HP).", icon: Heart },
  { name: "Guardian", emoji: "🛡️", description: "Blocks incoming damage from both combat power loss AND Quick Strike (capped at actual incoming damage).", icon: Shield },
];

const newTraits = [
  {
    name: "Last Stand",
    emoji: "💀",
    description: "Even when this card's side loses combat, the card deals direct HP damage to the enemy pilot equal to its traitValue. It fights to the very end.",
    detail: "Triggers in the Last Stand phase, after damage resolution. The damage is applied regardless of the round outcome.",
    color: "text-red-400",
    bg: "bg-red-900/20",
    border: "border-red-500/30",
  },
  {
    name: "Infiltrator",
    emoji: "🗡️",
    description: "After winning a combat round, this unit stays on the battlefield for one extra round instead of going to the yard. It persists face-up with its current power.",
    detail: "The persisted unit fights again next round. After that second round it goes to the yard normally.",
    color: "text-purple-400",
    bg: "bg-purple-900/20",
    border: "border-purple-500/30",
  },
  {
    name: "Hold the Line",
    emoji: "🏰",
    description: "The first time this unit would be destroyed or removed from the battlefield, it instead survives with modifiedPower = 1. It gets one last stand before leaving.",
    detail: "After surviving with power 1, it fights one more round normally, then goes to the yard.",
    color: "text-amber-400",
    bg: "bg-amber-900/20",
    border: "border-amber-500/30",
  },
  {
    name: "Reserve",
    emoji: "🔄",
    description: "This card can be deployed from your yard as well as your hand (reserveDeployed). After combat, a Reserve unit that was deployed from the yard goes to the Banish Zone instead of the yard.",
    detail: "Cards in the Banish Zone are permanently removed from the game for that match.",
    color: "text-blue-400",
    bg: "bg-blue-900/20",
    border: "border-blue-500/30",
  },
  {
    name: "Flanking",
    emoji: "↔️",
    description: "When this card is deployed, you may deploy one additional card from your hand this turn, exceeding the normal 2-card limit.",
    detail: "The extra slot is granted once per Flanking card deployed. Only one extra slot is granted even if multiple Flanking cards are played.",
    color: "text-green-400",
    bg: "bg-green-900/20",
    border: "border-green-500/30",
  },
  {
    name: "Rally",
    emoji: "📣",
    description: "Any buff bonus that a friendly card receives from another card's buffModifier is increased by this card's traitValue.",
    detail: "Rally amplifies existing buff connections — it does not create new ones. Buff cards must still share an element with the target to apply.",
    color: "text-yellow-400",
    bg: "bg-yellow-900/20",
    border: "border-yellow-500/30",
  },
  {
    name: "Vanguard",
    emoji: "🚀",
    description: "When this card is deployed, look at the top card of your deck. If its power is less than or equal to this card's power, it is automatically deployed face-up alongside it.",
    detail: "The auto-deployed card counts toward your deployment total. If the top-deck card's power is too high, nothing happens.",
    color: "text-cyan-400",
    bg: "bg-cyan-900/20",
    border: "border-cyan-500/30",
  },
  {
    name: "Steadfast",
    emoji: "⚓",
    description: "Reduces all incoming debuff penalties received by your units by this card's traitValue (minimum 0). Acts as a side-wide debuff resistance.",
    detail: "Steadfast reduces debuff amounts before they are applied to final power. It does not affect Quick Strike or combat damage.",
    color: "text-stone-400",
    bg: "bg-stone-900/20",
    border: "border-stone-500/30",
  },
  {
    name: "Saboteur",
    emoji: "🕵️",
    description: "Reduces all buff bonuses that enemy cards receive by this card's traitValue (minimum 0). Disrupts the opponent's buff synergies.",
    detail: "Saboteur reduces the opponent's buffBonus amounts before they contribute to final power. Pairs well with debuff cards.",
    color: "text-orange-400",
    bg: "bg-orange-900/20",
    border: "border-orange-500/30",
  },
  {
    name: "Tactician",
    emoji: "🎯",
    description: "Increases all debuff penalties applied to enemy units by this card's traitValue. Makes your debuff cards hit harder.",
    detail: "Tactician amplifies existing debuff connections — debuff cards must still share an element with the target to apply the base penalty.",
    color: "text-rose-400",
    bg: "bg-rose-900/20",
    border: "border-rose-500/30",
  },
];

const fieldCards = [
  { name: "Volcanic Surge", effects: "+2 power to all Fire units on both sides", icon: "🌋" },
  { name: "Tidal Crash", effects: "+2 power to Water units; −1 power to Fire units", icon: "🌊" },
  { name: "Sacred Ground", effects: "All healing effects this round are doubled", icon: "✨" },
  { name: "Narrow Pass", effects: "Both players may only deploy 1 card this turn (instead of 2)", icon: "⛰️" },
  { name: "Grand Cannon", effects: "Both players may deploy up to 4 cards this turn (instead of 2)", icon: "💥" },
  { name: "Open Field", effects: "Guardian trait and all Guardian/Shield abilities are disabled this round", icon: "🏟️" },
  { name: "Elemental Storm", effects: "−1 power to every deployed unit on both sides", icon: "⚡" },
];

export default function RulesPage() {
  return (
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4" data-testid="text-rules-title">Game Rules</h1>
          <p className="text-lg md:text-xl text-purple-200">Master the mechanics of Wisdom & Chance</p>
        </div>

        {/* Game Setup */}
        <Card className="bg-slate-800/50 border-purple-500/20 mb-6 md:mb-8">
          <CardHeader>
            <CardTitle className="text-white text-xl md:text-2xl">Game Setup</CardTitle>
          </CardHeader>
          <CardContent className="text-purple-200 space-y-4">
            <div>
              <h3 className="text-white font-semibold mb-2">Deck Construction</h3>
              <ul className="list-disc list-inside space-y-2">
                <li>40 unit cards total</li>
                <li>Exactly 4 cards of each power rank (1–10)</li>
                <li>Maximum 3 copies of any single card</li>
                <li>1 commander card (not in deck, placed in the command zone)</li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-2">Starting Conditions</h3>
              <ul className="list-disc list-inside space-y-2">
                <li>Both players start with 40 HP</li>
                <li>Draw 5 cards to start</li>
                <li>Shuffle your 40-card deck</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Turn Phases */}
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

        {/* Elements */}
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

        {/* Card Mechanics */}
        <Card className="bg-slate-800/50 border-purple-500/20 mb-6 md:mb-8">
          <CardHeader>
            <CardTitle className="text-white text-xl md:text-2xl">Card Mechanics</CardTitle>
          </CardHeader>
          <CardContent className="text-purple-200 space-y-6">
            <div>
              <h3 className="text-white font-semibold text-lg mb-3">Power System</h3>
              <ul className="list-disc list-inside space-y-2">
                <li><strong className="text-white">Base Power (Top Left):</strong> Card's inherent strength (1–10)</li>
                <li><strong className="text-white">Buff Modifier (Bottom Left):</strong> Bonus given to allied cards matching element</li>
                <li><strong className="text-white">Debuff Modifier (Bottom Right):</strong> Penalty applied to enemy cards matching element</li>
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

            {/* Original Traits */}
            <div>
              <h3 className="text-white font-semibold text-lg mb-3">Original Card Traits (Top Right)</h3>
              <div className="space-y-3">
                {originalTraits.map((trait, idx) => (
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
                <li><strong className="text-white">Victory Points (VP):</strong> Earned by winning combat rounds — used for offensive abilities</li>
                <li><strong className="text-white">Withdrawal Points (WP):</strong> Earned by losing combat rounds — used for defensive abilities</li>
                <li><strong className="text-white">Tactical Abilities:</strong> Each commander has 4–6 unique abilities with various effects</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* NEW TRAITS */}
        <Card className="bg-slate-800/50 border-yellow-500/30 mb-6 md:mb-8" data-testid="section-new-traits">
          <CardHeader>
            <CardTitle className="text-white text-xl md:text-2xl flex items-center gap-3 flex-wrap">
              <Sword className="w-6 h-6 text-yellow-400" />
              New Unit Traits
              <Badge className="bg-yellow-600 text-white text-xs">10 Traits</Badge>
            </CardTitle>
            <p className="text-purple-300 text-sm mt-1">
              Advanced traits that appear on special unit cards. Each has a <strong className="text-yellow-300">traitValue</strong> shown on the card that determines the magnitude of its effect.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {newTraits.map((trait, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg ${trait.bg} border ${trait.border}`}
                  data-testid={`new-trait-${trait.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0 mt-0.5">{trait.emoji}</span>
                    <div>
                      <h4 className={`font-bold text-base mb-1 ${trait.color}`}>{trait.name}</h4>
                      <p className="text-purple-200 text-sm mb-1">{trait.description}</p>
                      <p className="text-purple-400 text-xs italic">{trait.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* BANISH ZONE */}
        <Card className="bg-slate-800/50 border-red-500/30 mb-6 md:mb-8" data-testid="section-banish-zone">
          <CardHeader>
            <CardTitle className="text-white text-xl md:text-2xl flex items-center gap-3">
              <Skull className="w-6 h-6 text-red-400" />
              Banish Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="text-purple-200 space-y-3">
            <p>
              The <strong className="text-red-300">Banish Zone</strong> is a permanent removal area separate from the yard (discard pile). Cards sent to the Banish Zone <strong className="text-white">cannot be retrieved, recycled, or re-drawn</strong> for the rest of the match.
            </p>
            <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
              <h4 className="text-white font-semibold mb-2">How Cards Enter the Banish Zone</h4>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li><strong className="text-blue-300">Reserve (trait):</strong> A Reserve unit that was deployed from the yard goes to Banish after combat instead of returning to the yard.</li>
                <li><strong className="text-purple-300">Future effects:</strong> Certain commander abilities and field card effects may also send cards to the Banish Zone.</li>
              </ul>
            </div>
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-300 text-sm font-semibold">⚠️ Once banished, always banished.</p>
              <p className="text-purple-300 text-sm">Unlike the yard, banished cards do not recycle when your deck runs out. Banishing key cards can permanently weaken a player's long-term options.</p>
            </div>
          </CardContent>
        </Card>

        {/* BATTLEFIELD MODE */}
        <Card className="bg-slate-800/50 border-green-500/30 mb-6 md:mb-8" data-testid="section-battlefield-mode">
          <CardHeader>
            <CardTitle className="text-white text-xl md:text-2xl flex items-center gap-3 flex-wrap">
              <Map className="w-6 h-6 text-green-400" />
              Battlefield Mode
              <Badge className="bg-green-700 text-white text-xs">Multiplayer Modifier</Badge>
            </CardTitle>
            <p className="text-purple-300 text-sm mt-1">
              An optional game mode toggled when creating a multiplayer room. Both players must have a 7-card Battlefield Deck built in the Deck Builder to play.
            </p>
          </CardHeader>
          <CardContent className="text-purple-200 space-y-6">

            <div className="bg-slate-900/50 rounded-lg p-4">
              <h3 className="text-white font-semibold text-base mb-3">How It Works</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Each player builds a <strong className="text-green-300">7-card Battlefield Deck</strong> from the available field cards in the Deck Builder.</li>
                <li>At the <strong className="text-white">start of every Draw Phase</strong>, one field card is flipped from each player's battlefield deck.</li>
                <li>Both active field cards apply their effects <strong className="text-white">globally to both players</strong> for the entire round.</li>
                <li>At the <strong className="text-white">End Phase</strong>, active field card effects are cleared.</li>
                <li>Flipped cards go to a battlefield discard pile. When all 7 are used, the deck reshuffles automatically.</li>
              </ol>
            </div>

            <div>
              <h3 className="text-white font-semibold text-base mb-3 flex items-center gap-2">
                <Map className="w-4 h-4 text-green-400" />
                Field Card Effect Types
              </h3>
              <div className="grid gap-3">
                {[
                  { key: "element_buff", label: "Element Buff", color: "text-green-300", bg: "bg-green-900/20", border: "border-green-500/30", desc: "Increases the power of all units of a specific element on BOTH sides by the listed amount.", example: "Volcanic Surge (+2 Fire)" },
                  { key: "element_debuff", label: "Element Debuff", color: "text-red-300", bg: "bg-red-900/20", border: "border-red-500/30", desc: "Decreases the power of all units of a specific element on BOTH sides.", example: "Tidal Crash (−1 Fire)" },
                  { key: "all_units_debuff", label: "All-Units Debuff", color: "text-orange-300", bg: "bg-orange-900/20", border: "border-orange-500/30", desc: "Decreases the power of EVERY deployed unit on both sides, regardless of element.", example: "Elemental Storm (−1 all)" },
                  { key: "deploy_limit_override", label: "Deploy Limit Override", color: "text-yellow-300", bg: "bg-yellow-900/20", border: "border-yellow-500/30", desc: "Both players must deploy exactly the specified number of cards this turn instead of the normal 2. Overrides all other deploy-count modifiers.", example: "Narrow Pass (exactly 1), Grand Cannon (up to 4)" },
                  { key: "heal_doubled", label: "Heal Doubled", color: "text-pink-300", bg: "bg-pink-900/20", border: "border-pink-500/30", desc: "All healing effects this round (Restoration trait, commander heal abilities) are doubled in value.", example: "Sacred Ground" },
                  { key: "guardian_disabled", label: "Guardian Disabled", color: "text-gray-300", bg: "bg-gray-900/20", border: "border-gray-500/30", desc: "The Guardian trait and all commander Shield abilities are completely disabled for this round on both sides.", example: "Open Field" },
                ].map((eff) => (
                  <div key={eff.key} className={`p-3 rounded-lg ${eff.bg} border ${eff.border}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <span className={`font-semibold text-sm ${eff.color}`}>{eff.label}</span>
                        <p className="text-purple-300 text-xs mt-0.5">{eff.desc}</p>
                        <p className="text-purple-500 text-xs italic mt-0.5">e.g. {eff.example}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-white font-semibold text-base mb-3">The 7 Starter Field Cards</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {fieldCards.map((fc, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg border border-green-500/20">
                    <span className="text-xl shrink-0">{fc.icon}</span>
                    <div>
                      <h4 className="text-white font-semibold text-sm">{fc.name}</h4>
                      <p className="text-purple-300 text-xs">{fc.effects}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
              <p className="text-green-300 text-sm font-semibold">💡 Strategy tip</p>
              <p className="text-purple-300 text-sm">Since both players see the active field cards after flipping, you can adapt your deployment mid-turn. Element-heavy decks benefit greatly from element_buff cards, while all_units_debuff punishes anyone who over-deploys low-power units.</p>
            </div>
          </CardContent>
        </Card>

        {/* Combat Resolution */}
        <Card className="bg-slate-800/50 border-purple-500/20 mb-6 md:mb-8">
          <CardHeader>
            <CardTitle className="text-white text-xl md:text-2xl flex items-center gap-3 flex-wrap">
              <Swords className="w-6 h-6 text-red-400" />
              Combat Resolution Order
            </CardTitle>
            <p className="text-purple-300 text-sm mt-1">Each round resolves in this fixed order after both players end their turn</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { step: 1, name: "Deploy & Reveal", desc: "Both players' face-down cards are revealed on the battlefield." },
                { step: 2, name: "Calculate Power", desc: "Each card's final power = base power + buffs − debuffs (min 0). Trait modifiers (Rally, Saboteur, Steadfast, Tactician) and active field card effects apply here. Both sides' totals are summed." },
                { step: 3, name: "Quick Strike", desc: "Cards with Quick Strike deal direct HP damage to the opponent, bypassing power comparison. Commander first_strike abilities also apply." },
                { step: 4, name: "Guardian Block", desc: "Guardian trait and commander shield abilities reduce total incoming damage (combat + Quick Strike). Disabled if Open Field is active." },
                { step: 5, name: "Healing", desc: "Restoration trait and commander heal abilities restore HP before damage is applied (capped at max 40 HP). Doubled if Sacred Ground is active." },
                { step: 6, name: "Determine Winner", desc: "Higher total power wins. Equal power = draw. Winner: +1 VP. Loser: +1 WP. Draw: both get +1 VP and +1 WP." },
                { step: 7, name: "Apply Net Damage", desc: "Loser takes (power diff + winner's QS − loser's Guardian). Winner takes (loser's QS − winner's Guardian). Both min 0." },
                { step: 8, name: "Care Package", desc: "Cards with Care Package let their owner draw extra cards from their deck." },
                { step: 9, name: "Last Stand", desc: "Cards with Last Stand deal direct damage to the opponent pilot, regardless of whether their side won or lost." },
                { step: 10, name: "Post-Combat Traits", desc: "Infiltrator units that won persist on the battlefield. Hold the Line units that would be removed survive with power 1. Reserve units deployed from the yard move to the Banish Zone." },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-purple-600 text-white text-sm font-bold shrink-0">{item.step}</span>
                  <div>
                    <h4 className="text-white font-semibold">{item.name}</h4>
                    <p className="text-purple-300 text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Commander Ability Categories */}
        <Card className="bg-slate-800/50 border-purple-500/20 mb-6 md:mb-8">
          <CardHeader>
            <CardTitle className="text-white text-xl md:text-2xl flex items-center gap-3 flex-wrap">
              <Crown className="w-6 h-6 text-yellow-500" />
              Commander Ability Categories
            </CardTitle>
          </CardHeader>
          <CardContent className="text-purple-200 space-y-6">
            <p className="text-sm md:text-base">
              Each commander has unique abilities that cost Victory Points (earned from winning combat) or Withdrawal Points (earned from losing combat). Abilities fall into four categories, each usable only during specific phases.
            </p>

            <div className="space-y-4">
              <div className="p-4 bg-slate-900/50 rounded-lg" data-testid="ability-category-group-buffs">
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 bg-blue-600 rounded-lg shrink-0">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-base md:text-lg">1. Group Buffs & Debuffs</h3>
                    <Badge variant="outline" className="text-blue-300 border-blue-500/40 mt-1">Combat Phase</Badge>
                  </div>
                </div>
                <ul className="list-disc list-inside space-y-1 text-sm text-purple-300">
                  <li><strong className="text-white">Element Buff:</strong> Increase power of your units matching a specific element</li>
                  <li><strong className="text-white">Universal Debuff:</strong> Reduce power of all enemy units</li>
                  <li><strong className="text-white">Targeted Debuff:</strong> Reduce power of enemy units that don't match your element</li>
                  <li><strong className="text-white">Effect Blocking:</strong> Disable enemy card buff/debuff effects</li>
                  <li><strong className="text-white">Protection:</strong> Prevent your element's units from receiving debuffs</li>
                </ul>
              </div>

              <div className="p-4 bg-slate-900/50 rounded-lg" data-testid="ability-category-trait-activation">
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 bg-amber-600 rounded-lg shrink-0">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-base md:text-lg">2. Trait Activation</h3>
                    <Badge variant="outline" className="text-amber-300 border-amber-500/40 mt-1">Combat Phase</Badge>
                  </div>
                </div>
                <ul className="list-disc list-inside space-y-1 text-sm text-purple-300">
                  <li><strong className="text-white">Quick Strike:</strong> Deal direct HP damage to the opponent, bypassing power comparison</li>
                  <li><strong className="text-white">Guardian/Shield:</strong> Block incoming damage from both combat and Quick Strike</li>
                  <li><strong className="text-white">Restoration:</strong> Heal your HP before damage is applied (capped at max 40 HP)</li>
                </ul>
              </div>

              <div className="p-4 bg-slate-900/50 rounded-lg" data-testid="ability-category-group-traits">
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 bg-purple-600 rounded-lg shrink-0">
                    <Swords className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-base md:text-lg">3. Trait-Like Group Effects</h3>
                    <Badge variant="outline" className="text-purple-300 border-purple-500/40 mt-1">Combat Phase</Badge>
                  </div>
                </div>
                <ul className="list-disc list-inside space-y-1 text-sm text-purple-300">
                  <li><strong className="text-white">Group Shield:</strong> All your units gain damage blocking</li>
                  <li><strong className="text-white">Group Quick Strike:</strong> All your units deal pre-combat damage</li>
                  <li><strong className="text-white">Group Healing:</strong> Heal HP based on all deployed units</li>
                </ul>
              </div>

              <div className="p-4 bg-slate-900/50 rounded-lg" data-testid="ability-category-extra-deploy">
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 bg-green-600 rounded-lg shrink-0">
                    <Layers className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-base md:text-lg">4. Extra Deployments</h3>
                    <Badge variant="outline" className="text-green-300 border-green-500/40 mt-1">Deployment Phase Only</Badge>
                  </div>
                </div>
                <ul className="list-disc list-inside space-y-1 text-sm text-purple-300">
                  <li><strong className="text-white">Extra Unit:</strong> Deploy 1 additional card from your hand this turn</li>
                  <li><strong className="text-white">Phase Restriction:</strong> Can only be used while placing cards face-down, before combat begins</li>
                </ul>
              </div>
            </div>

            <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
              <h3 className="text-white font-semibold mb-2">Phase Quick Reference</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-slate-700 text-purple-200">Draw</Badge>
                  <span>Card cycling, extra draws, field card flip</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-slate-700 text-purple-200">Deployment</Badge>
                  <span>Extra deploys, Vanguard auto-deploy, Flanking</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-slate-700 text-purple-200">Combat</Badge>
                  <span>Buffs, debuffs, traits, Last Stand damage</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-slate-700 text-purple-200">End</Badge>
                  <span>Clear field effects, Infiltrator/HtL/Reserve resolve</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Victory Conditions */}
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
