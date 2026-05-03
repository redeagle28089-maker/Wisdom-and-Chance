import { db } from "../server/db";
import { cardImages } from "@shared/schema";
import archiver from "archiver";
import { createWriteStream, mkdirSync, readFileSync } from "fs";
import { statSync } from "fs";
import { asc } from "drizzle-orm";
import { join } from "path";

const rows = await db.select().from(cardImages).orderBy(asc(cardImages.name));
console.log(`Found ${rows.length} library images`);

mkdirSync("./exports", { recursive: true });

const outputPath = "./exports/wisdom-chance-card-art.zip";
const output = createWriteStream(outputPath);
const archive = archiver("zip", { zlib: { level: 6 } });

await new Promise<void>((resolve, reject) => {
  output.on("close", resolve);
  archive.on("error", reject);
  archive.pipe(output);

  // 1. Card art library (from database base64)
  let dbAdded = 0;
  for (const img of rows) {
    const match = img.imageUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);
    if (!match) { console.log(`Skipping ${img.name}: invalid data URL`); continue; }
    const ext = match[1] === "jpeg" ? "jpg" : match[1];
    const safeName = img.name.replace(/[^a-zA-Z0-9_\- ]/g, "_").trim();
    const buffer = Buffer.from(match[2], "base64");
    archive.append(buffer, { name: `card-art/${safeName}_${img.id}.${ext}` });
    dbAdded++;
  }
  console.log(`Added ${dbAdded} card art images`);

  // 2. Commander portraits (static PNG files bundled with the app)
  const commanderPortraits = [
    { file: "fire_commander_portrait.png",    name: "Pyros_the_Eternal_Fire_Commander.png" },
    { file: "water_commander_portrait.png",   name: "Aquara_the_Deep_Water_Commander.png" },
    { file: "earth_commander_portrait.png",   name: "Terran_the_Unmovable_Earth_Commander.png" },
    { file: "air_commander_portrait.png",     name: "Zephyros_the_Swift_Air_Commander.png" },
    { file: "nature_commander_portrait.png",  name: "Gaia_the_Eternal_Nature_Commander.png" },
  ];

  let commanderAdded = 0;
  for (const { file, name } of commanderPortraits) {
    const filePath = join("attached_assets/generated_images", file);
    try {
      const buffer = readFileSync(filePath);
      archive.append(buffer, { name: `commanders/${name}` });
      commanderAdded++;
      console.log(`Added commander: ${name}`);
    } catch (e) {
      console.log(`Could not read ${filePath}: ${e}`);
    }
  }
  console.log(`Added ${commanderAdded} commander portraits`);

  archive.finalize();
});

const { size } = statSync(outputPath);
console.log(`\nDone — ${outputPath}`);
console.log(`Total size: ${(size / 1024 / 1024).toFixed(2)} MB`);
process.exit(0);
