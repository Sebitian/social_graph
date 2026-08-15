import fs from "fs";
import path from "path";
import {
  flattenInstagramReels,
  isInstagramPostsDataset,
  isInstagramProfileDataset,
  isInstagramReelsDataset,
  mergeReelsIntoProfilePosts,
  type RawInstagramPost,
  type RawInstagramProfile,
} from "../lib/importInstagramRaw";
import { buildInstagramPeopleResult } from "../lib/importInstagramPeopleRaw";
import type { ScrapeResult } from "../lib/types";

/**
 * Usage:
 *   npx tsx scripts/import-instagram-people-snapshot.ts [handle] \
 *     --profile <profile.json> \
 *     --posts <posts.json> \
 *     [--reels <reels.json>]
 *
 * Example:
 *   npx tsx scripts/import-instagram-people-snapshot.ts kossof-instagram-people \
 *     --profile data/insta_raw/dataset_instagram-profile-scraper_2026-08-15_05-04-36-070.json \
 *     --posts data/insta_raw/dataset_instagram-post-scraper_2026-08-15_05-02-15-522.json \
 *     --reels data/insta_raw/dataset_instagram-reel-scraper_2026-08-15_05-47-41-851.json
 */
function parseArgs(argv: string[]) {
  const handle = (argv[0] ?? "kossof-instagram-people")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
  const flags: Record<string, string> = {};
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      console.error(`Missing value for --${key}`);
      process.exit(1);
    }
    flags[key] = value;
    i += 1;
  }
  return { handle, flags };
}

const { handle, flags } = parseArgs(process.argv.slice(2));

if (!flags.profile || !flags.posts) {
  console.error(
    "Usage: npx tsx scripts/import-instagram-people-snapshot.ts [handle] --profile <profile.json> --posts <posts.json> [--reels <reels.json>]",
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

const profileParsed = readJson(flags.profile);
if (!isInstagramProfileDataset(profileParsed)) {
  console.error(
    "Unrecognized profile format — expected instagram-profile-scraper export",
  );
  process.exit(1);
}

const postsParsed = readJson(flags.posts);
if (!isInstagramPostsDataset(postsParsed)) {
  console.error(
    "Unrecognized posts format — expected instagram-post-scraper export",
  );
  process.exit(1);
}

let reels = [] as ReturnType<typeof flattenInstagramReels>;
if (flags.reels) {
  const reelsParsed = readJson(flags.reels);
  if (!isInstagramReelsDataset(reelsParsed)) {
    console.error(
      "Unrecognized reels format — expected instagram-reel-scraper export",
    );
    process.exit(1);
  }
  reels = flattenInstagramReels(reelsParsed);
}

const result = buildInstagramPeopleResult({
  companyHandle: "kossof_salonspa",
  profiles: profileParsed as RawInstagramProfile[],
  posts: postsParsed as RawInstagramPost[],
  reels,
});

const outDir = path.join(process.cwd(), "data", "snapshots");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${handle}.json`);
fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf-8");

console.log(`Instagram people snapshot → ${result.people.length} employees`);
for (const person of result.people) {
  const posts = person.result?.posts ?? [];
  const reelCount = posts.filter(
    (post) => (post.postType ?? "").toLowerCase() === "reel",
  ).length;
  const plays = posts.reduce((sum, post) => sum + (post.videoPlayCount ?? 0), 0);
  const nodes = person.result?.graph.nodes.length ?? 0;
  console.log(
    `  ${person.available ? "✓" : "×"} @${person.username} (${person.fullName})` +
      (person.available
        ? ` — ${posts.length} posts (${reelCount} reels, ${plays} views), ${nodes} graph people`
        : ` — ${person.unavailableReason}`),
  );
}
console.log(`Wrote ${outFile}`);

const companyFile = path.join(outDir, "kossof-instagram.json");
const companyHandle = "kossof_salonspa";
const companyReels = reels.filter(
  (reel) =>
    (reel.ownerUsername ?? "").replace(/^@/, "").trim().toLowerCase() ===
    companyHandle,
);
if (fs.existsSync(companyFile) && companyReels.length > 0) {
  const parsed: unknown = JSON.parse(fs.readFileSync(companyFile, "utf-8"));
  const company = parsed as ScrapeResult;
  if (company?.platform === "instagram" && Array.isArray(company.posts)) {
    const before = company.posts.length;
    company.posts = mergeReelsIntoProfilePosts(company.posts, companyReels);
    fs.writeFileSync(companyFile, JSON.stringify(company, null, 2) + "\n", "utf-8");
    const plays = company.posts.reduce(
      (sum, post) => sum + (post.videoPlayCount ?? 0),
      0,
    );
    const reelCount = company.posts.filter(
      (post) => (post.postType ?? "").toLowerCase() === "reel",
    ).length;
    console.log(
      `Merged ${companyReels.length} salon reels into kossof-instagram.json` +
        ` (${before} → ${company.posts.length} posts, ${reelCount} reels, ${plays} views)`,
    );
  }
}
