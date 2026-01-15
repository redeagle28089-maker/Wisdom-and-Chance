import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  GraduationCap, 
  Layers, 
  Swords, 
  Crown, 
  Flame, 
  Droplet, 
  Mountain, 
  Wind, 
  Leaf,
  Target,
  Shield,
  Heart,
  Zap,
  ArrowRight,
  CheckCircle2
} from "lucide-react";
import { Link } from "wouter";

const steps = [
  {
    id: 1,
    title: "Choose Your Commander",
    icon: Crown,
    color: "from-purple-600 to-pink-600",
    content: "Every deck needs a commander! Your commander determines your playstyle and grants special abilities during battle. Choose one that matches your strategy.",
    tips: [
      "Each commander has a unique element affinity",
      "Commander abilities can turn the tide of battle",
      "Your commander is separate from your 40-card deck"
    ]
  },
  {
    id: 2,
    title: "Build Your Deck",
    icon: Layers,
    color: "from-cyan-600 to-blue-600",
    content: "Construct a 40-card deck following the power distribution rules. Balance is key - you need exactly 4 cards of each power rank (1-10).",
    tips: [
      "40 cards total - no more, no less",
      "4 cards of each power rank (1-10)",
      "Maximum 3 copies of any single card",
      "Mix elements for versatility"
    ]
  },
  {
    id: 3,
    title: "Understand the Elements",
    icon: Flame,
    color: "from-red-600 to-orange-600",
    content: "Each card belongs to one of five elements. While there are no strict counters, some traits work better against certain elements.",
    elements: [
      { name: "Fire", icon: Flame, color: "bg-red-600", desc: "Aggressive, high damage potential" },
      { name: "Water", icon: Droplet, color: "bg-blue-600", desc: "Defensive, healing abilities" },
      { name: "Earth", icon: Mountain, color: "bg-amber-600", desc: "Sturdy, high base power" },
      { name: "Air", icon: Wind, color: "bg-green-500", desc: "Swift, quick strike effects" },
      { name: "Nature", icon: Leaf, color: "bg-emerald-600", desc: "Growth, restoration powers" },
    ]
  },
  {
    id: 4,
    title: "Learn the Turn Phases",
    icon: Zap,
    color: "from-yellow-500 to-orange-500",
    content: "Each turn follows a specific order of phases. Master the flow to time your moves perfectly.",
    phases: [
      { name: "Draw Phase", desc: "Draw 2 cards from your deck" },
      { name: "Deployment Phase", desc: "Play 2 cards face-down on the battlefield" },
      { name: "Combat Phase", desc: "Reveal all deployed cards" },
      { name: "Calculation Phase", desc: "Compare power, apply damage" },
      { name: "End Phase", desc: "Check win conditions, cleanup" },
    ]
  },
  {
    id: 5,
    title: "Win the Battle",
    icon: Target,
    color: "from-green-600 to-emerald-600",
    content: "Victory is achieved by reducing your opponent's HP to 0 or forcing them to run out of cards. Play strategically!",
    tips: [
      "Starting HP: 40 for each player",
      "Damage = difference in total power each round",
      "Running out of cards means defeat",
      "Use commander abilities wisely"
    ]
  }
];

export default function TutorialPage() {
  return (
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl mb-4 shadow-xl">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2" data-testid="text-tutorial-title">
            How to Play
          </h1>
          <p className="text-lg text-purple-200">
            Master the basics and become a champion!
          </p>
        </div>

        <div className="space-y-6">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <Card key={step.id} className="bg-slate-800/50 border-purple-500/20">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <Badge variant="secondary" className="mb-1">Step {step.id}</Badge>
                      <CardTitle className="text-white text-xl">{step.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-purple-200 mb-4">{step.content}</p>
                  
                  {step.tips && (
                    <div className="space-y-2">
                      {step.tips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-purple-300">{tip}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {step.elements && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                      {step.elements.map((el) => {
                        const ElIcon = el.icon;
                        return (
                          <div key={el.name} className="p-3 rounded-lg bg-slate-900/50 border border-purple-500/20 text-center">
                            <div className={`w-10 h-10 ${el.color} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                              <ElIcon className="w-5 h-5 text-white" />
                            </div>
                            <h4 className="text-white font-medium text-sm">{el.name}</h4>
                            <p className="text-purple-400 text-xs mt-1">{el.desc}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {step.phases && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {step.phases.map((phase, i) => (
                        <div key={i} className="flex items-center">
                          <div className="px-3 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
                            <span className="text-white font-medium text-sm">{phase.name}</span>
                            <p className="text-purple-400 text-xs">{phase.desc}</p>
                          </div>
                          {i < step.phases!.length - 1 && (
                            <ArrowRight className="w-4 h-4 text-purple-500 mx-1 flex-shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="bg-gradient-to-r from-purple-600/30 to-pink-600/30 border-purple-500/40 mt-8">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Ready to Play?</h2>
            <p className="text-purple-200 mb-6 max-w-md mx-auto">
              Build your first deck and test your skills against the AI in Practice Mode!
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/deck-builder">
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg" data-testid="button-build-deck">
                  <Layers className="w-4 h-4 mr-2" />
                  Build a Deck
                </Button>
              </Link>
              <Link href="/practice">
                <Button variant="outline" className="border-purple-500/50 text-purple-200 hover:bg-purple-500/20" data-testid="button-practice">
                  <Swords className="w-4 h-4 mr-2" />
                  Practice Mode
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
