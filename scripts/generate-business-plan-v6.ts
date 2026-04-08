import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const OUTPUT_PATH = path.resolve("Wisdom_Chance_TCG_Business_Plan_v6.pdf");

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
      Title: "Wisdom & Chance TCG — Business Plan v6.0",
      Author: "Wisdom & Chance TCG",
      Subject: "Investment & Crowdfunding Business Plan — Solo Operator Edition",
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
    ensureSpace(80);
    doc.moveDown(1);
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
  doc.moveDown(6);
  doc.fontSize(42).fillColor(COLORS.accent).text("WISDOM & CHANCE", { align: "center" });
  doc.fontSize(36).fillColor(COLORS.gold).text("TCG", { align: "center" });
  doc.moveDown(1);
  doc.fontSize(14).fillColor(COLORS.white).text("BUSINESS PLAN v6.0", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor(COLORS.gold).text("Solo Operator Edition", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor("#aaa").text("Investment & Crowdfunding Prospectus", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor("#aaa").text("April 2026", { align: "center" });
  doc.moveDown(4);
  doc.fontSize(10).fillColor("#888").text("CONFIDENTIAL", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(9).fillColor("#666").text("Prepared for potential investors, crowdfunding backers, and strategic partners", { align: "center" });
  doc.moveDown(1);
  doc.fontSize(9).fillColor("#666").text("https://wisdom-and-chance-2.replit.app", { align: "center", link: "https://wisdom-and-chance-2.replit.app" });

  doc.addPage();
  sectionTitle("Table of Contents");
  doc.moveDown(0.5);
  const toc = [
    "1.  Executive Summary",
    "2.  Founder & Solo Operator Overview",
    "3.  Product Description",
    "4.  Market Analysis",
    "5.  Competitive Analysis — Hearthstone Case Study",
    "6.  Revenue Model & Product Catalog",
    "7.  Cost Analysis — Solo Operator Model",
    "8.  Marketing & Growth Strategy",
    "9.  Crowdfunding Campaign Strategy",
    "10. Development Roadmap",
    "11. Financial Projections",
    "12. Funding Requirements & Use of Funds",
    "13. Risk Analysis & Mitigation",
    "14. Appendix: Technical Architecture",
  ];
  for (const entry of toc) {
    doc.fontSize(11).fillColor(COLORS.text).text(entry, 80);
  }

  doc.addPage();
  sectionTitle("1. Executive Summary");

  body(
    "Wisdom & Chance TCG is a digital trading card game that combines strategic deck-building with elemental combat mechanics. The game features five elemental factions \u2014 Fire, Water, Earth, Air, and Nature \u2014 with 50 unique cards and 5 Commanders, each with specialized abilities that create deep strategic gameplay."
  );

  body(
    "What makes this project extraordinary is how it was built: a single founder, working entirely within Replit\u2019s AI-assisted development platform, has created a product that would traditionally require a team of 4\u20136 engineers and $150,000\u2013$200,000+ in development costs. The entire operation runs on approximately $50\u2013$150 per month in infrastructure costs \u2014 making this one of the most capital-efficient game development projects in the digital TCG space."
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
    "Monthly operating costs are approximately $50\u2013$150 (Replit subscription + hosting), compared to Hearthstone\u2019s estimated $15\u2013$20 million per year in operating costs. This extreme capital efficiency means profitability can be achieved with as few as 50\u2013100 paying users per month."
  );

  body(
    "The project is seeking $5,000\u2013$15,000 in funding to cover marketing, app store fees, AI image generation for professional card artwork, and growth capital. No funding is needed for development or team payroll \u2014 the founder handles everything."
  );

  sectionTitle("2. Founder & Solo Operator Overview");

  subSection("Sole Founder & Developer");
  body(
    "The founder serves as sole developer, product designer, artist, marketer, and project manager. All code \u2014 server, web client, and mobile app \u2014 has been written exclusively on Replit using AI-assisted development tools (Replit Agent), averaging 40 hours per week of development time. This approach has enabled one person to build what would traditionally require a team of 4\u20136 engineers over 12+ months."
  );

  subSection("How One Person Does It All");
  bullet("Development: Replit Agent provides AI-assisted coding, debugging, and deployment \u2014 multiplying individual output by 5\u201310x");
  bullet("Card Artwork: AI image generation services create professional-quality card illustrations at a fraction of traditional artist costs");
  bullet("Marketing: Social media, community management, and content creation \u2014 all handled by the founder");
  bullet("Operations: Replit\u2019s integrated platform handles hosting, database, deployments, and infrastructure automatically");
  bullet("Business Strategy: Founder handles all planning, financial modeling, and investor relations");
  doc.moveDown(0.3);

  subSection("Development Philosophy");
  body(
    "All coding, deployment, database management, and infrastructure are handled through Replit. This eliminates the need for separate hosting providers, CI/CD pipelines, DevOps personnel, or local development environments. Replit\u2019s integrated platform provides version control, database hosting (PostgreSQL), deployment, secret management, and AI-assisted code generation \u2014 all in one browser-based environment."
  );

  body(
    "This solo-operator model is not a limitation \u2014 it\u2019s a strategic advantage. With near-zero burn rate, the project can sustain indefinitely without external funding, take calculated risks on features and marketing, and reach profitability with minimal user traction."
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

  sectionTitle("4. Market Analysis");

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

  sectionTitle("5. Competitive Analysis \u2014 Hearthstone Case Study");

  body(
    "Hearthstone, developed by Blizzard Entertainment, is the most commercially successful digital TCG in history. Analyzing its cost structure and profitability provides valuable context for understanding Wisdom & Chance\u2019s positioning and potential."
  );

  subSection("Hearthstone Development & Operating Costs");

  let y = doc.y + 5;
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
    ["Monthly Operating Cost", "$1.2\u2013$1.7 million", "$50\u2013$150"],
    ["Cost Per Card", "$50,000\u2013$100,000+", "~$0.50 (AI generation)"],
    ["Infrastructure", "Custom data centers", "Replit managed hosting"],
    ["Break-even Users Needed", "~500,000+ MAU", "~50\u2013100 paying users"],
    ["Profit at 1,000 Payers", "Still losing money", "$8,000\u2013$15,000/month"],
  ];
  for (const row of compData) {
    y = tableRow(row, y, cmpW);
  }
  doc.y = y + 10;

  subSection("Key Takeaway");
  body(
    "Hearthstone needed approximately $30\u2013$50 million in development costs and 500,000+ monthly active users before it became profitable. Wisdom & Chance, with monthly costs under $150, can achieve profitability with fewer than 100 paying users. This 5,000x difference in cost structure means that even capturing 0.01% of Hearthstone\u2019s market would generate substantial profit."
  );

  body(
    "While Hearthstone benefits from Blizzard\u2019s massive brand, IP library, and marketing budget, Wisdom & Chance benefits from zero payroll, zero office costs, AI-multiplied productivity, and the ability to operate indefinitely without external funding. In a worst-case scenario where user growth is slow, the project simply continues at near-zero cost until traction builds \u2014 an option unavailable to any venture-funded competitor."
  );

  sectionTitle("6. Revenue Model & Product Catalog");

  subSection("Web Revenue Streams (Stripe + PayPal)");
  body("The web shop offers 11 digital products:");
  doc.moveDown(0.3);

  y = doc.y;
  const pw = [200, 80, 80, 120];
  y = tableRow(["Product", "Price", "Currency", "Category"], y, pw, true);
  const products = [
    ["Starter Pack (5 cards)", "$1.99", "USD", "Card Pack"],
    ["Booster Pack (10 cards)", "$3.99", "USD", "Card Pack"],
    ["Premium Pack (15 cards)", "$7.99", "USD", "Card Pack"],
    ["Legendary Pack (20 cards)", "$14.99", "USD", "Card Pack"],
    ["Ultimate Bundle (50 cards)", "$29.99", "USD", "Bundle"],
    ["500 Gold Coins", "$4.99", "USD", "Currency"],
    ["1,200 Gold Coins", "$9.99", "USD", "Currency"],
    ["3,000 Gold Coins", "$19.99", "USD", "Currency"],
    ["Season Pass", "$9.99", "USD/season", "Subscription"],
    ["Battle Pass Premium", "$14.99", "USD/season", "Subscription"],
    ["Cosmetic Card Backs", "$2.99", "USD", "Cosmetic"],
  ];
  for (const row of products) {
    y = tableRow(row, y, pw);
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
  bullet("Direct card pack sales \u2014 One-time purchases for random card packs");
  bullet("In-game currency \u2014 Gold coins used to purchase packs, cosmetics, and entry fees");
  bullet("Season/Battle Pass \u2014 Recurring seasonal subscriptions with exclusive rewards");
  bullet("Cosmetic items \u2014 Card backs, board themes, and visual customizations");

  sectionTitle("7. Cost Analysis \u2014 Solo Operator Model");

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

  subSection("Ongoing Monthly Costs \u2014 Primary: Replit Platform");
  body("The founder\u2019s primary expense is Replit, which provides the complete development and hosting stack:");
  y = doc.y + 5;
  const mw = [300, 180];
  y = tableRow(["Replit Expense", "Monthly Cost"], y, mw, true);
  const replitCosts = [
    ["Replit Core Subscription (AI Agent access)", "$25/month"],
    ["Replit Deployments (production hosting)", "$7\u2013$20/month"],
    ["PostgreSQL Database Hosting", "Included in Replit"],
    ["AI Agent Usage (~40 hrs/week development)", "Included in Core"],
    ["Total Replit Costs", "$32\u2013$45/month"],
  ];
  for (const row of replitCosts) {
    y = tableRow(row, y, mw);
  }
  doc.y = y + 10;

  subSection("Ongoing Costs \u2014 Secondary: Platform & Transaction Fees");
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

  subSection("Ongoing Costs \u2014 Tertiary: Services");
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
    ["Replit Platform (primary)", "$32\u2013$45"],
    ["AI Image Generation + Domain + Dev Accounts", "$15\u2013$30"],
    ["Platform/Transaction Fees (variable)", "$0\u2013varies with revenue"],
    ["Team/Payroll", "$0 (solo operator)"],
    ["Office/Equipment", "$0 (works from home)"],
    ["Total Fixed Monthly Costs", "$47\u2013$75"],
  ];
  for (const row of totalCosts) {
    y = tableRow(row, y, sw);
  }
  doc.y = y + 10;

  body(
    "Compare this to the v5.0 business plan which projected $2,100\u2013$4,100/month in operating costs (including a $2,000\u2013$4,000/month creative team). The solo operator model reduces fixed costs by 95\u201398%, fundamentally changing the project\u2019s financial dynamics."
  );

  sectionTitle("8. Marketing & Growth Strategy");

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

  sectionTitle("9. Crowdfunding Campaign Strategy");

  subSection("Platform");
  body("Primary platform: Kickstarter (largest audience for game projects). Backup: BackerKit for post-campaign management and late pledges.");

  subSection("Campaign Goal \u2014 Revised for Solo Model");
  body("Base goal: $5,000 \u2014 Covers app store fees, initial marketing spend, and AI image generation for all 50 cards + 5 commanders.");
  body("Stretch goals up to $15,000 \u2014 Additional marketing, tournament prize pool, localization, new card expansion.");

  body("Note: Because the solo operator model has near-zero fixed costs, the crowdfunding goal is dramatically lower than traditional game projects. This makes the campaign far more likely to succeed and reduces backer risk.");

  subSection("Reward Tiers");
  y = doc.y + 5;
  const rw = [100, 200, 180];
  y = tableRow(["Tier", "Reward", "Price"], y, rw, true);
  const tiers = [
    ["Supporter", "Name in credits, digital thank-you card", "$5"],
    ["Player", "Starter deck (5 packs) + exclusive card back", "$15"],
    ["Champion", "10 packs + Season Pass + founder badge", "$30"],
    ["Commander", "25 packs + Battle Pass + exclusive Commander skin", "$50"],
    ["Legend", "50 packs + all passes + name a card + VIP Discord", "$100"],
    ["Patron", "Everything above + 1-hour strategy call + custom card", "$250"],
  ];
  for (const row of tiers) {
    y = tableRow(row, y, rw);
  }
  doc.y = y + 10;

  subSection("Campaign Timeline");
  body("Pre-campaign: 4\u20136 weeks of social media buildup, email list collection, and press outreach.");
  body("Campaign duration: 30 days.");
  body("Post-campaign: BackerKit for surveys, add-ons, and late pledges. Fulfillment within 60 days of campaign close.");

  sectionTitle("10. Development Roadmap");

  subSection("Phase 1: Completed (Q1 2025 \u2013 Q1 2026)");
  bullet("Core game engine with 5 elements, 50 cards, 5 commanders");
  bullet("Full web application with 29 pages and complete gameplay loop");
  bullet("Server-side multiplayer game engine with WebSocket real-time sync");
  bullet("AI opponents (Easy/Medium/Hard difficulty)");
  bullet("Social system (friends, messaging, leaderboards, achievements)");
  bullet("Payment integration (Stripe + PayPal) on web");
  bullet(`Mobile app (React Native/Expo) with ${METRICS.mobileScreens} screens \u2014 functional in Expo Go`);
  bullet("Unified monorepo architecture sharing one server and database");
  doc.moveDown(0.5);

  subSection("Phase 2: App Store Launch (Q2\u2013Q3 2026)");
  bullet("Generate professional card artwork using AI image generation tools");
  bullet("Integrate Apple IAP and Google Play Billing in mobile app");
  bullet("Push notification system for mobile");
  bullet("Final QA pass and performance optimization");
  bullet("Apple App Store and Google Play submission");
  bullet("Launch crowdfunding campaign");
  doc.moveDown(0.5);

  subSection("Phase 3: Growth & Season 1 (Q3\u2013Q4 2026)");
  bullet("Season 1 launch with ranked play, seasonal rewards, and battle pass");
  bullet("Tournament system \u2014 in-game organized competitive play");
  bullet("New card expansion set (10\u201315 additional cards)");
  bullet("Social features expansion \u2014 guilds/clans, spectator mode improvements");
  bullet("Content creator program \u2014 streamer tools and referral integration");
  doc.moveDown(0.5);

  subSection("Phase 4: Expansion (2027)");
  bullet("New element or card mechanics (e.g., dual-element cards)");
  bullet("Localization \u2014 5+ languages");
  bullet("Draft/Arena game mode");
  bullet("Physical merchandise tie-ins (optional, dependent on revenue)");
  bullet("Esports integration \u2014 sponsored tournaments with prize pools");

  sectionTitle("11. Financial Projections");

  body("Conservative projections assume gradual user acquisition post-launch with the solo operator cost structure. All figures are in USD. Operating costs reflect actual costs ($50\u2013$75/month fixed + variable platform fees), not the inflated team-based costs from the v5.0 plan.");
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
    ["Fixed Costs (3 mo)", "$200", "$200", "$225", "$225"],
    ["Platform Fees (~15%)", "$90", "$338", "$810", "$1,688"],
    ["Total Costs", "$290", "$538", "$1,035", "$1,913"],
    ["Net Income", "+$310", "+$1,712", "+$4,365", "+$9,337"],
  ];
  for (const row of yr1) {
    y = tableRow(row, y, fw);
  }
  doc.y = y + 10;

  body("Year 1 total projected revenue: ~$19,500. Year 1 total costs: ~$3,776. Net profit: +$15,724.");
  body("The project is profitable from Q1 \u2014 Day 1 post-launch. Compare to v5.0 projections which showed -$21,500 net loss in Year 1 due to team payroll costs.");
  doc.moveDown(0.3);

  subSection("Year 2 Projections (Growth Phase)");
  y = doc.y + 5;
  y = tableRow(["Metric", "Q1", "Q2", "Q3", "Q4"], y, fw, true);
  const yr2 = [
    ["Monthly Active Users", "7,000", "10,000", "15,000", "20,000"],
    ["Paying Users (6%)", "420", "600", "900", "1,200"],
    ["Avg Revenue/Payer", "$15", "$18", "$20", "$22"],
    ["Quarterly Revenue", "$18,900", "$32,400", "$54,000", "$79,200"],
    ["Fixed Costs (3 mo)", "$225", "$225", "$225", "$225"],
    ["Platform Fees (~18%)", "$3,402", "$5,832", "$9,720", "$14,256"],
    ["Total Costs", "$3,627", "$6,057", "$9,945", "$14,481"],
    ["Net Income", "+$15,273", "+$26,343", "+$44,055", "+$64,719"],
  ];
  for (const row of yr2) {
    y = tableRow(row, y, fw);
  }
  doc.y = y + 10;
  body("Year 2 total projected revenue: ~$184,500. Year 2 total costs: ~$34,110. Net profit: +$150,390.");
  body("Year 2 profit margin: ~81.5%. This extraordinary margin is possible because costs are almost entirely variable (platform fees) with negligible fixed costs.");

  subSection("Profitability Threshold Analysis");
  body("With monthly fixed costs of ~$50\u2013$75 and average revenue per payer of $10:");
  bullet("Break-even: 6\u20138 paying users per month (after platform fees)");
  bullet("$1,000/month profit: ~125 paying users");
  bullet("$5,000/month profit: ~625 paying users");
  bullet("$10,000/month profit: ~1,250 paying users");
  doc.moveDown(0.3);
  body("For comparison, Hearthstone needed an estimated 500,000+ monthly active users to cover its operating costs. Wisdom & Chance needs fewer than 10 paying users to break even.");

  sectionTitle("12. Funding Requirements & Use of Funds");

  subSection("Total Funding Sought: $5,000 \u2013 $15,000");
  body("Because the solo operator model eliminates team payroll, the funding requirement is 70\u201390% lower than the v5.0 plan\u2019s $45,000\u2013$65,000 target.");
  doc.moveDown(0.3);

  y = doc.y;
  const uw = [240, 120, 120];
  y = tableRow(["Use of Funds", "Minimum", "Maximum"], y, uw, true);
  const funds = [
    ["Marketing & User Acquisition", "$2,000", "$5,000"],
    ["AI Card Art Generation (55 cards)", "$200", "$500"],
    ["App Store Submission Fees", "$125", "$125"],
    ["Crowdfunding Campaign Costs (8\u201310%)", "$400", "$1,500"],
    ["Launch Trailer (AI-assisted production)", "$200", "$500"],
    ["Tournament Prize Pool (Season 1)", "$500", "$2,000"],
    ["Operating Reserve (12 months)", "$600", "$900"],
    ["Contingency / Growth Capital", "$975", "$4,475"],
    ["Total", "$5,000", "$15,000"],
  ];
  for (const row of funds) {
    y = tableRow(row, y, uw);
  }
  doc.y = y + 10;

  subSection("Why Funding Amounts Are Low");
  body("Traditional game studios need funding for: developer salaries ($80K\u2013$150K/year each), office space ($2K\u2013$10K/month), equipment ($5K\u2013$10K per developer), health insurance, HR, legal, accounting, and more. Wisdom & Chance has none of these costs.");
  body("The funding is purely for growth acceleration \u2014 marketing, app store presence, and competitive season prizes. The project can and will continue development regardless of funding outcome.");

  subSection("Return on Investment");
  body(
    "Investors would receive returns through a revenue-sharing agreement. Proposed structure: investors receive 15\u201320% of gross revenue until 2x their investment is returned, then 5% of gross revenue for an additional 3 years. Exact terms are negotiable and will be formalized in a separate investment agreement."
  );

  subSection("Why Now?");
  body("The product is substantially built \u2014 over $150,000 in estimated development value has been created with under $300 in actual costs. Funding now accelerates the last mile: professional art, app store launch, and marketing. The risk-reward ratio is exceptionally favorable because the core product already exists, is functional, and the ongoing cost to maintain it is negligible.");

  sectionTitle("13. Risk Analysis & Mitigation");

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
      "Set achievable base goal ($5K vs industry-typical $50K+); build pre-campaign audience; web app generates revenue independently; project continues regardless of campaign outcome",
    ],
  ];

  for (const [risk, desc, mitigation] of risks) {
    ensureSpace(80);
    doc.fontSize(11).fillColor(COLORS.red).text(`Risk: ${risk}`);
    doc.fontSize(10).fillColor(COLORS.textLight).text(`Impact: ${desc}`);
    doc.fontSize(10).fillColor(COLORS.green).text(`Mitigation: ${mitigation}`);
    doc.moveDown(0.5);
  }

  sectionTitle("14. Appendix: Technical Architecture");

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
  bullet("Unique cards: 50");
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
  doc.fontSize(12).fillColor(COLORS.gold).text("Built by one person. Ready for the world.", { align: "center" });
  doc.moveDown(1);
  doc.fontSize(11).fillColor("#aaa").text("For investment inquiries and partnership opportunities:", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor(COLORS.gold).text("redeagle28089@gmail.com", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor("#aaa").text("https://wisdom-and-chance-2.replit.app", { align: "center", link: "https://wisdom-and-chance-2.replit.app" });
  doc.moveDown(3);
  doc.fontSize(9).fillColor("#666").text("\u00A9 2026 Wisdom & Chance TCG. All rights reserved.", { align: "center" });
  doc.fontSize(8).fillColor("#555").text("This document is confidential and intended solely for the addressee.", { align: "center" });

  const totalPages = doc.bufferedPageRange().count;
  for (let i = 1; i < totalPages; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor(COLORS.textLight);
    doc.text(
      "Wisdom & Chance TCG \u2014 Confidential Business Plan v6.0 \u2014 Solo Operator Edition \u2014 April 2026",
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
