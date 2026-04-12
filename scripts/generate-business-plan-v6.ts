import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const OUTPUT_PATH = path.resolve("Wisdom_Chance_TCG_Business_Plan_v7.0.pdf");

function countEndpoints(filePath: string): number {
  try {
    const out = execSync(`grep -cE '\\.(get|post|patch|put|delete)\\(' ${filePath}`, { encoding: "utf-8" });
    return parseInt(out.trim(), 10) || 0;
  } catch { return 0; }
}

function countLines(pattern: string): number {
  try {
    const out = execSync(`find ${pattern} -name '*.tsx' -o -name '*.ts' 2>/dev/null | xargs wc -l 2>/dev/null | tail -1`, { encoding: "utf-8" });
    const match = out.trim().match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  } catch { return 0; }
}

function countLinesOfFile(filePath: string): number {
  try {
    const out = execSync(`wc -l < ${filePath}`, { encoding: "utf-8" });
    return parseInt(out.trim(), 10) || 0;
  } catch { return 0; }
}

function countFiles(pattern: string, exclude?: string): number {
  try {
    let cmd = `find ${pattern} -name '*.tsx'`;
    if (exclude) cmd += ` ! -name '${exclude}'`;
    cmd += ` 2>/dev/null | wc -l`;
    const out = execSync(cmd, { encoding: "utf-8" });
    return parseInt(out.trim(), 10) || 0;
  } catch { return 0; }
}

const ROUTE_FILES = [
  { label: "routes.ts", path: "server/routes.ts" },
  { label: "paymentRoutes.ts", path: "server/paymentRoutes.ts" },
  { label: "multiplayerRoutes.ts", path: "server/multiplayerRoutes.ts" },
  { label: "mobileAuth.ts", path: "server/mobileAuth.ts" },
  { label: "apiDocs.ts", path: "server/apiDocs.ts" },
  { label: "auth/routes.ts", path: "server/replit_integrations/auth/routes.ts" },
  { label: "auth/replitAuth.ts", path: "server/replit_integrations/auth/replitAuth.ts" },
  { label: "chat/routes.ts", path: "server/replit_integrations/chat/routes.ts" },
  { label: "image/routes.ts", path: "server/replit_integrations/image/routes.ts" },
];

const endpointsByFile = ROUTE_FILES.map(f => ({
  ...f,
  count: countEndpoints(f.path),
}));

const METRICS = {
  endpointsByFile,
  routesEndpoints: endpointsByFile.find(f => f.label === "routes.ts")!.count,
  paymentEndpoints: endpointsByFile.find(f => f.label === "paymentRoutes.ts")!.count,
  multiplayerEndpoints: endpointsByFile.find(f => f.label === "multiplayerRoutes.ts")!.count,
  mobileAuthEndpoints: endpointsByFile.find(f => f.label === "mobileAuth.ts")!.count,
  get totalEndpoints() { return this.endpointsByFile.reduce((sum, f) => sum + f.count, 0); },
  serverLOC: countLines("server"),
  clientLOC: countLines("client/src"),
  mobileLOC: countLines("mobile/app mobile/components mobile/lib mobile/constants"),
  sharedLOC: countLines("shared"),
  get totalLOC() { return this.serverLOC + this.clientLOC + this.mobileLOC + this.sharedLOC; },
  webPages: countFiles("client/src/pages"),
  mobileScreens: (() => {
    try {
      const out = execSync(`find mobile/app -name '*.tsx' ! -name '_layout.tsx' ! -name '+*' 2>/dev/null | wc -l`, { encoding: "utf-8" });
      return parseInt(out.trim(), 10) || 0;
    } catch { return 0; }
  })(),
  mobileComponents: countFiles("mobile/components"),
  sharedModels: (() => {
    try {
      const out = execSync(`ls shared/models/*.ts 2>/dev/null | wc -l`, { encoding: "utf-8" });
      return parseInt(out.trim(), 10) || 0;
    } catch { return 0; }
  })(),
  routesLOC: countLinesOfFile("server/routes.ts"),
  paymentRoutesLOC: countLinesOfFile("server/paymentRoutes.ts"),
  websocketLOC: countLinesOfFile("server/websocket.ts"),
  gameEngineLOC: countLinesOfFile("server/gameEngine.ts"),
  storageLOC: countLinesOfFile("server/storage.ts"),
  economyLOC: countLinesOfFile("server/economyService.ts"),
};

console.log("Computed metrics:", JSON.stringify(METRICS, null, 2));

const COLORS = {
  primary: "#1a1a2e",
  accent: "#6C63FF",
  accentDark: "#4a42d4",
  text: "#1a1a2e",
  textLight: "#555",
  white: "#ffffff",
  lightBg: "#f5f5ff",
  border: "#ddd",
  gold: "#D4AF37",
  green: "#2ecc71",
  red: "#e74c3c",
};

function createPDF() {
  const doc = new PDFDocument({
    size: "letter",
    margins: { top: 60, bottom: 60, left: 60, right: 60 },
    info: {
      Title: "Wisdom & Chance TCG — Business Plan v7.0",
      Author: "Legraphics Gaming Division — Jason Myers",
      Subject: "Investment & Crowdfunding Business Plan — Legraphics Gaming Division",
    },
    bufferPages: true,
  });

  const stream = fs.createWriteStream(OUTPUT_PATH);
  doc.pipe(stream);

  const PAGE_BOTTOM = doc.page.height - 80;

  function ensureSpace(needed: number) {
    if (doc.y + needed > PAGE_BOTTOM) doc.addPage();
  }

  function sectionTitle(title: string) {
    const usedOnPage = doc.y - 60;
    if (usedOnPage > 40) {
      doc.addPage();
    }
    doc.moveDown(0.5);
    doc
      .fontSize(18)
      .fillColor(COLORS.accent)
      .text(title.toUpperCase(), { underline: false });
    doc
      .moveTo(60, doc.y + 2)
      .lineTo(doc.page.width - 60, doc.y + 2)
      .strokeColor(COLORS.accent)
      .lineWidth(2)
      .stroke();
    doc.moveDown(0.5);
  }

  function subSection(title: string) {
    ensureSpace(60);
    doc.moveDown(0.5);
    doc.fontSize(13).fillColor(COLORS.accentDark).text(title, { underline: false });
    doc.moveDown(0.3);
  }

  function body(text: string) {
    doc.fontSize(10.5).fillColor(COLORS.text).text(text, {
      align: "justify",
      lineGap: 3,
    });
    doc.moveDown(0.3);
  }

  function bullet(text: string) {
    doc.fontSize(10.5).fillColor(COLORS.text).text(`  \u2022  ${text}`, {
      indent: 10,
      lineGap: 2,
    });
  }

  function tableRow(cells: string[], y: number, widths: number[], header = false) {
    if (y + 22 > PAGE_BOTTOM) {
      doc.addPage();
      y = 60;
    }
    let x = 60;
    const h = header ? 22 : 20;
    for (let i = 0; i < cells.length; i++) {
      if (header) {
        doc.rect(x, y, widths[i], h).fill(COLORS.accent);
        doc.fontSize(9).fillColor(COLORS.white).text(cells[i], x + 4, y + 5, {
          width: widths[i] - 8,
          align: i > 0 ? "right" : "left",
          lineBreak: false,
        });
      } else {
        const rowIdx = Math.floor((y - 60) / 20);
        doc.rect(x, y, widths[i], h).fill(rowIdx % 2 === 0 ? COLORS.lightBg : COLORS.white);
        doc.rect(x, y, widths[i], h).strokeColor(COLORS.border).lineWidth(0.5).stroke();
        doc.fontSize(9).fillColor(COLORS.text).text(cells[i], x + 4, y + 5, {
          width: widths[i] - 8,
          align: i > 0 ? "right" : "left",
          lineBreak: false,
        });
      }
      x += widths[i];
    }
    return y + h;
  }

  doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.primary);
  doc.moveDown(5);
  doc.fontSize(42).fillColor(COLORS.accent).text("WISDOM & CHANCE", { align: "center" });
  doc.fontSize(36).fillColor(COLORS.gold).text("TCG", { align: "center" });
  doc.moveDown(0.8);
  doc.fontSize(14).fillColor(COLORS.white).text("BUSINESS PLAN v7.0", { align: "center" });
  doc.moveDown(0.4);
  doc.fontSize(12).fillColor(COLORS.gold).text("Legraphics Gaming Division", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("#aaa").text("A division of Legraphics \u2014 Family-Owned Graphic Design Business (Est. 30+ Years)", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("#aaa").text("Investment & Crowdfunding Prospectus", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("#aaa").text("April 2026", { align: "center" });
  doc.moveDown(3);
  doc.fontSize(10).fillColor("#888").text("CONFIDENTIAL", { align: "center" });
  doc.moveDown(0.4);
  doc.fontSize(9).fillColor("#666").text("Prepared by Jason Myers, Founder & Division Head", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor("#666").text("For potential investors, crowdfunding backers, and strategic partners", { align: "center" });
  doc.moveDown(0.8);
  doc.fontSize(9).fillColor("#666").text("https://wisdom-and-chance-2.replit.app", { align: "center", link: "https://wisdom-and-chance-2.replit.app" });

  doc.addPage();
  sectionTitle("Table of Contents");
  doc.moveDown(0.5);
  const toc = [
    "1.  Executive Summary",
    "2.  Founder & Legraphics Gaming Division",
    "3.  Product Description",
    "4.  The Prototype Advantage — Why Backers Should Be Excited",
    "5.  Market Analysis",
    "6.  Competitive Analysis — Hearthstone Case Study",
    "7.  Revenue Model & Product Catalog",
    "8.  Cost Analysis — Solo Operator Model",
    "9.  Marketing & Growth Strategy",
    "10. Crowdfunding Campaign Strategy — Kickstarter + BackerKit",
    "11. Development Roadmap",
    "12. Financial Projections",
    "13. Funding Requirements & Use of Funds",
    "14. Risk Analysis & Mitigation",
    "15. Appendix: Technical Architecture",
  ];
  for (const entry of toc) {
    doc.fontSize(11).fillColor(COLORS.text).text(entry, 80);
  }

  doc.addPage();
  sectionTitle("1. Executive Summary");

  body(
    "Wisdom & Chance TCG is a digital trading card game that combines strategic deck-building with elemental combat mechanics. The game features five elemental factions \u2014 Fire, Water, Earth, Air, and Nature \u2014 with a planned first set of 100 unique cards and 5 Commanders (50 cards and all 5 Commanders built so far), each with specialized abilities that create deep strategic gameplay."
  );

  body(
    "What makes this project extraordinary is how it was built: Jason Myers, heading the new Legraphics Gaming Division (an expansion of Legraphics, a family-owned graphic design business with 30+ years of history), has single-handedly created a product that would traditionally require a team of 4\u20136 engineers and $320,000\u2013$900,000 in development costs \u2014 for approximately $400 in Replit subscription fees. Including a $50,000/year founder salary and Replit platform costs, the entire operation runs on approximately $4,209\u2013$4,237 per month in fixed costs \u2014 a fraction of what any competing TCG spends on a single developer."
  );

  body("Key milestones achieved:");
  bullet("Fully functional web application live at wisdom-and-chance-2.replit.app");
  bullet("Fully functional mobile application running in Expo Go (iOS/Android)");
  bullet("Unified monorepo architecture \u2014 web and mobile share one Express server and PostgreSQL database");
  bullet(`${METRICS.totalEndpoints} API endpoints powering cards, decks, commanders, game engine, social features, economy, and payments`);
  bullet("Server-side game engine with real-time WebSocket multiplayer");
  bullet(`~${(Math.round(METRICS.totalLOC / 1000) * 1000).toLocaleString()} lines of production code across server, web client, and mobile app`);
  bullet("AI-powered deck suggestions using Google Gemini integration");
  bullet("Stripe and PayPal payment integrations for web; ready for mobile in-app purchases");
  bullet("Social system with friends, messaging, leaderboards, achievements, and daily challenges");
  doc.moveDown(0.3);

  body(
    "Total monthly fixed operating costs including founder compensation are approximately $4,209\u2013$4,237 ($50,000/year founder salary + Replit platform + services), compared to Hearthstone\u2019s estimated $15\u2013$20 million per year in operating costs. This extreme capital efficiency means profitability can be achieved with approximately 500\u2013550 paying users per month."
  );

  body(
    "The project is seeking $25,000\u2013$50,000 in funding to cover 6\u201312 months of founder salary, marketing, app store fees, AI image generation for professional card artwork, and growth capital."
  );

  sectionTitle("2. Founder & Legraphics Gaming Division");

  subSection("Jason Myers \u2014 Founder & Division Head");
  body(
    "Jason Myers is an avid game enthusiast and storyteller who has spent years immersed in trading card games, strategy games, and interactive storytelling. As the founder and head of the Legraphics Gaming Division, Jason brings a unique combination of creative vision, design heritage, and hands-on technical execution to Wisdom & Chance TCG."
  );
  body(
    "Jason serves as sole developer, product designer, artist, marketer, and project manager. All code \u2014 server, web client, and mobile app \u2014 has been written exclusively on Replit using AI-assisted development tools (Replit Agent), averaging 40 hours per week of development time. This approach has enabled one person to build what would traditionally require a team of 4\u20136 engineers over 12+ months."
  );

  subSection("Legraphics \u2014 A Family Legacy of Design (30+ Years)");
  body(
    "Wisdom & Chance TCG is not a random indie project from an unknown developer \u2014 it is the first venture of the Legraphics Gaming Division, a new arm of Legraphics, a family-owned graphic design business with more than 30 years of history. For three decades, Legraphics has served clients with professional design, branding, and visual communication services, building a reputation for quality craftsmanship and creative excellence."
  );
  body(
    "The gaming division leverages this deep design DNA in every aspect of the product: from the elemental card frame aesthetics and UI/UX design to the branding, marketing materials, and this very business plan. Legraphics\u2019 30+ years of design expertise give Wisdom & Chance a visual polish and brand coherence that most indie games lack \u2014 because most indie developers don\u2019t have a family design business backing them."
  );

  subSection("Why Legraphics Gaming Division?");
  bullet("Established business infrastructure \u2014 Legraphics is a real, operating business with 30+ years of history, not a startup from scratch");
  bullet("Design heritage \u2014 Decades of professional graphic design experience directly informs card art direction, UI design, and brand identity");
  bullet("Family stability \u2014 A family-owned business adds credibility and long-term commitment that solo indie devs and VC-backed startups often lack");
  bullet("Cross-pollination \u2014 Gaming division benefits from Legraphics\u2019 existing client network, business tools, and operational knowledge");
  bullet("Low overhead \u2014 Shared business infrastructure means the gaming division doesn\u2019t need separate legal, accounting, or administrative costs");
  doc.moveDown(0.3);

  subSection("How One Person Does It All");
  bullet("Development: Replit Agent provides AI-assisted coding, debugging, and deployment \u2014 multiplying individual output by 5\u201310x");
  bullet("Card Artwork: AI image generation + Legraphics design expertise create professional-quality card illustrations");
  bullet("Marketing: Social media, community management, and content creation \u2014 all handled by Jason");
  bullet("Operations: Replit\u2019s integrated platform handles hosting, database, deployments, and infrastructure automatically");
  bullet("Business Strategy: Jason handles all planning, financial modeling, and investor relations, backed by Legraphics\u2019 30+ years of business experience");
  doc.moveDown(0.3);

  subSection("Development Philosophy");
  body(
    "All coding, deployment, database management, and infrastructure are handled through Replit. This eliminates the need for separate hosting providers, CI/CD pipelines, DevOps personnel, or local development environments. Replit\u2019s integrated platform provides version control, database hosting (PostgreSQL), deployment, secret management, and AI-assisted code generation \u2014 all in one browser-based environment."
  );

  body(
    "This solo-operator model is not a limitation \u2014 it\u2019s a strategic advantage. With Jason drawing a $50,000/year salary and total fixed monthly costs of ~$4,209\u2013$4,237, the project\u2019s burn rate is less than what most studios spend on a single junior developer. This enables the project to take calculated risks on features and marketing, and reach profitability with modest user traction."
  );

  sectionTitle("3. Product Description");

  subSection("Core Game Mechanics");
  body("Wisdom & Chance TCG is built on a phase-based combat system:");
  bullet("Draw Phase \u2014 Players draw cards from their deck simultaneously");
  bullet("Deployment Phase \u2014 Players place cards face-down on the battlefield");
  bullet("Combat Phase \u2014 Cards are revealed and power totals determine the round winner");
  bullet("Calculation Phase \u2014 Damage is applied, traits trigger, Victory/Withdrawal Points are awarded");
  doc.moveDown(0.3);

  body("Each card has base power (1\u201310), an elemental affinity, and optional traits:");
  bullet("Quick Strike \u2014 Deals direct damage before main combat");
  bullet("Guardian \u2014 Absorbs incoming damage to protect HP");
  bullet("Restoration \u2014 Heals the player\u2019s HP");
  bullet("Care Package \u2014 Draws additional cards");
  doc.moveDown(0.3);

  body("Commanders add a strategic layer with unique abilities that cost Victory Points (VP) or Withdrawal Points (WP) to activate. Abilities include element buffs, direct damage, card cycling, deploy bonuses, enemy debuffs, and protective shields.");

  subSection("Web Application \u2014 Live & Operational");
  body("The web app (wisdom-and-chance-2.replit.app) includes:");
  bullet(`${METRICS.webPages} pages: Home, Card Database, Deck Builder, Practice Mode, Multiplayer Lobby, Game Board, Shop, Profile, Analytics, Leaderboard, Achievements, Daily Challenges, Friends, Messaging, Rules, Lore, Tutorial, Live Matches, Season Pass, Pack Opening, Admin Tools, and more`);
  bullet("Real-time multiplayer via WebSocket with reconnection handling");
  bullet("AI opponents (Easy/Medium/Hard) powered by a server-side game engine");
  bullet("Stripe and PayPal payment processing (currently in beta mode)");
  bullet("Admin dashboards for card art management, user management, and image database");
  bullet("Google Gemini AI-powered deck suggestions");
  doc.moveDown(0.3);

  subSection("Mobile Application \u2014 Functional in Expo Go");
  body("The React Native / Expo mobile app includes:");
  bullet(`${METRICS.mobileScreens} screens across 5 tab sections (Home, Cards, Decks, Social, More)`);
  bullet("Full card browsing with element-themed card frames and static artwork");
  bullet("Deck management \u2014 create, edit, delete, import/export via share codes");
  bullet("Practice battles against AI with the same game engine as web");
  bullet("PvP multiplayer game board with real-time WebSocket sync");
  bullet("Social features \u2014 friends list, friend requests, direct messaging");
  bullet("Player profile, match history, analytics, achievements, daily challenges");
  bullet("Game rules, lore archives, interactive tutorial");
  bullet("JWT-based authentication with secure token storage");
  doc.moveDown(0.3);

  subSection("Remaining Mobile Work");
  body("The mobile app is approximately 80\u201385% complete. Remaining items:");
  bullet("In-app purchase integration (Apple IAP + Google Play Billing)");
  bullet("Push notification system");
  bullet("App Store / Google Play submission and review process");
  bullet("AI-generated professional card artwork integration");
  bullet("Performance optimization and final QA pass");

  sectionTitle("4. The Prototype Advantage \u2014 Why Backers Should Be Excited");

  subSection("A Playable Game, Not Just a Promise");
  body(
    "Most crowdfunding campaigns for video games and card games launch with nothing more than concept art, a trailer, and a vision. Backers are asked to fund a dream \u2014 with no guarantee the team can deliver. The history of gaming Kickstarters is littered with failed projects that took millions in funding and never shipped a playable product."
  );
  body(
    "Wisdom & Chance TCG is fundamentally different. The game is already built and playable \u2014 right now. Backers don\u2019t have to imagine what the game might look like; they can open a browser, visit wisdom-and-chance-2.replit.app, and play it today. They can build decks, battle AI opponents, challenge friends in real-time multiplayer, earn achievements, and experience the full gameplay loop."
  );
  body(
    "This is not a prototype in the traditional sense of a rough mockup \u2014 it\u2019s a functional, feature-complete application with 29 web pages, 27 mobile screens, real-time multiplayer, a server-side game engine, payment processing, social features, and a complete economy system."
  );

  subSection("What This Prototype Would Normally Cost");
  body("To appreciate the value that already exists, consider what it would cost to build this from scratch using traditional methods:");
  let y = doc.y + 5;
  const ptw = [260, 220];
  y = tableRow(["Development Approach", "Estimated Cost"], y, ptw, true);
  const protoCosts = [
    ["Traditional studio (4\u20136 engineers \u00D7 12 months)", "$320,000\u2013$900,000"],
    ["Freelance team (3\u20134 devs \u00D7 12 months)", "$150,000\u2013$300,000"],
    ["Offshore development team", "$80,000\u2013$150,000"],
    ["Single senior developer (12 months)", "$100,000\u2013$180,000"],
    ["Actual cost (Replit AI-assisted, 1 person)", "~$400"],
  ];
  for (const row of protoCosts) {
    y = tableRow(row, y, ptw);
  }
  doc.y = y + 10;
  body("The ~$400 actual cost represents approximately 12\u201318 months of Replit subscription fees ($20/month). The cost savings compared to even the cheapest traditional approach is over 99.7%. This is the power of AI-assisted development: one person with the right tools can produce what previously required a team and six figures of investment.");

  subSection("What \u201CPlayable Now\u201D Means for Backers");
  body("Having a functional prototype dramatically reduces backer risk and increases campaign credibility:");
  bullet("Zero delivery risk \u2014 The game exists and works. Backers aren\u2019t funding a concept; they\u2019re funding the growth of a working product");
  bullet("Try before you pledge \u2014 Any potential backer can play the game for free on the web before deciding to support");
  bullet("Proven technical capability \u2014 The founder has already demonstrated the ability to build and ship a complex product");
  bullet("Transparent development \u2014 The codebase, the live site, and the mobile app are all visible proof of progress");
  bullet("Immediate beta access \u2014 Backers who pledge $10+ receive a one-time passcode for instant beta access to the full game");
  doc.moveDown(0.3);

  subSection("The $400 Prototype vs. The Industry Standard");
  body(
    "In the gaming industry, a \u201Cprototype\u201D typically refers to a rough vertical slice that demonstrates core mechanics \u2014 usually costing $50,000\u2013$200,000 and taking 3\u20136 months to build. Wisdom & Chance has gone far beyond a prototype: it\u2019s a near-complete product with multiplayer, social features, economy, payments, and both web and mobile versions. All built for roughly the price of a nice dinner out."
  );
  body(
    "This extreme capital efficiency is what makes the Legraphics Gaming Division\u2019s approach so compelling for investors and backers: the hardest part \u2014 building the product \u2014 is already done. Funding now goes toward art, polish, marketing, and growth, not toward hoping a team can write the code."
  );

  sectionTitle("5. Market Analysis");

  subSection("Digital TCG Market Size");
  body(
    "The global digital trading card game market was valued at approximately $8.9 billion in 2024 and is projected to reach $15.2 billion by 2029, growing at a CAGR of 11.3%. Key drivers include mobile gaming growth, the rise of competitive esports, and increasing digital collectible adoption."
  );

  subSection("Competitive Landscape");
  body("Major competitors include:");
  bullet("Hearthstone (Blizzard) \u2014 Established leader, 30M+ monthly players");
  bullet("Magic: The Gathering Arena \u2014 Premium brand, complex mechanics");
  bullet("Yu-Gi-Oh! Master Duel \u2014 Massive IP, 50M+ downloads");
  bullet("Pok\u00e9mon TCG Live \u2014 Brand power, younger demographic");
  bullet("Marvel Snap \u2014 Fast gameplay, 20M+ downloads in first year");
  doc.moveDown(0.3);

  subSection("Wisdom & Chance Differentiation");
  body("Wisdom & Chance TCG differentiates through:");
  bullet("Simultaneous play \u2014 Both players act each phase, eliminating passive waiting");
  bullet("Elemental buff/debuff system \u2014 Cards interact across elements for strategic depth");
  bullet("Commander abilities \u2014 Unique strategic abilities that create asymmetric gameplay");
  bullet("Accessible complexity \u2014 Easy to learn (deploy and compare power) but deep strategy");
  bullet("Cross-platform play \u2014 Web and mobile players share the same game world");
  bullet("Solo-developed indie story \u2014 Compelling narrative for community building");
  bullet("Extreme capital efficiency \u2014 Near-zero operating costs enable aggressive pricing and long-term sustainability");

  subSection("Target Audience");
  bullet("Primary: TCG players aged 18\u201335 who enjoy strategic depth without excessive complexity");
  bullet("Secondary: Mobile gamers looking for quick competitive matches (5\u201310 minutes)");
  bullet("Tertiary: Content creators and streamers in the indie game space");

  sectionTitle("6. Competitive Analysis \u2014 Hearthstone Case Study");

  body(
    "Hearthstone, developed by Blizzard Entertainment, is the most commercially successful digital TCG in history. Analyzing its cost structure and profitability provides valuable context for understanding Wisdom & Chance\u2019s positioning and potential."
  );

  subSection("Hearthstone Development & Operating Costs");

  y = doc.y + 5;
  const hw = [260, 220];
  y = tableRow(["Metric", "Hearthstone (Estimated)"], y, hw, true);
  const hsData = [
    ["Initial Development Cost", "$30\u2013$50 million"],
    ["Development Time", "~5 years (2008\u20132014 launch)"],
    ["Peak Team Size", "100\u2013150 developers, artists, designers"],
    ["Annual Operating Cost (est.)", "$15\u2013$20 million/year"],
    ["Peak Annual Revenue (2017)", "$~500 million"],
    ["Recent Annual Revenue (2023\u201325)", "$200\u2013$300 million"],
    ["Lifetime Revenue (est.)", "$2.5\u2013$3.5 billion"],
    ["Profit Margin (est.)", "60\u201375% at peak"],
    ["Cost Per Card Created", "$50,000\u2013$100,000+ (art, design, balance, QA)"],
    ["Monthly Server/Infrastructure", "$500,000\u2013$1,000,000+"],
  ];
  for (const row of hsData) {
    y = tableRow(row, y, hw);
  }
  doc.y = y + 10;

  body("Sources: Blizzard/Activision annual reports, industry analyst estimates (SuperData, Newzoo), public developer interviews.");

  subSection("Wisdom & Chance vs. Hearthstone \u2014 Cost Comparison");
  y = doc.y + 5;
  const cmpW = [160, 160, 160];
  y = tableRow(["Metric", "Hearthstone", "Wisdom & Chance"], y, cmpW, true);
  const compData = [
    ["Development Cost", "$30\u2013$50 million", "~$300 (Replit sub)"],
    ["Development Time", "5+ years", "~12 months"],
    ["Team Size", "100\u2013150 people", "1 person"],
    ["Monthly Operating Cost", "$1.2\u2013$1.7 million", "~$4,230 (incl. salary)"],
    ["Cost Per Card", "$50,000\u2013$100,000+", "~$0.50 (AI generation)"],
    ["Infrastructure", "Custom data centers", "Replit managed hosting"],
    ["Break-even Users Needed", "~500,000+ MAU", "~500\u2013550 paying users"],
    ["Profit at 1,000 Payers", "Still losing money", "$4,000\u2013$6,000/month"],
  ];
  for (const row of compData) {
    y = tableRow(row, y, cmpW);
  }
  doc.y = y + 10;

  subSection("Key Takeaway");
  body(
    "Hearthstone needed approximately $30\u2013$50 million in development costs and 500,000+ monthly active users before it became profitable. Wisdom & Chance, with monthly costs of ~$4,230 (including the founder\u2019s $50,000/year salary), can achieve profitability with approximately 500\u2013550 paying users. This 1,000x difference in cost structure means that even capturing a tiny fraction of Hearthstone\u2019s market would generate substantial profit."
  );

  body(
    "While Hearthstone benefits from Blizzard\u2019s massive brand, IP library, and marketing budget, Wisdom & Chance benefits from a single compensated founder, AI-multiplied productivity, and a burn rate lower than most studios\u2019 monthly coffee budget. In a worst-case scenario where user growth is slow, the project continues at minimal cost until traction builds \u2014 an option unavailable to any venture-funded competitor."
  );

  sectionTitle("7. Revenue Model & Product Catalog");

  subSection("Web Revenue Streams (Stripe + PayPal)");
  body("The shop uses a simple, transparent quantity-based pricing model. Instead of preset bundles, players select how many packs they want and the price scales linearly \u2014 no hidden markups, no confusing tiers:");
  doc.moveDown(0.3);

  subSection("Card Pack Pricing \u2014 Quantity Selector Model");
  body("Base unit: 1 Pack = 5 random cards from the current set. Price: $2.00 USD or 200 Gold.");
  body("Players choose their quantity and the total updates automatically:");
  y = doc.y + 5;
  const pw = [120, 100, 100, 160];
  y = tableRow(["Quantity", "USD Price", "Gold Price", "Cards Received"], y, pw, true);
  const packPricing = [
    ["1 Pack", "$2.00", "200 Gold", "5 cards"],
    ["2 Packs", "$4.00", "400 Gold", "10 cards"],
    ["3 Packs", "$6.00", "600 Gold", "15 cards"],
    ["5 Packs", "$10.00", "1,000 Gold", "25 cards"],
    ["10 Packs", "$20.00", "2,000 Gold", "50 cards"],
    ["25 Packs", "$50.00", "5,000 Gold", "125 cards"],
  ];
  for (const row of packPricing) {
    y = tableRow(row, y, pw);
  }
  doc.y = y + 10;
  body("Formula: Total = Quantity \u00D7 $2.00 (or Quantity \u00D7 200 Gold). No bulk discounts \u2014 every pack costs the same whether you buy 1 or 100. This keeps pricing fair, simple, and easy to understand for all players.");

  subSection("In-Game Gold Currency");
  body("Gold can be earned through gameplay (daily challenges, achievements, wins) or purchased directly:");
  y = doc.y + 5;
  const gw = [200, 100, 180];
  y = tableRow(["Gold Amount", "USD Price", "Pack Equivalent"], y, gw, true);
  const goldPricing = [
    ["200 Gold", "$2.00", "1 Pack"],
    ["500 Gold", "$5.00", "2.5 Packs"],
    ["1,000 Gold", "$10.00", "5 Packs"],
    ["2,000 Gold", "$20.00", "10 Packs"],
    ["5,000 Gold", "$50.00", "25 Packs"],
  ];
  for (const row of goldPricing) {
    y = tableRow(row, y, gw);
  }
  doc.y = y + 10;
  body("Gold maintains a fixed 1:1 exchange rate with USD ($1 = 100 Gold). Players can use gold to buy packs, cosmetics, and tournament entry fees.");

  subSection("Additional Shop Products");
  y = doc.y + 5;
  const aw = [240, 120, 120];
  y = tableRow(["Product", "Price", "Category"], y, aw, true);
  const additionalProducts = [
    ["Season Pass", "$9.99/season", "Subscription"],
    ["Battle Pass Premium", "$14.99/season", "Subscription"],
    ["Cosmetic Card Backs", "$2.99 each", "Cosmetic"],
  ];
  for (const row of additionalProducts) {
    y = tableRow(row, y, aw);
  }
  doc.y = y + 10;

  subSection("Mobile Revenue Streams (Planned)");
  body("Mobile in-app purchases will mirror the web catalog with platform-specific considerations:");
  bullet("Apple App Store \u2014 30% commission on all transactions (15% for small business program if eligible)");
  bullet("Google Play \u2014 15% commission on first $1M, then 30%");
  bullet("Pricing may be adjusted upward on mobile to account for platform fees");
  bullet("Subscription products (Season Pass, Battle Pass) will use platform-native recurring billing");

  subSection("Revenue Model Summary");
  body("Revenue comes from four primary channels:");
  bullet("Card pack sales \u2014 $2/pack with quantity selector; players buy as many as they want");
  bullet("In-game currency \u2014 Gold purchased with USD or earned through gameplay, used for packs, cosmetics, and entry fees");
  bullet("Season/Battle Pass \u2014 Recurring seasonal subscriptions with exclusive rewards");
  bullet("Cosmetic items \u2014 Card backs, board themes, and visual customizations");

  sectionTitle("8. Cost Analysis \u2014 Solo Operator Model");

  subSection("Development Value Already Created");
  body("The following represents work already completed, demonstrating extreme capital efficiency:");
  doc.moveDown(0.3);
  y = doc.y;
  const cw = [280, 200];
  y = tableRow(["Item", "Equivalent Market Value"], y, cw, true);
  const devCosts = [
    [`Server-side development (${METRICS.serverLOC.toLocaleString()} lines)`, "$35,000\u2013$50,000"],
    [`Web client development (${METRICS.clientLOC.toLocaleString()} lines)`, "$40,000\u2013$55,000"],
    [`Mobile app development (${METRICS.mobileLOC.toLocaleString()} lines)`, "$30,000\u2013$45,000"],
    ["Game engine & combat system", "$15,000\u2013$20,000"],
    ["WebSocket multiplayer system", "$10,000\u2013$15,000"],
    ["Payment integration (Stripe + PayPal)", "$5,000\u2013$8,000"],
    [`Database schema & API design (${METRICS.totalEndpoints} endpoints)`, "$12,000\u2013$18,000"],
    ["Total equivalent development value", "$147,000\u2013$211,000"],
  ];
  for (const row of devCosts) {
    y = tableRow(row, y, cw);
  }
  doc.y = y + 10;
  body("All of this was built by a single founder on Replit. Actual out-of-pocket development cost: approximately $300 in Replit subscription fees over 12 months.");

  subSection("Ongoing Monthly Costs \u2014 Primary: Founder Compensation");
  body("The founder draws a salary of $50,000 per year ($4,167/month) as the sole operator of the business. This covers all development, design, marketing, operations, and business management:");
  y = doc.y + 5;
  const mw = [300, 180];
  y = tableRow(["Compensation", "Monthly Cost"], y, mw, true);
  const salaryCosts = [
    ["Founder Salary (full-time, 40+ hrs/week)", "$4,167/month"],
    ["Total Founder Compensation", "$4,167/month"],
  ];
  for (const row of salaryCosts) {
    y = tableRow(row, y, mw);
  }
  doc.y = y + 10;
  body("This salary is below market rate for a single full-stack developer ($80K\u2013$150K/year), let alone a combined developer + designer + product manager + marketer role. It reflects the founder\u2019s commitment to keeping costs lean while ensuring personal sustainability.");

  subSection("Ongoing Monthly Costs \u2014 Secondary: Replit Platform (40 hrs/week usage)");
  body("The founder uses Replit as the complete development, AI, and hosting platform, averaging 40+ hours per week of active development with AI Agent assistance. Replit\u2019s $20/month plan provides AI Agent access, cloud development environments, and deployment infrastructure:");
  y = doc.y + 5;
  y = tableRow(["Replit Expense", "Monthly Cost"], y, mw, true);
  const replitCosts = [
    ["Replit Subscription ($20/mo plan w/ AI Agent)", "$20/month"],
    ["Replit Deployments (production hosting)", "$7\u2013$20/month"],
    ["PostgreSQL Database Hosting", "Included in plan"],
    ["AI Agent Compute (~160 hrs/month)", "Included in plan"],
    ["Total Replit Costs", "$27\u2013$40/month"],
  ];
  for (const row of replitCosts) {
    y = tableRow(row, y, mw);
  }
  doc.y = y + 10;

  subSection("Weekly Replit Cost Breakdown");
  body("At 40 hours per week of development, here is the effective weekly cost of operating the entire tech stack:");
  y = doc.y + 5;
  const ww = [300, 180];
  y = tableRow(["Weekly Expense", "Cost/Week"], y, ww, true);
  const weeklyCosts = [
    ["Replit Subscription ($20/mo \u00F7 4.33 weeks)", "$4.62/week"],
    ["Replit Deployments ($7\u2013$20/mo \u00F7 4.33)", "$1.62\u2013$4.62/week"],
    ["AI Agent Usage (40 hrs @ $0/hr additional)", "$0 (included)"],
    ["Total Weekly Replit Cost", "$6.24\u2013$9.24/week"],
    ["Effective Cost Per Dev Hour", "$0.16\u2013$0.23/hour"],
  ];
  for (const row of weeklyCosts) {
    y = tableRow(row, y, ww);
  }
  doc.y = y + 10;
  body("For context: a single freelance developer costs $50\u2013$150/hour. At 40 hours/week, that would be $2,000\u2013$6,000/week. The founder\u2019s entire weekly Replit cost ($6\u2013$9) is less than the price of a single lunch.");

  subSection("AI Agent Work Hours \u2014 Value Estimate");
  body("The Replit AI Agent acts as a virtual engineering team, providing code generation, debugging, refactoring, and deployment assistance. Here is the estimated market value of the AI compute consumed:");
  y = doc.y + 5;
  y = tableRow(["AI Agent Metric", "Value"], y, ww, true);
  const aiValue = [
    ["Weekly AI-assisted dev hours", "40 hours"],
    ["Monthly AI-assisted dev hours", "~160 hours"],
    ["Annual AI-assisted dev hours", "~2,080 hours"],
    ["Market rate for equivalent dev work", "$50\u2013$150/hour"],
    ["Monthly value of AI output", "$8,000\u2013$24,000"],
    ["Annual value of AI output", "$104,000\u2013$312,000"],
    ["Actual monthly cost for AI access", "$20 (subscription)"],
    ["Cost savings vs. hiring equivalent", "99.75\u201399.92%"],
  ];
  for (const row of aiValue) {
    y = tableRow(row, y, ww);
  }
  doc.y = y + 10;
  body("This is the core economic advantage of the solo operator model: the founder leverages AI to produce output equivalent to a small engineering team, at a fraction of one percent of the cost.");

  subSection("Server Scaling Costs \u2014 Projected Replit Deployment Costs by User Traffic");
  body("As the game attracts more players, server costs through Replit Deployments will increase based on compute usage, database connections, and WebSocket traffic. Estimated scaling costs:");
  y = doc.y + 5;
  const scw = [120, 120, 120, 120];
  y = tableRow(["Monthly Active Users", "Est. Server Cost", "DB Cost", "Total Hosting"], y, scw, true);
  const scalingCosts = [
    ["100\u2013500 MAU", "$7\u2013$10/mo", "Included", "$7\u2013$10/mo"],
    ["500\u20131,000 MAU", "$10\u2013$15/mo", "Included", "$10\u2013$15/mo"],
    ["1,000\u20135,000 MAU", "$15\u2013$30/mo", "Included", "$15\u2013$30/mo"],
    ["5,000\u201310,000 MAU", "$30\u2013$60/mo", "$0\u2013$10/mo", "$30\u2013$70/mo"],
    ["10,000\u201320,000 MAU", "$60\u2013$120/mo", "$10\u2013$25/mo", "$70\u2013$145/mo"],
    ["20,000\u201350,000 MAU", "$120\u2013$250/mo", "$25\u2013$50/mo", "$145\u2013$300/mo"],
  ];
  for (const row of scalingCosts) {
    y = tableRow(row, y, scw);
  }
  doc.y = y + 10;
  body("Even at 50,000 monthly active users, estimated hosting costs remain under $300/month \u2014 compared to $500,000\u2013$1,000,000+/month for Hearthstone\u2019s custom infrastructure. Replit\u2019s auto-scaling deployment model means costs grow linearly with usage rather than requiring large upfront infrastructure investment.");
  body("Important: These server costs scale with revenue. At 20,000 MAU with 6% conversion and $20 average revenue per payer, monthly revenue would be ~$24,000 against ~$145 in hosting costs \u2014 a hosting cost ratio under 0.6%.");

  subSection("Ongoing Costs \u2014 Platform & Transaction Fees");
  body("These costs are variable and only apply when revenue is generated \u2014 they scale proportionally with income:");
  y = doc.y + 5;
  y = tableRow(["Platform", "Fee Structure"], y, mw, true);
  const platformFees = [
    ["Stripe (web payments)", "2.9% + $0.30 per transaction"],
    ["PayPal (web payments)", "2.9% + $0.30 per transaction"],
    ["Apple App Store (mobile)", "30% commission (15% if <$1M/year)"],
    ["Google Play Store (mobile)", "15% on first $1M, then 30%"],
    ["State/Federal Business Taxes", "Varies by jurisdiction"],
  ];
  for (const row of platformFees) {
    y = tableRow(row, y, mw);
  }
  doc.y = y + 10;
  body("At projected Year 1 revenue levels (~$25,000), total platform fees would be approximately $2,500\u2013$5,000 depending on the channel mix between web (lower fees) and mobile (higher fees).");

  subSection("Ongoing Costs \u2014 Additional Services");
  y = doc.y + 5;
  y = tableRow(["Service", "Cost"], y, mw, true);
  const tertiaryCosts = [
    ["AI Image Generation (card art)", "$5\u2013$20/month"],
    ["Domain Registration (via Replit)", "~$12/year (~$1/month)"],
    ["Apple Developer Account", "$99/year (~$8.25/month)"],
    ["Google Play Developer Account", "$25 one-time"],
    ["Total Tertiary Costs", "~$15\u2013$30/month"],
  ];
  for (const row of tertiaryCosts) {
    y = tableRow(row, y, mw);
  }
  doc.y = y + 10;

  subSection("Total Monthly Operating Cost Summary");
  y = doc.y + 5;
  const sw = [300, 180];
  y = tableRow(["Category", "Monthly Cost"], y, sw, true);
  const totalCosts = [
    ["Founder Salary ($50,000/year)", "$4,167"],
    ["Replit Platform (40 hrs/week usage)", "$27\u2013$40"],
    ["AI Image Generation + Domain + Dev Accounts", "$15\u2013$30"],
    ["Platform/Transaction Fees (variable)", "$0\u2013varies with revenue"],
    ["Office/Equipment", "$0 (works from home)"],
    ["Total Fixed Monthly Costs", "$4,209\u2013$4,237"],
  ];
  for (const row of totalCosts) {
    y = tableRow(row, y, sw);
  }
  doc.y = y + 10;

  body(
    "Total annual fixed operating cost: ~$50,508\u2013$50,844/year. Compare this to the v5.0 business plan which excluded founder compensation entirely and still projected $2,100\u2013$4,100/month with a hired creative team. The solo operator model with fair founder compensation still costs less per month than a single junior developer\u2019s salary at a traditional studio."
  );

  sectionTitle("9. Marketing & Growth Strategy");

  subSection("Pre-Launch (Current Phase)");
  bullet("Build social media presence \u2014 Twitter/X, TikTok, Instagram, Reddit (r/cardgames, r/tcg)");
  bullet("Content marketing \u2014 Dev logs, behind-the-scenes videos, card reveal campaigns");
  bullet("Community building \u2014 Discord server for early testers and feedback");
  bullet("Influencer outreach \u2014 TCG content creators on YouTube and Twitch");
  bullet("Press coverage \u2014 Indie game publications, Replit community showcase");
  bullet("\"Solo developer built a full TCG\" narrative \u2014 compelling story for press and social media");
  doc.moveDown(0.5);

  subSection("Launch Phase");
  bullet("App Store Optimization (ASO) \u2014 Keyword research, screenshot optimization, localized descriptions");
  bullet("Launch trailer \u2014 Created using AI video tools and gameplay capture");
  bullet("Cross-promotion \u2014 Web players invited to download mobile; mobile players directed to web for full experience");
  bullet("Crowdfunding backer exclusive content \u2014 Early access, exclusive card backs, founder badges");
  bullet("Referral program \u2014 Invite friends, earn in-game currency");
  doc.moveDown(0.5);

  subSection("Post-Launch Growth");
  bullet("Competitive seasons \u2014 Monthly/quarterly ranked seasons with leaderboard prizes");
  bullet("Tournament system \u2014 Community-organized and official tournaments");
  bullet("Content updates \u2014 New cards, commanders, and seasonal events");
  bullet("Streamer partnerships \u2014 Sponsored streams and tournament coverage");
  bullet("Localization \u2014 Translate to Spanish, Portuguese, French, German, Japanese for global reach");

  sectionTitle("10. Crowdfunding Campaign Strategy \u2014 Kickstarter + BackerKit");

  subSection("Platform Strategy: Kickstarter First, BackerKit After");
  body("The crowdfunding strategy uses a two-phase approach to maximize funding and ongoing revenue:");
  bullet("Phase 1 \u2014 Kickstarter Campaign (30 days): Primary fundraising on Kickstarter, the largest platform for game projects with the most engaged backer community");
  bullet("Phase 2 \u2014 BackerKit (ongoing after campaign): Late pledges, add-on purchases, backer surveys, and a permanent pre-order store that keeps revenue flowing after the Kickstarter ends");
  doc.moveDown(0.3);
  body("BackerKit extends the funding window indefinitely. Many successful game Kickstarters generate 15\u201325% additional revenue through BackerKit late pledges after the main campaign closes. This is especially powerful for Wisdom & Chance because the game is already playable \u2014 late backers can try the game and pledge with confidence.");

  subSection("Campaign Goal");
  body("Base goal: $25,000 \u2014 Covers 6 months of founder salary, app store fees, marketing launch, and AI image generation for all 100 cards + 5 commanders in the first set.");
  body("Stretch goals up to $50,000 \u2014 12 months founder salary runway, expanded marketing, tournament prize pool, localization, and head start on Set 2 development.");
  body("Note: Even with the founder\u2019s $50,000/year salary included, this crowdfunding goal is still dramatically lower than traditional game projects (which typically seek $100K\u2013$500K+). This makes the campaign far more likely to succeed and reduces backer risk.");

  subSection("Beta Access \u2014 $10+ Pledge Unlock");
  body("All backers who pledge $10 or more receive immediate beta access to the full game on both web and mobile. This is a major differentiator \u2014 backers don\u2019t have to wait months or years to play; they get access right away.");
  doc.moveDown(0.3);
  body("Beta Access Verification Flow:");
  bullet("1. Backer pledges $10+ on Kickstarter (or BackerKit late pledge)");
  bullet("2. After pledge is confirmed, the system generates a unique one-time passcode");
  bullet("3. Passcode is emailed to the backer with instructions");
  bullet("4. Backer enters the passcode in the game (web or mobile) to verify their pledge");
  bullet("5. Account is permanently flagged as a Beta Backer with full access");
  doc.moveDown(0.3);
  body("This passcode system is simple, secure, and scalable. Each code is single-use and tied to the backer\u2019s email, preventing sharing or abuse. Beta Backers also receive a unique in-game badge and card back as a permanent mark of their early support.");

  subSection("Reward Tiers");
  y = doc.y + 5;
  const rw = [100, 240, 140];
  y = tableRow(["Tier", "Reward", "Price"], y, rw, true);
  const tiers = [
    ["Supporter", "Name in credits, digital thank-you card", "$5"],
    ["Beta Backer", "Beta access + 2 packs ($4 value) + beta badge", "$10"],
    ["Player", "Beta access + 5 packs ($10 value) + exclusive card back", "$15"],
    ["Champion", "Beta access + 15 packs ($30) + Season Pass + founder badge", "$40"],
    ["Commander", "Beta access + 25 packs ($50) + Battle Pass + Commander skin", "$65"],
    ["Legend", "Beta access + 50 packs ($100) + all passes + name a card + VIP", "$125"],
    ["Patron", "Everything above + 1-hour strategy call + custom card design", "$250"],
  ];
  for (const row of tiers) {
    y = tableRow(row, y, rw);
  }
  doc.y = y + 10;
  body("All tiers at $10 and above include beta access via one-time passcode. The Beta Backer tier is specifically designed as the entry point for players who want to play immediately at the lowest cost.");

  subSection("Campaign Timeline");
  body("Pre-campaign (4\u20136 weeks):");
  bullet("Social media buildup across Twitter/X, TikTok, Instagram, Reddit");
  bullet("Email list collection via landing page with early-bird signup incentives");
  bullet("Press outreach to indie game publications and TCG community influencers");
  bullet("Demo video showing live gameplay on web and mobile");
  doc.moveDown(0.3);
  body("Kickstarter Campaign (30 days):");
  bullet("Launch with live gameplay demo \u2014 \u201Cplay the game right now\u201D as the headline");
  bullet("Daily/weekly updates with development progress, card reveals, and community highlights");
  bullet("Stretch goal reveals at key funding milestones to maintain momentum");
  bullet("Cross-promotion between web game and campaign page");
  doc.moveDown(0.3);
  body("Post-Campaign \u2014 BackerKit (ongoing):");
  bullet("Transition all backers to BackerKit for surveys, add-on purchases, and fulfillment");
  bullet("Open BackerKit pre-order store for late pledges \u2014 same tiers as Kickstarter");
  bullet("Late backers also receive beta access upon $10+ pledge confirmation");
  bullet("Add-on items: extra packs, cosmetic bundles, Season Pass upgrades");
  bullet("BackerKit store remains open indefinitely, providing a continuous revenue stream");
  doc.moveDown(0.3);
  body("Post-campaign fulfillment within 60 days of campaign close. Beta access passcodes are delivered immediately upon pledge confirmation, not at fulfillment.");

  sectionTitle("11. Development Roadmap");

  subSection("Phase 1: Completed (Q1 2025 \u2013 Q1 2026)");
  bullet("Core game engine with 5 elements, 50 cards built so far (of 100 planned for Set 1), 5 commanders");
  bullet("Full web application with 29 pages and complete gameplay loop");
  bullet("Server-side multiplayer game engine with WebSocket real-time sync");
  bullet("AI opponents (Easy/Medium/Hard difficulty)");
  bullet("Social system (friends, messaging, leaderboards, achievements)");
  bullet("Payment integration (Stripe + PayPal) on web");
  bullet(`Mobile app (React Native/Expo) with ${METRICS.mobileScreens} screens \u2014 functional in Expo Go`);
  bullet("Unified monorepo architecture sharing one server and database");
  doc.moveDown(0.5);

  subSection("Phase 2: Complete Set 1 & App Store Launch (Q2\u2013Q3 2026)");
  bullet("Complete remaining 50 cards to finish Set 1 (100 total cards + 5 Commanders)");
  bullet("Generate professional card artwork using AI image generation tools for all 105 cards");
  bullet("Integrate Apple IAP and Google Play Billing in mobile app");
  bullet("Push notification system for mobile");
  bullet("Final QA pass and performance optimization");
  bullet("Apple App Store and Google Play submission");
  bullet("Launch crowdfunding campaign");
  doc.moveDown(0.5);

  subSection("Phase 3: Growth & Season 1 (Q3\u2013Q4 2026)");
  bullet("Season 1 launch with ranked play, seasonal rewards, and battle pass");
  bullet("Tournament system \u2014 in-game organized competitive play");
  bullet("Social features expansion \u2014 guilds/clans, spectator mode improvements");
  bullet("Content creator program \u2014 streamer tools and referral integration");
  bullet("Begin development of Set 2 (100 new cards, targeting Q1 2027 release)");
  doc.moveDown(0.5);

  subSection("Phase 4: Set 2 Launch & Expansion (Q1\u2013Q2 2027)");
  bullet("Release Set 2 \u2014 100 new cards with new mechanics and strategies");
  bullet("New element or card mechanics (e.g., dual-element cards)");
  bullet("Localization \u2014 5+ languages");
  bullet("Draft/Arena game mode");
  bullet("Physical merchandise tie-ins (optional, dependent on revenue)");
  bullet("Esports integration \u2014 sponsored tournaments with prize pools");
  doc.moveDown(0.5);

  subSection("Card Set Release Schedule");
  body("New 100-card sets will be released every 6 months following this cadence:");
  bullet("Set 1 (Launch): 100 cards + 5 Commanders \u2014 Q2/Q3 2026");
  bullet("Set 2: 100 new cards \u2014 Q1 2027");
  bullet("Set 3: 100 new cards \u2014 Q3 2027");
  body("Set release frequency will be re-evaluated in late 2027 based on player engagement data, revenue trends, and community feedback. The cadence may increase, decrease, or shift to smaller/larger sets depending on what the data shows.");

  sectionTitle("12. Financial Projections");

  body("Conservative projections assume gradual user acquisition post-launch with the solo operator cost structure including $50,000/year founder salary. All figures are in USD. Monthly fixed costs are ~$4,230 ($4,167 salary + ~$63 Replit/services). Pack pricing is $2/pack with an average of 3\u20135 packs per purchase.");
  doc.moveDown(0.3);
  body("Average Revenue Per Paying User (ARPPU) derivation: At $2/pack, a payer buying 4\u20135 packs/month spends $8\u2013$10. With Season Pass ($9.99) and cosmetic purchases factored in, ARPPU grows from ~$8 in Q1 to ~$15 by Q4 Year 1 as engaged players increase spending. Year 2 ARPPU rises further ($15\u2013$22) as new card sets drive repeat purchases and the Battle Pass adds a second subscription tier.");
  doc.moveDown(0.3);

  subSection("Year 1 Post-Launch Quarterly Projections");
  y = doc.y + 5;
  const fw = [96, 96, 96, 96, 96];
  y = tableRow(["Metric", "Q1", "Q2", "Q3", "Q4"], y, fw, true);
  const yr1 = [
    ["Monthly Active Users", "500", "1,500", "3,000", "5,000"],
    ["Paying Users (5%)", "25", "75", "150", "250"],
    ["Avg Revenue/Payer", "$8", "$10", "$12", "$15"],
    ["Quarterly Revenue", "$600", "$2,250", "$5,400", "$11,250"],
    ["Fixed Costs (3 mo)", "$12,690", "$12,690", "$12,690", "$12,690"],
    ["Platform Fees (~15%)", "$90", "$338", "$810", "$1,688"],
    ["Total Costs", "$12,780", "$13,028", "$13,500", "$14,378"],
    ["Net Income", "-$12,180", "-$10,778", "-$8,100", "-$3,128"],
  ];
  for (const row of yr1) {
    y = tableRow(row, y, fw);
  }
  doc.y = y + 10;

  body("Year 1 total projected revenue: ~$19,500. Year 1 total costs: ~$53,686. Net: -$34,186.");
  body("The project operates at a loss in Year 1 as user base grows, but costs are entirely predictable and sustainable. The founder\u2019s salary ensures personal financial stability while building the business. Note that losses narrow each quarter as revenue grows.");
  doc.moveDown(0.3);

  subSection("Year 2 Projections (Growth Phase)");
  y = doc.y + 5;
  y = tableRow(["Metric", "Q1", "Q2", "Q3", "Q4"], y, fw, true);
  const yr2 = [
    ["Monthly Active Users", "7,000", "10,000", "15,000", "20,000"],
    ["Paying Users (6%)", "420", "600", "900", "1,200"],
    ["Avg Revenue/Payer", "$15", "$18", "$20", "$22"],
    ["Quarterly Revenue", "$18,900", "$32,400", "$54,000", "$79,200"],
    ["Fixed Costs (3 mo)", "$12,690", "$12,690", "$12,690", "$12,690"],
    ["Platform Fees (~18%)", "$3,402", "$5,832", "$9,720", "$14,256"],
    ["Total Costs", "$16,092", "$18,522", "$22,410", "$26,946"],
    ["Net Income", "+$2,808", "+$13,878", "+$31,590", "+$52,254"],
  ];
  for (const row of yr2) {
    y = tableRow(row, y, fw);
  }
  doc.y = y + 10;
  body("Year 2 total projected revenue: ~$184,500. Year 2 total costs: ~$83,970. Net profit: +$100,530.");
  body("Break-even occurs in Q1 of Year 2. By Q4, the project generates $52,254 quarterly profit \u2014 more than covering the founder\u2019s annual salary in a single quarter.");

  subSection("Profitability Threshold Analysis");
  body("With monthly fixed costs of ~$4,230 (including founder salary) and average revenue per payer of $10:");
  bullet("Break-even: ~500 paying users per month (after ~15% platform fees)");
  bullet("$1,000/month profit above salary: ~620 paying users");
  bullet("$5,000/month profit above salary: ~1,090 paying users");
  bullet("$10,000/month profit above salary: ~1,680 paying users");
  doc.moveDown(0.3);
  body("For comparison, Hearthstone needed an estimated 500,000+ monthly active users and $15\u2013$20M/year in operating costs. Wisdom & Chance needs approximately 500 paying users to fully cover the founder\u2019s salary, Replit costs, and all platform fees.");

  sectionTitle("13. Funding Requirements & Use of Funds");

  subSection("Total Funding Sought: $25,000 \u2013 $50,000");
  body("Funding covers the founder\u2019s salary runway during the critical growth phase, plus marketing and launch costs. Even with founder compensation included, the high end ($50,000) is comparable to v5.0\u2019s low end ($45,000), while providing significantly more runway due to the elimination of all other team costs.");
  doc.moveDown(0.3);

  y = doc.y;
  const uw = [240, 120, 120];
  y = tableRow(["Use of Funds", "Minimum", "Maximum"], y, uw, true);
  const funds = [
    ["Founder Salary Runway (6\u201312 months)", "$12,500", "$25,000"],
    ["Marketing & User Acquisition", "$5,000", "$10,000"],
    ["AI Card Art Generation (100 cards + 5 commanders)", "$400", "$1,000"],
    ["App Store Submission Fees", "$125", "$125"],
    ["Crowdfunding Campaign Costs (8\u201310%)", "$2,000", "$5,000"],
    ["Launch Trailer (AI-assisted production)", "$200", "$500"],
    ["Tournament Prize Pool (Season 1)", "$500", "$2,000"],
    ["Replit Operating Reserve (12 months)", "$500", "$600"],
    ["Contingency / Growth Capital", "$3,775", "$5,775"],
    ["Total", "$25,000", "$50,000"],
  ];
  for (const row of funds) {
    y = tableRow(row, y, uw);
  }
  doc.y = y + 10;

  subSection("Why Funding Amounts Are Still Low");
  body("Traditional game studios need funding for: multiple developer salaries ($80K\u2013$150K/year each), office space ($2K\u2013$10K/month), equipment ($5K\u2013$10K per developer), health insurance, HR, legal, accounting, and more. Wisdom & Chance replaces all of this with a single founder at $50K/year and ~$63/month in platform costs.");
  body("The majority of funding goes to founder salary runway and marketing. Once the project reaches ~500 paying users/month, it becomes fully self-sustaining. The project can and will continue development regardless of funding outcome \u2014 the founder is committed to the product.");

  subSection("Return on Investment");
  body(
    "Investors would receive returns through a revenue-sharing agreement. Proposed structure: investors receive 15\u201320% of gross revenue until 2x their investment is returned, then 5% of gross revenue for an additional 3 years. Exact terms are negotiable and will be formalized in a separate investment agreement."
  );

  subSection("Why Now?");
  body("The product is substantially built \u2014 over $150,000 in estimated development value has been created with under $300 in actual costs. Funding now covers the founder\u2019s salary runway during the critical growth phase and accelerates the last mile: professional art, app store launch, and marketing. The risk-reward ratio is exceptionally favorable because the core product already exists, is functional, and the ongoing cost to maintain it is under $4,250/month including the founder\u2019s salary.");

  sectionTitle("14. Risk Analysis & Mitigation");

  const risks = [
    [
      "App Store Rejection",
      "Apple or Google may reject the app for policy violations",
      "Pre-review guidelines compliance check; maintain web version as fallback; iterate on feedback",
    ],
    [
      "Platform Fee Impact",
      "30% app store commission reduces mobile margins",
      "Price mobile products higher; emphasize web purchases; qualify for Apple Small Business Program (15%); Google\u2019s 15% on first $1M",
    ],
    [
      "Low User Acquisition",
      "Difficulty reaching target audience",
      "Multi-channel marketing; community-first approach; content creator partnerships; organic SEO/ASO; near-zero burn rate means we can wait for traction",
    ],
    [
      "Technical Scaling",
      "Server performance under high player load",
      "Replit auto-scaling; database optimization; CDN for static assets; graceful degradation",
    ],
    [
      "Competition",
      "Established TCGs dominate market share",
      "Focus on niche (simultaneous play, accessibility); indie community appeal; unique mechanics differentiation; cost structure means even tiny market share is profitable",
    ],
    [
      "Expo/React Native Compatibility",
      "Framework updates may break mobile app",
      "Pin dependency versions; maintain expo-router patches; test on each SDK update before deploying",
    ],
    [
      "Key Person Risk",
      "Single developer dependency",
      "Comprehensive codebase documentation; Replit AI can assist new developers; modular architecture enables onboarding; the AI-assisted model means a new developer can be productive quickly",
    ],
    [
      "Crowdfunding Failure",
      "Campaign does not reach funding goal",
      "Set achievable base goal ($25K vs industry-typical $100K\u2013$500K+); build pre-campaign audience; web app generates revenue independently; project continues regardless of campaign outcome",
    ],
  ];

  for (const [risk, desc, mitigation] of risks) {
    ensureSpace(80);
    doc.fontSize(11).fillColor(COLORS.red).text(`Risk: ${risk}`);
    doc.fontSize(10).fillColor(COLORS.textLight).text(`Impact: ${desc}`);
    doc.fontSize(10).fillColor(COLORS.green).text(`Mitigation: ${mitigation}`);
    doc.moveDown(0.5);
  }

  sectionTitle("15. Appendix: Technical Architecture");

  subSection("Monorepo Structure");
  body("The project uses a unified monorepo with shared types between web and mobile:");
  doc.font("Courier").fontSize(9).fillColor(COLORS.text);
  doc.text(`
  /
  \u251C\u2500\u2500 server/               # Express.js backend (${METRICS.serverLOC.toLocaleString()} lines)
  \u2502   \u251C\u2500\u2500 routes.ts         # ${METRICS.routesEndpoints} core API endpoints
  \u2502   \u251C\u2500\u2500 multiplayerRoutes.ts  # ${METRICS.multiplayerEndpoints} multiplayer endpoints
  \u2502   \u251C\u2500\u2500 paymentRoutes.ts  # ${METRICS.paymentEndpoints} payment endpoints
  \u2502   \u251C\u2500\u2500 mobileAuth.ts    # ${METRICS.mobileAuthEndpoints} mobile auth endpoints
  \u2502   \u251C\u2500\u2500 websocket.ts     # Real-time multiplayer (${METRICS.websocketLOC.toLocaleString()} lines)
  \u2502   \u251C\u2500\u2500 gameEngine.ts    # Server-side combat engine (${METRICS.gameEngineLOC.toLocaleString()} lines)
  \u2502   \u251C\u2500\u2500 storage.ts       # Database interface (${METRICS.storageLOC.toLocaleString()} lines)
  \u2502   \u2514\u2500\u2500 replit_integrations/  # Auth, chat, image routes
  \u251C\u2500\u2500 client/               # React + Vite web app (${METRICS.clientLOC.toLocaleString()} lines)
  \u2502   \u2514\u2500\u2500 src/pages/        # ${METRICS.webPages} web pages
  \u251C\u2500\u2500 mobile/               # React Native + Expo (${METRICS.mobileLOC.toLocaleString()} lines)
  \u2502   \u251C\u2500\u2500 app/              # ${METRICS.mobileScreens} screens (expo-router)
  \u2502   \u251C\u2500\u2500 components/       # ${METRICS.mobileComponents} shared components
  \u2502   \u2514\u2500\u2500 lib/              # API client, game engine, WebSocket
  \u251C\u2500\u2500 shared/               # Shared TypeScript types & schemas (${METRICS.sharedLOC.toLocaleString()} lines)
  \u2502   \u251C\u2500\u2500 schema.ts         # Zod schemas & game constants
  \u2502   \u2514\u2500\u2500 models/           # ${METRICS.sharedModels} model modules
  \u2514\u2500\u2500 package.json          # Monorepo root
  `, { lineGap: 1 });
  doc.font("Helvetica");

  subSection("Technology Stack");
  bullet("Backend: Node.js + Express.js + TypeScript");
  bullet("Database: PostgreSQL with Drizzle ORM");
  bullet("Web Frontend: React 18 + Vite + Tailwind CSS + shadcn/ui");
  bullet("Mobile: React Native + Expo SDK 53 + expo-router");
  bullet("Real-time: WebSocket (ws library) with JWT authentication");
  bullet("Payments: Stripe SDK + PayPal Server SDK");
  bullet("AI: Google Gemini (deck suggestions)");
  bullet("Auth: Replit OpenID Connect (web) + JWT tokens (mobile)");
  bullet("Hosting: Replit Deployments (auto-scaling)");
  doc.moveDown(0.5);

  subSection("API Endpoint Summary");
  body(`${METRICS.totalEndpoints} total HTTP endpoints across ${METRICS.endpointsByFile.filter(f => f.count > 0).length} route files:`);
  for (const f of METRICS.endpointsByFile.filter(f => f.count > 0)) {
    bullet(`${f.label} \u2014 ${f.count} endpoints`);
  }
  doc.moveDown(0.5);

  subSection("Key Metrics");
  bullet(`Total production code: ${METRICS.totalLOC.toLocaleString()} lines`);
  bullet(`API endpoints: ${METRICS.totalEndpoints}`);
  bullet(`Web pages: ${METRICS.webPages}`);
  bullet(`Mobile screens: ${METRICS.mobileScreens}`);
  bullet(`Shared type models: ${METRICS.sharedModels} modules`);
  bullet("Game elements: 5 (Fire, Water, Earth, Air, Nature)");
  bullet("Unique cards: 50 built / 100 planned in Set 1");
  bullet("Commanders: 5");
  bullet("Commander abilities: 15+ unique effects");
  bullet("Game modes: Standard (2/2) and Accelerated (3/3)");
  bullet("AI difficulty levels: Easy, Medium, Hard");

  doc.addPage();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.primary);
  doc.moveDown(8);
  doc.fontSize(28).fillColor(COLORS.accent).text("Thank You", { align: "center" });
  doc.moveDown(1);
  doc.fontSize(14).fillColor(COLORS.white).text("Wisdom & Chance TCG", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor(COLORS.gold).text("Built by one person. Backed by 30+ years of design heritage.", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor("#aaa").text("A Legraphics Gaming Division Production", { align: "center" });
  doc.moveDown(1);
  doc.fontSize(11).fillColor("#aaa").text("For investment inquiries and partnership opportunities:", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor(COLORS.gold).text("redeagle28089@gmail.com", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor("#aaa").text("https://wisdom-and-chance-2.replit.app", { align: "center", link: "https://wisdom-and-chance-2.replit.app" });
  doc.moveDown(3);
  doc.fontSize(9).fillColor("#666").text("\u00A9 2026 Legraphics Gaming Division. All rights reserved.", { align: "center" });
  doc.fontSize(8).fillColor("#555").text("This document is confidential and intended solely for the addressee.", { align: "center" });

  const totalPages = doc.bufferedPageRange().count;
  for (let i = 1; i < totalPages; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor(COLORS.textLight);
    doc.text(
      "Wisdom & Chance TCG \u2014 Confidential Business Plan v7.0 \u2014 Legraphics Gaming Division \u2014 April 2026",
      60,
      doc.page.height - 55,
      { align: "center", width: doc.page.width - 120, lineBreak: false }
    );
    doc.fontSize(9).fillColor(COLORS.textLight);
    doc.text(`Page ${i + 1}`, 60, doc.page.height - 40, {
      align: "center",
      width: doc.page.width - 120,
      lineBreak: false,
    });
  }

  doc.end();
  return new Promise<void>((resolve) => {
    stream.on("finish", () => {
      console.log(`PDF generated: ${OUTPUT_PATH}`);
      resolve();
    });
  });
}

createPDF();
