import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookMarked, Flame, Droplet, Mountain, Wind, Leaf, Crown, Scroll, Map, Users } from "lucide-react";

const elementIcons = {
  Fire: Flame,
  Water: Droplet,
  Earth: Mountain,
  Air: Wind,
  Nature: Leaf,
};

const elementColors = {
  Fire: "from-red-600 to-orange-600",
  Water: "from-blue-600 to-cyan-600",
  Earth: "from-amber-600 to-yellow-600",
  Air: "from-cyan-400 to-teal-400",
  Nature: "from-green-600 to-emerald-600",
};

const loreEntries = {
  world: [
    {
      id: "origin",
      title: "The Origin of Elements",
      content: "In the beginning, there was only the Void - an endless expanse of potential energy. From this primordial chaos emerged the five Elemental Titans, beings of pure elemental essence who would shape the world of Aethoria. Fire brought warmth and destruction, Water brought life and change, Earth brought stability and strength, Air brought freedom and thought, and Nature brought growth and harmony.",
    },
    {
      id: "war",
      title: "The Great Elemental War",
      content: "For millennia, the elements existed in balance. But when the Fire Titan Pyraxus sought to consume all other elements, the Great Elemental War began. This cataclysmic conflict lasted three hundred years and reshaped the very fabric of Aethoria. Mountains rose and fell, oceans boiled, forests grew and burned, and the skies themselves were torn asunder.",
    },
    {
      id: "peace",
      title: "The Binding Accord",
      content: "The war ended not with a victor, but with a treaty. The Titans, exhausted from their conflict, agreed to the Binding Accord - a magical pact that sealed their physical forms and distributed their power among mortals. These chosen individuals became the first Commanders, wielding elemental magic through specially crafted cards that served as conduits for the Titans' residual power.",
    },
  ],
  elements: [
    {
      id: "fire",
      element: "Fire" as const,
      title: "The Flame Domain",
      content: "Fire represents passion, destruction, and rebirth. The Flame Domain is a realm of eternal infernos, volcanic landscapes, and creatures forged in living flame. Fire wielders draw power from their emotions, channeling rage and determination into devastating attacks. The Fire Titan Pyraxus, though bound, still whispers to those with the strongest flames in their hearts.",
    },
    {
      id: "water",
      element: "Water" as const,
      title: "The Tidal Depths",
      content: "Water embodies adaptability, mystery, and the flow of life itself. The Tidal Depths encompass endless oceans, sacred springs, and the ancient underwater kingdoms where the first civilizations were born. Water wielders are masters of healing and erosion, understanding that patience and persistence can overcome any obstacle.",
    },
    {
      id: "earth",
      element: "Earth" as const,
      title: "The Stone Kingdoms",
      content: "Earth represents endurance, tradition, and unwavering strength. The Stone Kingdoms are vast underground empires carved from living rock, where dwarven artisans and golem servants have built monuments that will stand for eternity. Earth wielders are defenders without equal, their bodies becoming as hard as the mountains themselves.",
    },
    {
      id: "air",
      element: "Air" as const,
      title: "The Sky Reaches",
      content: "Air symbolizes freedom, intellect, and swift action. The Sky Reaches are floating islands connected by wind bridges, home to cloud cities and aerial temples. Air wielders move faster than thought, striking before their enemies can react. They value knowledge above all, believing that understanding is the greatest power.",
    },
    {
      id: "nature",
      element: "Nature" as const,
      title: "The Wild Heart",
      content: "Nature represents growth, harmony, and the cycle of life and death. The Wild Heart is an ancient forest that spans continents, where trees older than civilization harbor secrets beyond mortal comprehension. Nature wielders commune with all living things, calling upon the fury of beasts and the regenerative power of the natural world.",
    },
  ],
  commanders: [
    {
      id: "pyraxus",
      element: "Fire" as const,
      name: "Pyraxus the Inferno",
      title: "Lord of Flames",
      story: "Once a mortal warrior consumed by vengeance, Pyraxus sought the Fire Titan's power to destroy his enemies. The Titan, impressed by his burning hatred, granted him a fraction of its essence. Now Pyraxus leads the Flame Legions, his body wreathed in eternal fire, seeking worthy opponents to test his blazing might.",
    },
    {
      id: "nerissa",
      element: "Water" as const,
      name: "Nerissa the Tidekeeper",
      title: "Queen of the Depths",
      story: "Nerissa was a priestess who gave her life to stop a tsunami that would have destroyed her coastal city. The Water Titan, moved by her sacrifice, resurrected her as its avatar. Now she rules the Tidal Depths, commanding the waters with wisdom and compassion, though she can be as merciless as a storm when provoked.",
    },
    {
      id: "terragor",
      element: "Earth" as const,
      name: "Terragor the Unbreakable",
      title: "Mountain King",
      story: "Terragor was the greatest architect of the Stone Kingdoms, whose monuments were said to rival the mountains themselves. When his city faced destruction, he merged with the very foundation of the earth to become its eternal guardian. His body is now living stone, and his will is as immovable as bedrock.",
    },
    {
      id: "zephyros",
      element: "Air" as const,
      name: "Zephyros the Swift",
      title: "Windlord Eternal",
      story: "A scholar who dedicated his life to unlocking the secrets of flight, Zephyros succeeded beyond his wildest dreams when the Air Titan chose him as its herald. Now he soars through the Sky Reaches, a being of pure wind and lightning, gathering knowledge from every corner of Aethoria.",
    },
    {
      id: "verdantia",
      element: "Nature" as const,
      name: "Verdantia the Everbloom",
      title: "Guardian of the Wild",
      story: "Verdantia was a druid who bonded so deeply with the Wild Heart that she became one with the forest itself. Her consciousness now spans thousands of trees, and every creature of the wild answers her call. She protects the balance of nature with fierce devotion, nurturing growth and unleashing decay in equal measure.",
    },
  ],
};

export default function LoreArchivesPage() {
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4" data-testid="text-lore-title">
            Lore Archives
          </h1>
          <p className="text-lg text-purple-200">Discover the rich history and mythology of Aethoria</p>
        </div>

        <Tabs defaultValue="world" className="w-full">
          <TabsList className="w-full max-w-2xl mx-auto mb-6 bg-slate-800/50 border border-purple-500/20">
            <TabsTrigger value="world" className="flex-1" data-testid="tab-world">
              <Map className="w-4 h-4 mr-2" />
              World History
            </TabsTrigger>
            <TabsTrigger value="elements" className="flex-1" data-testid="tab-elements">
              <Scroll className="w-4 h-4 mr-2" />
              Elements
            </TabsTrigger>
            <TabsTrigger value="commanders" className="flex-1" data-testid="tab-commanders">
              <Crown className="w-4 h-4 mr-2" />
              Commanders
            </TabsTrigger>
          </TabsList>

          <TabsContent value="world">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {loreEntries.world.map((entry) => (
                <Card
                  key={entry.id}
                  className="bg-slate-800/50 border-purple-500/20 hover-elevate cursor-pointer"
                  onClick={() => setSelectedEntry(entry.id)}
                  data-testid={`card-lore-${entry.id}`}
                >
                  <CardHeader>
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center mb-2">
                      <BookMarked className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-white text-lg">{entry.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-300 text-sm line-clamp-3">{entry.content}</p>
                    <Button variant="ghost" className="mt-4 text-purple-300 p-0 h-auto">
                      Read More
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="elements">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loreEntries.elements.map((entry) => {
                const Icon = elementIcons[entry.element];
                const gradient = elementColors[entry.element];
                return (
                  <Card
                    key={entry.id}
                    className="bg-slate-800/50 border-purple-500/20 hover-elevate cursor-pointer"
                    onClick={() => setSelectedEntry(entry.id)}
                    data-testid={`card-element-${entry.id}`}
                  >
                    <CardHeader>
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center mb-2`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <CardTitle className="text-white text-lg">{entry.title}</CardTitle>
                      <Badge variant="outline" className="w-fit border-purple-500/30 text-purple-300">
                        {entry.element}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <p className="text-slate-300 text-sm line-clamp-3">{entry.content}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="commanders">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loreEntries.commanders.map((commander) => {
                const Icon = elementIcons[commander.element];
                const gradient = elementColors[commander.element];
                return (
                  <Card
                    key={commander.id}
                    className="bg-slate-800/50 border-purple-500/20 hover-elevate cursor-pointer"
                    onClick={() => setSelectedEntry(commander.id)}
                    data-testid={`card-commander-${commander.id}`}
                  >
                    <CardHeader>
                      <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center mb-2 ring-2 ring-white/20`}>
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <CardTitle className="text-white text-lg">{commander.name}</CardTitle>
                      <p className="text-purple-300 text-sm">{commander.title}</p>
                      <Badge variant="outline" className="w-fit border-purple-500/30 text-purple-300">
                        {commander.element}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <p className="text-slate-300 text-sm line-clamp-4">{commander.story}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        <Card className="bg-slate-800/50 border-purple-500/20 mt-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              The Five Factions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300 mb-4">
              In the modern era of Aethoria, the descendants of the original Commanders have formed five great factions, 
              each dedicated to mastering their elemental heritage. These factions compete in the Grand Tournament, 
              where wielders from across the realm test their skills in strategic card battles.
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(elementIcons).map(([element, Icon]) => (
                <Badge key={element} variant="outline" className="border-purple-500/30 text-purple-300">
                  <Icon className="w-3 h-3 mr-1" />
                  {element} Faction
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
