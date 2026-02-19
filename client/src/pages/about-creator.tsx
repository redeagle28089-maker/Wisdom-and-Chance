import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ExternalLink, Monitor, Film, Palette, Briefcase, GraduationCap, 
  Award, Globe, Gamepad2, Sparkles
} from "lucide-react";
import { SiLinkedin, SiAdobeaftereffects, SiAdobepremierepro, SiAdobephotoshop, SiAdobeillustrator } from "react-icons/si";

const skills = [
  { name: "After Effects", icon: SiAdobeaftereffects },
  { name: "Premiere Pro", icon: SiAdobepremierepro },
  { name: "Photoshop", icon: SiAdobephotoshop },
  { name: "Illustrator", icon: SiAdobeillustrator },
  { name: "Motion Graphics", icon: Film },
  { name: "Video Editing", icon: Monitor },
  { name: "Visual Storytelling", icon: Palette },
  { name: "Game Design", icon: Gamepad2 },
];

const links = [
  {
    title: "Portfolio Website",
    description: "View motion graphics work, projects, and resume",
    url: "https://jmyersmotiongraphics.weebly.com",
    icon: Globe,
    color: "from-purple-600 to-pink-600",
  },
  {
    title: "LinkedIn Profile",
    description: "Professional profile and connections",
    url: "https://linkedin.com/in/jason-myers-66a070177",
    icon: SiLinkedin,
    color: "from-blue-600 to-blue-500",
  },
  {
    title: "Portfolio Gallery",
    description: "Browse recent motion graphics and video projects",
    url: "https://jmyersmotiongraphics.weebly.com/portfolio.html",
    icon: Film,
    color: "from-amber-600 to-orange-500",
  },
  {
    title: "Download Resume",
    description: "Full professional resume (PDF)",
    url: "https://jmyersmotiongraphics.weebly.com/uploads/7/3/2/3/7323966/jason_myers_motiongraphic_resume_final.pdf",
    icon: Briefcase,
    color: "from-emerald-600 to-green-500",
  },
];

export default function AboutCreatorPage() {
  return (
    <div className="min-h-full p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">

        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <p className="text-sm font-semibold uppercase tracking-wider text-purple-400">About the Creator</p>
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white" data-testid="text-creator-name">
            Jason Myers
          </h1>
          <p className="text-lg text-purple-300" data-testid="text-creator-title">
            Motion Graphic Designer / Video Editor / Game Creator
          </p>
        </div>

        <Card className="bg-slate-800/50 border-purple-500/20">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-xl overflow-hidden flex-shrink-0 mx-auto md:mx-0 border-2 border-purple-500/30 shadow-lg shadow-purple-500/20">
                <img 
                  src="https://jmyersmotiongraphics.weebly.com/uploads/7/3/2/3/7323966/published/jasonmyers-headshot-color-edited-2-circle.png?1713870326" 
                  alt="Jason Myers" 
                  className="w-full h-full object-cover"
                  data-testid="img-creator-photo"
                />
              </div>

              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="bg-purple-600/30 text-purple-200 border-purple-500/30">
                    <Palette className="w-3 h-3 mr-1" />
                    Designer
                  </Badge>
                  <Badge variant="secondary" className="bg-blue-600/30 text-blue-200 border-blue-500/30">
                    <Film className="w-3 h-3 mr-1" />
                    Video Editor
                  </Badge>
                  <Badge variant="secondary" className="bg-pink-600/30 text-pink-200 border-pink-500/30">
                    <Gamepad2 className="w-3 h-3 mr-1" />
                    Game Creator
                  </Badge>
                </div>

                <p className="text-purple-100 leading-relaxed" data-testid="text-creator-bio">
                  I am a Motion Graphic Designer and Video Editor who loves combining various clips and effects 
                  to develop a compelling visual message. I utilize my detail-oriented video editing skills to 
                  achieve an imaginative and impactful product. As a visual storyteller, I continually seek new 
                  knowledge and techniques to enhance my work.
                </p>
                <p className="text-purple-200/80 leading-relaxed">
                  As a Freelance Motion Graphic Designer and Video Editor, I have experience creating motion 
                  graphics and videos for social media posts, presentations, and the web that tell a clear and 
                  concise story. I am proficient in Motion Graphics, Video Production, and the Adobe Creative 
                  Suite including After Effects, Premiere Pro, Photoshop, Animate, and Illustrator.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-purple-500/20">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="w-5 h-5 text-amber-400" />
              <h2 className="text-xl font-bold text-white">Education</h2>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-600/20 flex items-center justify-center flex-shrink-0">
                <Award className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Lone Star College - CyFair</h3>
                <p className="text-purple-300 text-sm">Motion Graphics Degree</p>
                <p className="text-purple-400 text-sm">Houston, TX</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="secondary" className="bg-amber-600/20 text-amber-300 border-amber-500/30">
                    3.7 GPA
                  </Badge>
                  <Badge variant="secondary" className="bg-amber-600/20 text-amber-300 border-amber-500/30">
                    Phi Theta Kappa Honor Society
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Monitor className="w-5 h-5 text-purple-400" />
            Skills & Tools
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {skills.map((skill) => (
              <Card key={skill.name} className="bg-slate-800/50 border-purple-500/20">
                <CardContent className="p-4 flex items-center gap-3">
                  <skill.icon className="w-5 h-5 text-purple-400 flex-shrink-0" />
                  <span className="text-sm text-purple-100 truncate">{skill.name}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-purple-400" />
            About Wisdom & Chance TCG
          </h2>
          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardContent className="p-6 md:p-8">
              <p className="text-purple-100 leading-relaxed" data-testid="text-game-vision">
                Wisdom & Chance TCG is a passion project born from a love of strategic card games and 
                visual storytelling. Combining creative design skills with game development, this tactical 
                trading card game features five elemental powers, deck building, AI opponents, and 
                real-time multiplayer battles. Every card, mechanic, and visual element has been 
                crafted to deliver an immersive and engaging experience for players of all skill levels.
              </p>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-purple-400" />
            Links & Resources
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {links.map((link) => (
              <a 
                key={link.title} 
                href={link.url} 
                target="_blank" 
                rel="noopener noreferrer"
                data-testid={`link-${link.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Card className="bg-slate-800/50 border-purple-500/20 hover-elevate h-full">
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${link.color} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                      <link.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{link.title}</h3>
                        <ExternalLink className="w-3 h-3 text-purple-400 flex-shrink-0" />
                      </div>
                      <p className="text-sm text-purple-300 mt-1">{link.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        </div>

        <div className="text-center pb-8">
          <p className="text-sm text-purple-400/60">
            Designed and developed by Jason Myers
          </p>
        </div>
      </div>
    </div>
  );
}
