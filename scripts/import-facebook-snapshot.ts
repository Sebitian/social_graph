import fs from "fs";
import path from "path";
import {
  buildScrapeResultFromFacebookRaw,
  isFacebookFollowsDataset,
  isFacebookPagesDataset,
  isFacebookPostsDataset,
  type RawFacebookFollow,
  type RawFacebookPage,
  type RawFacebookPost,
} from "../lib/importFacebookRaw";

/**
 * Usage:
 *   npx tsx scripts/import-facebook-snapshot.ts <handle> <posts.json> [page.json] [follows.json]
 *
 * Example:
 *   npx tsx scripts/import-facebook-snapshot.ts kossof-facebook \
 *     data/facebook_raw/dataset_facebook-posts-scraper_*.json \
 *     data/facebook_raw/dataset_facebook-pages-scraper_*.json \
 *     data/facebook_raw/dataset_facebook-followers-following-scraper_*.json
 */
const args = process.argv.slice(2);
const handleArg = args[0]?.replace(/^@/, "").trim().toLowerCase();
const postsPath = args[1];
const pagePath = args[2];
const followsPath = args[3];

if (!handleArg || !postsPath) {
  console.error(
    "Usage: npx tsx scripts/import-facebook-snapshot.ts <handle> <posts.json> [page.json] [follows.json]",
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
if (!isFacebookPostsDataset(postsParsed)) {
  console.error("Unrecognized posts format — expected facebook-posts-scraper export");
  process.exit(1);
}

let page: RawFacebookPage | null = null;
if (pagePath) {
  const pageParsed = readJson(pagePath);
  if (!isFacebookPagesDataset(pageParsed)) {
    console.error("Unrecognized page format — expected facebook-pages-scraper export");
    process.exit(1);
  }
  page = (pageParsed as RawFacebookPage[])[0] ?? null;
}

let follows: RawFacebookFollow[] = [];
if (followsPath) {
  const followsParsed = readJson(followsPath);
  if (!isFacebookFollowsDataset(followsParsed)) {
    console.error(
      "Unrecognized follows format — expected facebook-followers-following-scraper export",
    );
    process.exit(1);
  }
  follows = followsParsed as RawFacebookFollow[];
}

const result = buildScrapeResultFromFacebookRaw(handleArg, {
  page,
  posts: postsParsed as RawFacebookPost[],
  follows,
});

const outDir = path.join(process.cwd(), "data", "snapshots");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${handleArg}.json`);
fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf-8");

console.log(
  `Facebook snapshot → ${result.profile.fullName} (@${result.profile.username})`,
);
console.log(
  `  ${result.posts?.length ?? 0} posts, ${result.stats.shown} graph people, ${result.engagers?.length ?? 0} engagers, ${result.stats.totalComments} comments`,
);
console.log(`Wrote ${outFile}`);
