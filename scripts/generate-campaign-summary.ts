import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const OUTPUT_PATH = path.resolve("Wisdom_Chance_TCG_Campaign_Summary.pdf");

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
  orange: "#e67e22",
  darkBg: "#16213e",
};

function createPDF() {
  const doc = new PDFDocument({
    size: "letter",
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title: "Wisdom & Chance TCG — Campaign Summary",
      Author: "Legraphics Gaming Division — Jason Myers",
      Subject: "Back the Game. Play the Beta. Shape the Future.",
    },
    bufferPages: true,
  });

  const stream = fs.createWriteStream(OUTPUT_PATH);
  doc.pipe(stream);

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const contentW = pageW - 100;

  function tableRow(cells: string[], y: number, widths: number[], header = false, colors?: string[]) {
    const PAGE_BOTTOM = pageH - 60;
    if (y + 24 > PAGE_BOTTOM) {
      doc.addPage();
      y = 60;
    }
    let x = 50;
    const h = header ? 24 : 22;
    for (let i = 0; i < cells.length; i++) {
      if (header) {
        doc.rect(x, y, widths[i], h).fill(COLORS.accent);
        doc.fontSize(9.5).fillColor(COLORS.white).text(cells[i], x + 6, y + 6, {
          width: widths[i] - 12,
          align: i === 0 ? "left" : i === cells.length - 1 ? "right" : "left",
          lineBreak: false,
        });
      } else {
        const bgColor = colors && colors[i] ? colors[i] : (Math.floor((y - 60) / 22) % 2 === 0 ? COLORS.lightBg : COLORS.white);
        doc.rect(x, y, widths[i], h).fill(bgColor);
        doc.fontSize(9).fillColor(COLORS.text).text(cells[i], x + 6, y + 5, {
          width: widths[i] - 12,
          align: i === 0 ? "left" : i === cells.length - 1 ? "right" : "left",
          lineBreak: false,
        });
      }
      x += widths[i];
    }
    return y + h;
  }

  doc.rect(0, 0, pageW, pageH).fill(COLORS.primary);

  doc.moveDown(3);
  doc.fontSize(44).fillColor(COLORS.accent).text("WISDOM & CHANCE", { align: "center" });
  doc.fontSize(38).fillColor(COLORS.gold).text("TCG", { align: "center" });
  doc.moveDown(0.6);

  doc.rect(50, doc.y, contentW, 2).fill(COLORS.accent);
  doc.moveDown(0.8);

  doc.fontSize(16).fillColor(COLORS.white).text("Back the Game. Play the Beta. Shape the Future.", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor(COLORS.gold).text("A Legraphics Gaming Division Production", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor("#aaa").text("Powered by 30+ years of design heritage", { align: "center" });

  doc.moveDown(2);

  doc.rect(80, doc.y, contentW - 60, 1).fill(COLORS.accent);
  doc.moveDown(1);

  doc.fontSize(18).fillColor(COLORS.accent).text("A DIGITAL COLLECTIBLE CARD GAME", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor("#ccc").text(
    "Five elemental factions. Strategic deck-building. Real-time multiplayer battles.",
    { align: "center" }
  );
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("#ccc").text(
    "Play on web browsers and mobile devices \u2014 one account, everywhere.",
    { align: "center" }
  );

  doc.moveDown(2);
  doc.fontSize(10).fillColor("#888").text("CONFIDENTIAL \u2014 April 2026", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor("#666").text("https://wisdom-and-chance-2.replit.app", { align: "center", link: "https://wisdom-and-chance-2.replit.app" });

  doc.addPage();

  doc.fontSize(22).fillColor(COLORS.accent).text("WHAT IS WISDOM & CHANCE?");
  doc.rect(50, doc.y + 2, contentW, 2).fill(COLORS.accent);
  doc.moveDown(0.8);

  doc.fontSize(11).fillColor(COLORS.text).text(
    "Wisdom & Chance TCG is a digital collectible card game (DCCG) that blends strategic deck-building with elemental combat. Choose from five elemental factions \u2014 Fire, Water, Earth, Air, and Nature \u2014 each with unique playstyles, strengths, and synergies. Build your deck, pick your Commander, and battle opponents in fast-paced matches that reward both careful planning and bold risk-taking.",
    { align: "justify", lineGap: 3 }
  );
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor(COLORS.text).text(
    "Whether you prefer outsmarting the AI in solo mode or testing your skills against real players in real-time multiplayer, Wisdom & Chance delivers a deep, satisfying card game experience accessible on web browsers and mobile devices.",
    { align: "justify", lineGap: 3 }
  );
  doc.moveDown(0.8);

  doc.fontSize(14).fillColor(COLORS.accentDark).text("What Makes It Special");
  doc.moveDown(0.4);

  const features = [
    ["\u2694\uFE0F  Five Elemental Factions", "Fire, Water, Earth, Air, and Nature \u2014 each with unique cards, mechanics, and strategies"],
    ["\uD83D\uDC51  Commander System", "Choose a Commander with powerful unique abilities that define your battle strategy"],
    ["\u26A1  Real-Time Multiplayer", "Challenge friends or get matched with opponents for live PvP card battles"],
    ["\uD83E\uDD16  AI Opponents", "Practice against Easy, Medium, and Hard AI to sharpen your skills"],
    ["\uD83C\uDFAF  Daily Challenges", "New challenges every day that reward Gold, packs, and exclusive items"],
    ["\uD83C\uDFC6  Achievements & Leaderboards", "Climb the ranks and show off your accomplishments"],
    ["\uD83D\uDCF1  Cross-Platform", "Play on web or mobile \u2014 your collection and progress sync across devices"],
    ["\uD83D\uDCB0  In-Game Economy", "Earn Gold through gameplay or purchase packs to grow your collection"],
  ];

  for (const [title, desc] of features) {
    doc.fontSize(10.5).fillColor(COLORS.accent).text(title, 60);
    doc.fontSize(10).fillColor(COLORS.textLight).text(desc, 80, undefined, { lineGap: 2 });
    doc.moveDown(0.3);
  }

  doc.addPage();

  doc.fontSize(22).fillColor(COLORS.accent).text("THIS GAME IS ALREADY PLAYABLE");
  doc.rect(50, doc.y + 2, contentW, 2).fill(COLORS.accent);
  doc.moveDown(0.8);

  doc.fontSize(11).fillColor(COLORS.text).text(
    "Unlike most crowdfunding campaigns that launch with nothing more than concept art and promises, Wisdom & Chance TCG is a fully functional game you can play RIGHT NOW. Visit the website, create an account, and start playing \u2014 before you even decide to pledge.",
    { align: "justify", lineGap: 3 }
  );
  doc.moveDown(0.5);

  doc.rect(60, doc.y, contentW - 20, 80).fill(COLORS.lightBg).stroke(COLORS.accent);
  const boxY = doc.y;
  doc.fontSize(13).fillColor(COLORS.accent).text("The Numbers Speak", 75, boxY + 10);
  doc.fontSize(10).fillColor(COLORS.text);
  doc.text("\u2022  29 web pages  \u2022  27 mobile screens  \u2022  146 API endpoints", 75, boxY + 30);
  doc.text("\u2022  47,000+ lines of code  \u2022  Real-time multiplayer  \u2022  Full economy system", 75, boxY + 48);
  doc.text("\u2022  AI opponents  \u2022  Social features  \u2022  Payment processing ready", 75, boxY + 66);
  doc.y = boxY + 95;
  doc.moveDown(0.5);

  doc.fontSize(14).fillColor(COLORS.accentDark).text("What Would This Normally Cost?");
  doc.moveDown(0.4);
  doc.fontSize(11).fillColor(COLORS.text).text(
    "Building a game like this from scratch with a traditional development team would cost between $320,000 and $900,000. Jason Myers, founder of Legraphics Gaming Division, built it for approximately $400 in Replit subscription fees using AI-assisted development.",
    { align: "justify", lineGap: 3 }
  );
  doc.moveDown(0.5);

  let y = doc.y + 5;
  const cw = [260, contentW - 260];
  y = tableRow(["Development Approach", "Estimated Cost"], y, cw, true);
  y = tableRow(["Traditional studio (4\u20136 engineers \u00D7 12 months)", "$320,000\u2013$900,000"], y, cw);
  y = tableRow(["Freelance team (3\u20134 developers)", "$150,000\u2013$300,000"], y, cw);
  y = tableRow(["Offshore development team", "$80,000\u2013$150,000"], y, cw);
  y = tableRow(["Single senior developer (12 months)", "$100,000\u2013$180,000"], y, cw);
  y = tableRow(["Actual cost (AI-assisted, 1 person)", "~$400"], y, cw);
  doc.y = y + 10;

  doc.moveDown(0.3);
  doc.fontSize(11).fillColor(COLORS.green).text(
    "This means the hardest part \u2014 building the game \u2014 is already done. Your backing funds art, polish, marketing, and growth \u2014 not the hope that someone can write the code.",
    { align: "justify", lineGap: 3 }
  );

  doc.addPage();

  doc.fontSize(22).fillColor(COLORS.accent).text("BETA ACCESS \u2014 PLAY NOW FOR $10+");
  doc.rect(50, doc.y + 2, contentW, 2).fill(COLORS.accent);
  doc.moveDown(0.8);

  doc.rect(50, doc.y, contentW, 55).fill(COLORS.gold);
  const betaBannerY = doc.y;
  doc.fontSize(18).fillColor(COLORS.primary).text("Pledge $10 or more = Instant Beta Access", 65, betaBannerY + 8);
  doc.fontSize(11).fillColor(COLORS.primary).text(
    "Every backer at $10+ gets immediate, full access to the game on web and mobile \u2014 no waiting!",
    65, betaBannerY + 33
  );
  doc.y = betaBannerY + 65;
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor(COLORS.text).text(
    "When you pledge $10 or more, you receive a unique one-time passcode via email. Enter it in the game to unlock your Beta Backer status permanently. It\u2019s that simple \u2014 pledge, get your code, and start playing.",
    { align: "justify", lineGap: 3 }
  );
  doc.moveDown(0.6);

  doc.fontSize(14).fillColor(COLORS.accentDark).text("How Beta Access Works");
  doc.moveDown(0.4);

  const steps = [
    ["1", "Pledge $10+ on Kickstarter (or BackerKit late pledge)"],
    ["2", "Receive a unique one-time passcode via email"],
    ["3", "Enter the passcode in the game (web or mobile app)"],
    ["4", "Your account is permanently flagged as a Beta Backer"],
    ["5", "Enjoy full game access + exclusive Beta Backer badge & card back"],
  ];

  for (const [num, step] of steps) {
    doc.rect(60, doc.y, 24, 24).fill(COLORS.accent);
    doc.fontSize(12).fillColor(COLORS.white).text(num, 60, doc.y - 24 + 5, { width: 24, align: "center" });
    doc.fontSize(10.5).fillColor(COLORS.text).text(step, 95, doc.y - 24 + 5);
    doc.moveDown(0.5);
  }

  doc.moveDown(0.5);
  doc.fontSize(14).fillColor(COLORS.accentDark).text("What Beta Backers Get");
  doc.moveDown(0.4);

  const betaPerks = [
    "Full access to the game on web and mobile",
    "All current and future Set 1 cards as they\u2019re released",
    "Real-time multiplayer, AI battles, deck building, and social features",
    "Exclusive Beta Backer in-game badge (permanent)",
    "Exclusive Beta Backer card back (permanent)",
    "Your feedback directly shapes the game\u2019s development",
    "Early access to new features before public launch",
  ];

  for (const perk of betaPerks) {
    doc.fontSize(10.5).fillColor(COLORS.text).text(`  \u2713  ${perk}`, 60, undefined, { lineGap: 2 });
  }

  doc.addPage();

  doc.fontSize(22).fillColor(COLORS.accent).text("BACKER REWARD TIERS");
  doc.rect(50, doc.y + 2, contentW, 2).fill(COLORS.accent);
  doc.moveDown(0.8);

  doc.fontSize(11).fillColor(COLORS.text).text(
    "Every pledge level comes with unique rewards. All tiers at $10 and above include full beta access via one-time passcode. Choose the tier that fits your level of support:",
    { align: "justify", lineGap: 3 }
  );
  doc.moveDown(0.6);

  y = doc.y;
  const tw = [80, 290, 60];
  y = tableRow(["Tier", "Rewards", "Price"], y, tw, true);
  y = tableRow(["Supporter", "Name in credits + digital thank-you card", "$5"], y, tw);
  y = tableRow(["Beta Backer", "Beta access + 2 packs ($4 value) + Beta badge", "$10"], y, tw);
  y = tableRow(["Player", "Beta access + 5 packs ($10 value) + exclusive card back", "$15"], y, tw);
  y = tableRow(["Champion", "Beta access + 15 packs ($30) + Season Pass + founder badge", "$40"], y, tw);
  y = tableRow(["Commander", "Beta access + 25 packs ($50) + Battle Pass + Commander skin", "$65"], y, tw);
  y = tableRow(["Legend", "Beta access + 50 packs ($100) + all passes + name a card + VIP", "$125"], y, tw);
  y = tableRow(["Patron", "Everything above + 1-hour strategy call + custom card design", "$250"], y, tw);
  doc.y = y + 15;

  doc.rect(60, doc.y, contentW - 20, 45).fill(COLORS.lightBg).stroke(COLORS.gold);
  const noteY = doc.y;
  doc.fontSize(10).fillColor(COLORS.accent).text("\u2B50  Best Entry Point: Beta Backer ($10)", 75, noteY + 8);
  doc.fontSize(9.5).fillColor(COLORS.textLight).text(
    "Get instant access to the full game + 2 bonus packs + an exclusive Beta Backer badge. The most affordable way to play now and support the game\u2019s development.",
    75, noteY + 24, { width: contentW - 50, lineGap: 2 }
  );
  doc.y = noteY + 55;

  doc.moveDown(0.8);
  doc.fontSize(14).fillColor(COLORS.accentDark).text("Pack Pricing");
  doc.moveDown(0.4);

  doc.fontSize(11).fillColor(COLORS.text).text(
    "Our shop uses simple, transparent pricing \u2014 no confusing bundles or hidden markups:",
    { lineGap: 3 }
  );
  doc.moveDown(0.3);

  y = doc.y;
  const pw = [160, 130, 140];
  y = tableRow(["Quantity", "USD Price", "In-Game Gold"], y, pw, true);
  y = tableRow(["1 pack (5 cards)", "$2.00", "200 Gold"], y, pw);
  y = tableRow(["5 packs (25 cards)", "$10.00", "1,000 Gold"], y, pw);
  y = tableRow(["10 packs (50 cards)", "$20.00", "2,000 Gold"], y, pw);
  y = tableRow(["25 packs (125 cards)", "$50.00", "5,000 Gold"], y, pw);
  y = tableRow(["50 packs (250 cards)", "$100.00", "10,000 Gold"], y, pw);
  doc.y = y + 10;

  doc.moveDown(0.3);
  doc.fontSize(10).fillColor(COLORS.textLight).text(
    "Exchange rate: $1 = 100 Gold. All pricing scales linearly \u2014 no discounts, no markups. What you see is what you get.",
    { lineGap: 2 }
  );

  doc.addPage();

  doc.fontSize(22).fillColor(COLORS.accent).text("CAMPAIGN PIPELINE");
  doc.rect(50, doc.y + 2, contentW, 2).fill(COLORS.accent);
  doc.moveDown(0.8);

  doc.fontSize(14).fillColor(COLORS.accentDark).text("Kickstarter + BackerKit \u2014 Two Phases for Maximum Impact");
  doc.moveDown(0.5);

  doc.fontSize(12).fillColor(COLORS.accent).text("Phase 1: Kickstarter Campaign (30 Days)");
  doc.moveDown(0.3);
  doc.fontSize(10.5).fillColor(COLORS.text).text(
    "The main fundraising event. This is where the community comes together to bring Wisdom & Chance to its full potential. Kickstarter is the largest platform for game projects with the most engaged backer community.",
    { align: "justify", lineGap: 3 }
  );
  doc.moveDown(0.3);
  const phase1 = [
    "Live gameplay demo \u2014 \u201Cplay the game right now\u201D as the headline",
    "Daily/weekly updates with dev progress, card reveals, and community highlights",
    "Stretch goal reveals at key funding milestones",
    "All $10+ backers receive beta access passcode immediately",
  ];
  for (const item of phase1) {
    doc.fontSize(10).fillColor(COLORS.text).text(`  \u2022  ${item}`, 60, undefined, { lineGap: 2 });
  }

  doc.moveDown(0.6);
  doc.fontSize(12).fillColor(COLORS.accent).text("Phase 2: BackerKit (Ongoing After Campaign)");
  doc.moveDown(0.3);
  doc.fontSize(10.5).fillColor(COLORS.text).text(
    "After the Kickstarter ends, BackerKit keeps the momentum going. Late pledges, add-on purchases, and a permanent pre-order store mean revenue keeps flowing long after the campaign closes. Many successful game Kickstarters generate 15\u201325% additional revenue through BackerKit.",
    { align: "justify", lineGap: 3 }
  );
  doc.moveDown(0.3);
  const phase2 = [
    "Late pledges \u2014 same tiers and rewards as the Kickstarter campaign",
    "Add-on items \u2014 extra packs, cosmetic bundles, Season Pass upgrades",
    "Backer surveys for fulfillment and personalization",
    "Late backers also receive beta access upon $10+ pledge",
    "BackerKit store remains open indefinitely",
  ];
  for (const item of phase2) {
    doc.fontSize(10).fillColor(COLORS.text).text(`  \u2022  ${item}`, 60, undefined, { lineGap: 2 });
  }

  doc.moveDown(0.8);
  doc.fontSize(14).fillColor(COLORS.accentDark).text("Funding Goal");
  doc.moveDown(0.4);

  doc.rect(60, doc.y, contentW - 20, 65).fill(COLORS.lightBg).stroke(COLORS.accent);
  const goalY = doc.y;
  doc.fontSize(11).fillColor(COLORS.accent).text("Base Goal: $25,000", 75, goalY + 8);
  doc.fontSize(10).fillColor(COLORS.text).text(
    "Covers 6 months of founder salary, app store fees, marketing launch, and AI-generated artwork for all 100 cards + 5 Commanders in Set 1.",
    75, goalY + 24, { width: contentW - 50, lineGap: 2 }
  );
  doc.fontSize(11).fillColor(COLORS.gold).text("Stretch Goal: $50,000", 75, goalY + 48);
  doc.y = goalY + 75;

  doc.moveDown(0.3);
  doc.fontSize(10).fillColor(COLORS.text).text(
    "12 months founder salary runway, expanded marketing, tournament prize pool, localization into multiple languages, and head start on Set 2 development.",
    { lineGap: 3 }
  );

  doc.addPage();

  doc.rect(0, 0, pageW, pageH).fill(COLORS.primary);
  doc.moveDown(5);
  doc.fontSize(32).fillColor(COLORS.accent).text("Ready to Play?", { align: "center" });
  doc.moveDown(1);
  doc.fontSize(16).fillColor(COLORS.white).text("Wisdom & Chance TCG", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(13).fillColor(COLORS.gold).text("Back it. Play it. Shape it.", { align: "center" });
  doc.moveDown(1.5);

  doc.fontSize(12).fillColor("#ccc").text("Try the game free right now:", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(13).fillColor(COLORS.gold).text("wisdom-and-chance-2.replit.app", { align: "center", link: "https://wisdom-and-chance-2.replit.app" });

  doc.moveDown(2);
  doc.fontSize(11).fillColor("#aaa").text("Pledge $10+ for instant beta access", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(11).fillColor("#aaa").text("Every backer helps shape the future of the game", { align: "center" });

  doc.moveDown(3);
  doc.fontSize(10).fillColor("#888").text("A Legraphics Gaming Division Production", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor("#666").text("Contact: redeagle28089@gmail.com", { align: "center" });
  doc.moveDown(1);
  doc.fontSize(8).fillColor("#555").text("\u00A9 2026 Legraphics Gaming Division. All rights reserved.", { align: "center" });

  const range = doc.bufferedPageRange();
  for (let i = 1; i < range.count - 1; i++) {
    doc.switchToPage(i);
    const savedY = doc.y;
    const savedX = doc.x;

    doc.save();
    doc.fontSize(8).fillColor(COLORS.textLight);
    const footerText = "Wisdom & Chance TCG \u2014 Campaign Summary \u2014 Legraphics Gaming Division \u2014 April 2026";
    const footerWidth = pageW - 100;
    const footerTextWidth = doc.widthOfString(footerText);
    const centeredX = 50 + (footerWidth - footerTextWidth) / 2;
    doc.text(footerText, centeredX, pageH - 45, { lineBreak: false });
    doc.restore();

    doc.x = savedX;
    doc.y = savedY;
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
