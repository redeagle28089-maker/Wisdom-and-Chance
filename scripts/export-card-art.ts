import { db } from "../server/db";
import { cardImages } from "@shared/schema";
import archiver from "archiver";
import { createWriteStream, mkdirSync } from "fs";
import { statSync } from "fs";
import { asc } from "drizzle-orm";

const rows = await db.select().from(cardImages).orderBy(asc(cardImages.name));
console.log(`Found ${rows.length} images`);

mkdirSync("./exports", { recursive: true });

const outputPath = "./exports/wisdom-chance-card-art.zip";
const output = createWriteStream(outputPath);
const archive = archiver("zip", { zlib: { level: 6 } });

await new Promise<void>((resolve, reject) => {
  output.on("close", resolve);
  archive.on("error", reject);
  archive.pipe(output);

  let added = 0;
  for (const img of rows) {
    const match = img.imageUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);
    if (!match) { console.log(`Skipping ${img.name}: invalid data URL`); continue; }
    const ext = match[1] === "jpeg" ? "jpg" : match[1];
    const safeName = img.name.replace(/[^a-zA-Z0-9_\- ]/g, "_").trim();
    const buffer = Buffer.from(match[2], "base64");
    archive.append(buffer, { name: `card-art/${safeName}_${img.id}.${ext}` });
    added++;
  }
  console.log(`Added ${added} images to ZIP`);
  archive.finalize();
});

const { size } = statSync(outputPath);
console.log(`Done — ${outputPath} (${(size / 1024 / 1024).toFixed(2)} MB)`);
process.exit(0);
