import fs from "fs";
import path from "path";
import {
  buildTikTokResult,
  isTikTokPostsDataset,
  isTikTokProfileDataset,
  type RawTikTokPost,
  type RawTikTokProfile,
} from "../lib/importTikTokRaw";

/**
 * Usage:
 *   npx tsx scripts/import-tiktok-snapshot.ts <handle> <posts.json> [profile.json]
 *
 * Example:
 *   npx tsx scripts/import-tiktok-snapshot.ts kossof-tiktok \
 *     data/tiktok_raw/dataset_tiktok-posts_*.json \
 *     data/tiktok_raw/dataset_tiktok-profile-scraper_*.json
 */
const args = process.argv.slice(2);
const handleArg = args[0]?.replace(/^@/, "").trim().toLowerCase();
const postsPath = args[1];
const profilePath = args[2];

if (!handleArg || !postsPath) {
  console.error(
    "Usage: npx tsx scripts/import-tiktok-snapshot.ts <handle> <posts.json> [profile.json]",
  );
  process.exit(1);
}

function readJson(filePath: string): unknown {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(abs, "utf-8"));
}

const postsParsed = readJson(postsPath);
if (!isTikTokPostsDataset(postsParsed)) {
  console.error("Unrecognized posts format — expected scrapeforge/tiktok-posts export");
  process.exit(1);
}

let profile: RawTikTokProfile | null = null;
if (profilePath) {
  const profileParsed = readJson(profilePath);
  if (!isTikTokProfileDataset(profileParsed)) {
    console.error(
      "Unrecognized profile format — expected khadinakbar/tiktok-profile-scraper export",
    );
    process.exit(1);
  }
  profile = (profileParsed as RawTikTokProfile[])[0] ?? null;
}

const result = buildTikTokResult(handleArg, postsParsed as RawTikTokPost[], {
  profile,
  scrapedAt: Date.now(),
  pinned: true,
});

const outDir = path.join(process.cwd(), "data", "snapshots");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${handleArg}.json`);
fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf-8");

console.log(
  `TikTok snapshot → ${result.profile.displayName} (@${result.profile.username})`,
);
console.log(
  `  ${result.stats.videoCount} videos, ${result.stats.hashtagCount} hashtags, ${result.stats.totalPlays} plays, ${result.stats.totalDiggs} likes`,
);
console.log(`Wrote ${outFile}`);
