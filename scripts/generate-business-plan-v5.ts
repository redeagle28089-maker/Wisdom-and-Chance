import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const OUTPUT_PATH = path.resolve("Wisdom_Chance_TCG_Business_Plan_v5.pdf");

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
      Title: "Wisdom & Chance TCG — Business Plan v5.0",
      Author: "Wisdom & Chance TCG",
      Subject: "Investment & Crowdfunding Business Plan",
    },
    bufferPages: true,
  });

  const stream = fs.createWriteStream(OUTPUT_PATH);
  doc.pipe(stream);

  

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
    doc.fontSize(10.5).fillColor(COLORS.text).text(`  •  ${text}`, {
      indent: 10,
      lineGap: 2,
    });
  }

  const PAGE_BOTTOM = doc.page.height - 80;

  function tableRow(doc: PDFKit.PDFDocument, cells: string[], y: number, widths: number[], header = false) {
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

  function ensureSpace(needed: number) {
    if (doc.y + needed > PAGE_BOTTOM) doc.addPage();
  }

  // ====== COVER PAGE ======
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.primary);
  doc.moveDown(6);
  doc.fontSize(42).fillColor(COLORS.accent).text("WISDOM & CHANCE", { align: "center" });
  doc.fontSize(36).fillColor(COLORS.gold).text("TCG", { align: "center" });
  doc.moveDown(1);
  doc.fontSize(14).fillColor(COLORS.white).text("BUSINESS PLAN v5.0", { align: "center" });
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

  // ====== TABLE OF CONTENTS ======
  doc.addPage();
  sectionTitle("Table of Contents");
  doc.moveDown(0.5);
  const toc = [
    "1.  Executive Summary",
    "2.  Company & Team Overview",
    "3.  Product Description",
    "4.  Market Analysis",
    "5.  Revenue Model & Product Catalog",
    "6.  Cost Analysis",
    "7.  Marketing & Growth Strategy",
    "8.  Crowdfunding Campaign Strategy",
    "9.  Development Roadmap",
    "10. Financial Projections",
    "11. Funding Requirements & Use of Funds",
    "12. Risk Analysis & Mitigation",
    "13. Appendix: Technical Architecture",
  ];
  for (const entry of toc) {
    doc.fontSize(11).fillColor(COLORS.text).text(entry, 80);
  }

  // ====== 1. EXECUTIVE SUMMARY ======
  doc.addPage();
  sectionTitle("1. Executive Summary");

  body(
    "Wisdom & Chance TCG is a digital trading card game that combines strategic deck-building with elemental combat mechanics. The game features five elemental factions — Fire, Water, Earth, Air, and Nature — with 50 unique cards and 5 Commanders, each with specialized abilities that create deep strategic gameplay."
  );

  body(
    "Since the v4.0 business plan, the project has achieved several critical milestones:"
  );

  bullet("Fully functional web application live at wisdom-and-chance-2.replit.app");
  bullet("Fully functional mobile application running in Expo Go (iOS/Android)");
  bullet("Unified monorepo architecture — web and mobile share one Express server and PostgreSQL database");
  bullet(`${METRICS.totalEndpoints} API endpoints powering cards, decks, commanders, game engine, social features, economy, and payments`);
  bullet("Server-side game engine with real-time WebSocket multiplayer");
  bullet(`~${(Math.round(METRICS.totalLOC / 1000) * 1000).toLocaleString()} lines of production code across server, web client, and mobile app`);
  bullet("AI-powered deck suggestions using Google Gemini integration");
  bullet("Stripe and PayPal payment integrations for web; ready for mobile in-app purchases");
  bullet("Social system with friends, messaging, leaderboards, achievements, and daily challenges");
  doc.moveDown(0.3);

  body(
    "The project is now seeking $45,000–$65,000 in funding to complete app store submission (Apple App Store & Google Play), commission professional card artwork, launch a marketing campaign, and fund the first competitive season. The entire application — web and mobile — has been built by a single founder using Replit's AI-assisted development tools, demonstrating extraordinary capital efficiency."
  );

  // ====== 2. TEAM ======
  sectionTitle("2. Company & Team Overview");

  subSection("Founder & Lead Developer");
  body(
    "The founder serves as sole developer, product designer, and project manager. All code — server, web client, and mobile app — has been written exclusively on Replit using AI-assisted development tools (Replit Agent). This approach has enabled one person to build what would traditionally require a team of 4–6 engineers over 12+ months."
  );

  subSection("Creative Team — Legraphics");
  body(
    "Legraphics provides the creative production team consisting of:"
  );
  bullet("2 Graphic Designers — Card artwork, UI assets, brand materials, marketing collateral");
  bullet("1 Motion Graphics Designer — Card animations, promotional videos, social media content, trailer production");
  doc.moveDown(0.3);
  body(
    "This lean team structure keeps burn rate minimal while covering all critical functions. No additional full-time hires are planned until post-launch revenue validates growth spending."
  );

  subSection("Development Philosophy");
  body(
    "All coding, deployment, database management, and infrastructure are handled through Replit. This eliminates the need for separate hosting providers, CI/CD pipelines, DevOps personnel, or local development environments. Replit's integrated platform provides version control, database hosting (PostgreSQL), deployment, secret management, and AI-assisted code generation — all in one browser-based environment."
  );

  // ====== 3. PRODUCT DESCRIPTION ======
  sectionTitle("3. Product Description");

  subSection("Core Game Mechanics");
  body("Wisdom & Chance TCG is built on a phase-based combat system:");
  bullet("Draw Phase — Players draw cards from their deck simultaneously");
  bullet("Deployment Phase — Players place cards face-down on the battlefield");
  bullet("Combat Phase — Cards are revealed and power totals determine the round winner");
  bullet("Calculation Phase — Damage is applied, traits trigger, Victory/Withdrawal Points are awarded");
  doc.moveDown(0.3);

  body("Each card has base power (1–10), an elemental affinity, and optional traits:");
  bullet("Quick Strike — Deals direct damage before main combat");
  bullet("Guardian — Absorbs incoming damage to protect HP");
  bullet("Restoration — Heals the player's HP");
  bullet("Care Package — Draws additional cards");
  doc.moveDown(0.3);

  body("Commanders add a strategic layer with unique abilities that cost Victory Points (VP) or Withdrawal Points (WP) to activate. Abilities include element buffs, direct damage, card cycling, deploy bonuses, enemy debuffs, and protective shields.");

  subSection("Web Application — Live & Operational");
  body("The web app (wisdom-and-chance-2.replit.app) includes:");
  bullet(`${METRICS.webPages} pages: Home, Card Database, Deck Builder, Practice Mode, Multiplayer Lobby, Game Board, Shop, Profile, Analytics, Leaderboard, Achievements, Daily Challenges, Friends, Messaging, Rules, Lore, Tutorial, Live Matches, Season Pass, Pack Opening, Admin Tools, and more`);
  bullet("Real-time multiplayer via WebSocket with reconnection handling");
  bullet("AI opponents (Easy/Medium/Hard) powered by a server-side game engine");
  bullet("Stripe and PayPal payment processing (currently in beta mode)");
  bullet("Admin dashboards for card art management, user management, and image database");
  bullet("Google Gemini AI-powered deck suggestions");
  doc.moveDown(0.3);

  subSection("Mobile Application — Functional in Expo Go");
  body("The React Native / Expo mobile app includes:");
  bullet(`${METRICS.mobileScreens} screens across 5 tab sections (Home, Cards, Decks, Social, More)`);
  bullet("Full card browsing with element-themed card frames and static artwork");
  bullet("Deck management — create, edit, delete, import/export via share codes");
  bullet("Practice battles against AI with the same game engine as web");
  bullet("PvP multiplayer game board with real-time WebSocket sync");
  bullet("Social features — friends list, friend requests, direct messaging");
  bullet("Player profile, match history, analytics, achievements, daily challenges");
  bullet("Game rules, lore archives, interactive tutorial");
  bullet("JWT-based authentication with secure token storage");
  doc.moveDown(0.3);

  subSection("Remaining Mobile Work");
  body("The mobile app is approximately 80–85% complete. Remaining items:");
  bullet("In-app purchase integration (Apple IAP + Google Play Billing)");
  bullet("Push notification system");
  bullet("App Store / Google Play submission and review process");
  bullet("Professional card artwork integration (pending from Legraphics)");
  bullet("Performance optimization and final QA pass");

  // ====== 4. MARKET ANALYSIS ======
  sectionTitle("4. Market Analysis");

  subSection("Digital TCG Market Size");
  body(
    "The global digital trading card game market was valued at approximately $8.9 billion in 2024 and is projected to reach $15.2 billion by 2029, growing at a CAGR of 11.3%. Key drivers include mobile gaming growth, the rise of competitive esports, and increasing digital collectible adoption."
  );

  subSection("Competitive Landscape");
  body("Major competitors include:");
  bullet("Hearthstone (Blizzard) — Established leader, 30M+ monthly players");
  bullet("Magic: The Gathering Arena — Premium brand, complex mechanics");
  bullet("Yu-Gi-Oh! Master Duel — Massive IP, 50M+ downloads");
  bullet("Pokémon TCG Live — Brand power, younger demographic");
  bullet("Marvel Snap — Fast gameplay, 20M+ downloads in first year");
  doc.moveDown(0.3);

  subSection("Wisdom & Chance Differentiation");
  body("Wisdom & Chance TCG differentiates through:");
  bullet("Simultaneous play — Both players act each phase, eliminating passive waiting");
  bullet("Elemental buff/debuff system — Cards interact across elements for strategic depth");
  bullet("Commander abilities — Unique strategic abilities that create asymmetric gameplay");
  bullet("Accessible complexity — Easy to learn (deploy and compare power) but deep strategy");
  bullet("Cross-platform play — Web and mobile players share the same game world");
  bullet("Solo-developed indie story — Compelling narrative for community building");

  subSection("Target Audience");
  bullet("Primary: TCG players aged 18–35 who enjoy strategic depth without excessive complexity");
  bullet("Secondary: Mobile gamers looking for quick competitive matches (5–10 minutes)");
  bullet("Tertiary: Content creators and streamers in the indie game space");

  // ====== 5. REVENUE MODEL ======
  sectionTitle("5. Revenue Model & Product Catalog");

  subSection("Web Revenue Streams (Stripe + PayPal)");
  body("The web shop offers 11 digital products:");
  doc.moveDown(0.3);

  let y = doc.y;
  const w = [200, 80, 80, 120];
  y = tableRow(doc, ["Product", "Price", "Currency", "Category"], y, w, true);
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
    y = tableRow(doc, row, y, w);
  }
  doc.y = y + 10;

  subSection("Mobile Revenue Streams (Planned)");
  body("Mobile in-app purchases will mirror the web catalog with platform-specific considerations:");
  bullet("Apple App Store — 30% commission on all transactions (15% for small business program if eligible)");
  bullet("Google Play — 15% commission on first $1M, then 30%");
  bullet("Pricing may be adjusted upward on mobile to account for platform fees");
  bullet("Subscription products (Season Pass, Battle Pass) will use platform-native recurring billing");

  subSection("Revenue Model Summary");
  body("Revenue comes from four primary channels:");
  bullet("Direct card pack sales — One-time purchases for random card packs");
  bullet("In-game currency — Gold coins used to purchase packs, cosmetics, and entry fees");
  bullet("Season/Battle Pass — Recurring seasonal subscriptions with exclusive rewards");
  bullet("Cosmetic items — Card backs, board themes, and visual customizations");

  // ====== 6. COST ANALYSIS ======
  sectionTitle("6. Cost Analysis");

  subSection("Development Costs (Already Invested)");
  body("The following represents work already completed, demonstrating capital efficiency:");
  doc.moveDown(0.3);
  y = doc.y;
  const cw = [280, 200];
  y = tableRow(doc, ["Item", "Estimated Value"], y, cw, true);
  const devCosts = [
    [`Server-side development (${METRICS.serverLOC.toLocaleString()} lines)`, "$35,000–$50,000"],
    [`Web client development (${METRICS.clientLOC.toLocaleString()} lines)`, "$40,000–$55,000"],
    [`Mobile app development (${METRICS.mobileLOC.toLocaleString()} lines)`, "$30,000–$45,000"],
    ["Game engine & combat system", "$15,000–$20,000"],
    ["WebSocket multiplayer system", "$10,000–$15,000"],
    ["Payment integration (Stripe + PayPal)", "$5,000–$8,000"],
    [`Database schema & API design (${METRICS.totalEndpoints} endpoints)`, "$12,000–$18,000"],
    ["Total estimated development value", "$147,000–$211,000"],
  ];
  for (const row of devCosts) {
    y = tableRow(doc, row, y, cw);
  }
  doc.y = y + 10;
  body("All of this was built by a single developer on Replit, with actual out-of-pocket costs limited to Replit subscription fees and domain costs.");

  subSection("Ongoing Monthly Costs");
  y = doc.y;
  y = tableRow(doc, ["Expense", "Monthly Cost"], y, cw, true);
  const monthlyCosts = [
    ["Replit Core Plan", "$25/month"],
    ["Replit Deployments (production)", "$7–$20/month"],
    ["PostgreSQL Database Hosting", "Included in Replit"],
    ["Domain Name", "~$12/year"],
    ["Legraphics Creative Team", "$2,000–$4,000/month"],
    ["Apple Developer Account", "$99/year"],
    ["Google Play Developer Account", "$25 one-time"],
    ["Total Monthly Operating", "~$2,100–$4,100/month"],
  ];
  for (const row of monthlyCosts) {
    y = tableRow(doc, row, y, cw);
  }
  doc.y = y + 10;

  // ====== 7. MARKETING ======
  sectionTitle("7. Marketing & Growth Strategy");

  subSection("Pre-Launch (Current Phase)");
  bullet("Build social media presence — Twitter/X, TikTok, Instagram, Reddit (r/cardgames, r/tcg)");
  bullet("Content marketing — Dev logs, behind-the-scenes videos, card reveal campaigns");
  bullet("Community building — Discord server for early testers and feedback");
  bullet("Influencer outreach — TCG content creators on YouTube and Twitch");
  bullet("Press coverage — Indie game publications, Replit community showcase");
  doc.moveDown(0.5);

  subSection("Launch Phase");
  bullet("App Store Optimization (ASO) — Keyword research, screenshot optimization, localized descriptions");
  bullet("Launch trailer — Produced by motion graphics designer");
  bullet("Cross-promotion — Web players invited to download mobile; mobile players directed to web for full experience");
  bullet("Crowdfunding backer exclusive content — Early access, exclusive card backs, founder badges");
  bullet("Referral program — Invite friends, earn in-game currency");
  doc.moveDown(0.5);

  subSection("Post-Launch Growth");
  bullet("Competitive seasons — Monthly/quarterly ranked seasons with leaderboard prizes");
  bullet("Tournament system — Community-organized and official tournaments");
  bullet("Content updates — New cards, commanders, and seasonal events");
  bullet("Streamer partnerships — Sponsored streams and tournament coverage");
  bullet("Localization — Translate to Spanish, Portuguese, French, German, Japanese for global reach");

  // ====== 8. CROWDFUNDING ======
  sectionTitle("8. Crowdfunding Campaign Strategy");

  subSection("Platform");
  body("Primary platform: Kickstarter (largest audience for game projects). Backup: BackerKit for post-campaign management and late pledges.");

  subSection("Campaign Goal");
  body("Base goal: $45,000 — Covers app store submission, card artwork, initial marketing, and 6 months of operations.");
  body("Stretch goals up to $65,000 — Additional card sets, tournament prize pool, localization.");

  subSection("Reward Tiers");
  y = doc.y + 5;
  const rw = [100, 200, 180];
  y = tableRow(doc, ["Tier", "Reward", "Price"], y, rw, true);
  const tiers = [
    ["Supporter", "Name in credits, digital thank-you card", "$5"],
    ["Player", "Starter deck (5 packs) + exclusive card back", "$15"],
    ["Champion", "10 packs + Season Pass + founder badge", "$30"],
    ["Commander", "25 packs + Battle Pass + exclusive Commander skin", "$50"],
    ["Legend", "50 packs + all passes + name a card + VIP Discord", "$100"],
    ["Patron", "Everything above + 1-hour strategy call + custom card", "$250"],
  ];
  for (const row of tiers) {
    y = tableRow(doc, row, y, rw);
  }
  doc.y = y + 10;

  subSection("Campaign Timeline");
  body("Pre-campaign: 4–6 weeks of social media buildup, email list collection, and press outreach.");
  body("Campaign duration: 30 days.");
  body("Post-campaign: BackerKit for surveys, add-ons, and late pledges. Fulfillment within 60 days of campaign close.");

  // ====== 9. ROADMAP ======
  sectionTitle("9. Development Roadmap");

  subSection("Phase 1: Completed (Q1 2025 – Q1 2026)");
  bullet("Core game engine with 5 elements, 50 cards, 5 commanders");
  bullet("Full web application with 29 pages and complete gameplay loop");
  bullet("Server-side multiplayer game engine with WebSocket real-time sync");
  bullet("AI opponents (Easy/Medium/Hard difficulty)");
  bullet("Social system (friends, messaging, leaderboards, achievements)");
  bullet("Payment integration (Stripe + PayPal) on web");
  bullet(`Mobile app (React Native/Expo) with ${METRICS.mobileScreens} screens — functional in Expo Go`);
  bullet("Unified monorepo architecture sharing one server and database");
  doc.moveDown(0.5);

  subSection("Phase 2: App Store Launch (Q2–Q3 2026)");
  bullet("Commission professional card artwork (Legraphics)");
  bullet("Integrate Apple IAP and Google Play Billing in mobile app");
  bullet("Push notification system for mobile");
  bullet("Final QA pass and performance optimization");
  bullet("Apple App Store and Google Play submission");
  bullet("Launch crowdfunding campaign");
  doc.moveDown(0.5);

  subSection("Phase 3: Growth & Season 1 (Q3–Q4 2026)");
  bullet("Season 1 launch with ranked play, seasonal rewards, and battle pass");
  bullet("Tournament system — in-game organized competitive play");
  bullet("New card expansion set (10–15 additional cards)");
  bullet("Social features expansion — guilds/clans, spectator mode improvements");
  bullet("Content creator program — streamer tools and referral integration");
  doc.moveDown(0.5);

  subSection("Phase 4: Expansion (2027)");
  bullet("New element or card mechanics (e.g., dual-element cards)");
  bullet("Localization — 5+ languages");
  bullet("Draft/Arena game mode");
  bullet("Physical merchandise tie-ins (optional, dependent on revenue)");
  bullet("Esports integration — sponsored tournaments with prize pools");

  // ====== 10. FINANCIAL PROJECTIONS ======
  sectionTitle("10. Financial Projections");

  body("Conservative projections assume gradual user acquisition post-launch with increasing monetization as the game matures. All figures are in USD.");
  doc.moveDown(0.3);

  subSection("Year 1 Post-Launch Quarterly Projections");
  y = doc.y + 5;
  const fw = [96, 96, 96, 96, 96];
  y = tableRow(doc, ["Metric", "Q1", "Q2", "Q3", "Q4"], y, fw, true);
  const projections = [
    ["Monthly Active Users", "500", "1,500", "3,000", "5,000"],
    ["Paying Users (5%)", "25", "75", "150", "250"],
    ["Avg Revenue/Payer", "$8", "$10", "$12", "$15"],
    ["Quarterly Revenue", "$600", "$2,250", "$5,400", "$11,250"],
    ["Operating Costs", "$8,000", "$9,500", "$11,000", "$12,500"],
    ["Net Income", "-$7,400", "-$7,250", "-$5,600", "-$1,250"],
  ];
  for (const row of projections) {
    y = tableRow(doc, row, y, fw);
  }
  doc.y = y + 10;

  body("Year 1 total projected revenue: ~$19,500. Year 1 total costs: ~$41,000. Net: -$21,500.");
  doc.moveDown(0.3);

  subSection("Year 2 Projections (Growth Phase)");
  y = doc.y + 5;
  y = tableRow(doc, ["Metric", "Q1", "Q2", "Q3", "Q4"], y, fw, true);
  const y2 = [
    ["Monthly Active Users", "7,000", "10,000", "15,000", "20,000"],
    ["Paying Users (6%)", "420", "600", "900", "1,200"],
    ["Avg Revenue/Payer", "$15", "$18", "$20", "$22"],
    ["Quarterly Revenue", "$18,900", "$32,400", "$54,000", "$79,200"],
    ["Operating Costs", "$14,000", "$16,000", "$18,000", "$20,000"],
    ["Net Income", "$4,900", "$16,400", "$36,000", "$59,200"],
  ];
  for (const row of y2) {
    y = tableRow(doc, row, y, fw);
  }
  doc.y = y + 10;
  body("Year 2 total projected revenue: ~$184,500. Year 2 total costs: ~$68,000. Net: +$116,500.");
  body("Break-even is projected in Q1 of Year 2 post-launch.");

  // ====== 11. FUNDING ======
  sectionTitle("11. Funding Requirements & Use of Funds");

  subSection("Total Funding Sought: $45,000 – $65,000");
  doc.moveDown(0.3);

  y = doc.y;
  const uw = [240, 120, 120];
  y = tableRow(doc, ["Use of Funds", "Minimum", "Maximum"], y, uw, true);
  const funds = [
    ["Professional Card Artwork (50 cards)", "$10,000", "$15,000"],
    ["Commander Artwork (5 commanders)", "$3,000", "$5,000"],
    ["App Store Submission & Compliance", "$2,000", "$3,000"],
    ["Marketing & User Acquisition", "$8,000", "$12,000"],
    ["Crowdfunding Campaign Costs (8–10%)", "$4,000", "$6,500"],
    ["Motion Graphics / Trailer Production", "$3,000", "$5,000"],
    ["Legraphics Team (6 months)", "$12,000", "$14,000"],
    ["Operating Costs (6 months runway)", "$3,000", "$4,500"],
    ["Total", "$45,000", "$65,000"],
  ];
  for (const row of funds) {
    y = tableRow(doc, row, y, uw);
  }
  doc.y = y + 10;

  subSection("Return on Investment");
  body(
    "Investors would receive returns through a revenue-sharing agreement. Proposed structure: investors receive 15–20% of gross revenue until 2x their investment is returned, then 5% of gross revenue for an additional 3 years. Exact terms are negotiable and will be formalized in a separate investment agreement."
  );

  subSection("Why Now?");
  body("The product is substantially built — over $150,000 in estimated development value has been created with minimal capital outlay. Funding now accelerates the last mile: professional art, app store launch, and marketing. The risk-reward ratio is highly favorable because the core product already exists and is functional.");

  // ====== 12. RISK ANALYSIS ======
  sectionTitle("12. Risk Analysis & Mitigation");

  const risks = [
    [
      "App Store Rejection",
      "Apple or Google may reject the app for policy violations",
      "Pre-review guidelines compliance check; engage app store consultants if needed; maintain web version as fallback",
    ],
    [
      "Platform Fee Impact",
      "30% app store commission reduces mobile margins",
      "Price mobile products higher; emphasize web purchases; qualify for Apple Small Business Program (15%)",
    ],
    [
      "Low User Acquisition",
      "Difficulty reaching target audience",
      "Multi-channel marketing; community-first approach; content creator partnerships; organic SEO/ASO",
    ],
    [
      "Technical Scaling",
      "Server performance under high player load",
      "Replit auto-scaling; database optimization; CDN for static assets; graceful degradation",
    ],
    [
      "Competition",
      "Established TCGs dominate market share",
      "Focus on niche (simultaneous play, accessibility); indie community appeal; unique mechanics differentiation",
    ],
    [
      "Expo/React Native Compatibility",
      "Framework updates may break mobile app",
      "Pin dependency versions; maintain expo-router patches; test on each SDK update before deploying",
    ],
    [
      "Key Person Risk",
      "Single developer dependency",
      "Comprehensive codebase documentation; Replit AI can assist new developers; modular architecture enables onboarding",
    ],
    [
      "Crowdfunding Failure",
      "Campaign does not reach funding goal",
      "Set achievable base goal; build pre-campaign audience; offer compelling early-bird rewards; web app generates revenue independently",
    ],
  ];

  for (const [risk, desc, mitigation] of risks) {
    ensureSpace(80);
    doc.fontSize(11).fillColor(COLORS.red).text(`Risk: ${risk}`);
    doc.fontSize(10).fillColor(COLORS.textLight).text(`Impact: ${desc}`);
    doc.fontSize(10).fillColor(COLORS.green).text(`Mitigation: ${mitigation}`);
    doc.moveDown(0.5);
  }

  // ====== 13. APPENDIX ======
  sectionTitle("13. Appendix: Technical Architecture");

  subSection("Monorepo Structure");
  body("The project uses a unified monorepo with shared types between web and mobile:");
  doc.font("Courier").fontSize(9).fillColor(COLORS.text);
  doc.text(`
  /
  ├── server/               # Express.js backend (${METRICS.serverLOC.toLocaleString()} lines)
  │   ├── routes.ts         # ${METRICS.routesEndpoints} core API endpoints
  │   ├── multiplayerRoutes.ts  # ${METRICS.multiplayerEndpoints} multiplayer endpoints
  │   ├── paymentRoutes.ts  # ${METRICS.paymentEndpoints} payment endpoints
  │   ├── mobileAuth.ts    # ${METRICS.mobileAuthEndpoints} mobile auth endpoints
  │   ├── websocket.ts     # Real-time multiplayer (${METRICS.websocketLOC.toLocaleString()} lines)
  │   ├── gameEngine.ts    # Server-side combat engine (${METRICS.gameEngineLOC.toLocaleString()} lines)
  │   ├── storage.ts       # Database interface (${METRICS.storageLOC.toLocaleString()} lines)
  │   └── replit_integrations/  # Auth, chat, image routes
  ├── client/               # React + Vite web app (${METRICS.clientLOC.toLocaleString()} lines)
  │   └── src/pages/        # ${METRICS.webPages} web pages
  ├── mobile/               # React Native + Expo (${METRICS.mobileLOC.toLocaleString()} lines)
  │   ├── app/              # ${METRICS.mobileScreens} screens (expo-router)
  │   ├── components/       # ${METRICS.mobileComponents} shared components
  │   └── lib/              # API client, game engine, WebSocket
  ├── shared/               # Shared TypeScript types & schemas (${METRICS.sharedLOC.toLocaleString()} lines)
  │   ├── schema.ts         # Zod schemas & game constants
  │   └── models/           # ${METRICS.sharedModels} model modules
  └── package.json          # Monorepo root
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
    bullet(`${f.label} — ${f.count} endpoints`);
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

  // ====== FINAL PAGE ======
  doc.addPage();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.primary);
  doc.moveDown(8);
  doc.fontSize(28).fillColor(COLORS.accent).text("Thank You", { align: "center" });
  doc.moveDown(1);
  doc.fontSize(14).fillColor(COLORS.white).text("Wisdom & Chance TCG", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor("#aaa").text("For investment inquiries and partnership opportunities:", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor(COLORS.gold).text("redeagle28089@gmail.com", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor("#aaa").text("https://wisdom-and-chance-2.replit.app", { align: "center", link: "https://wisdom-and-chance-2.replit.app" });
  doc.moveDown(3);
  doc.fontSize(9).fillColor("#666").text("© 2026 Wisdom & Chance TCG. All rights reserved.", { align: "center" });
  doc.fontSize(8).fillColor("#555").text("This document is confidential and intended solely for the addressee.", { align: "center" });

  const totalPages = doc.bufferedPageRange().count;
  for (let i = 1; i < totalPages; i++) {
    doc.switchToPage(i);
    doc.fontSize(9).fillColor(COLORS.textLight);
    doc.text(`Page ${i + 1}`, 60, doc.page.height - 40, {
      align: "center",
      width: doc.page.width - 120,
      lineBreak: false,
    });
    doc.fontSize(8).fillColor(COLORS.textLight);
    doc.text(
      "Wisdom & Chance TCG — Confidential Business Plan v5.0 — April 2026",
      60,
      doc.page.height - 55,
      { align: "center", width: doc.page.width - 120, lineBreak: false }
    );
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
