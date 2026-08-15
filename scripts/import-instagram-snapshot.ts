import fs from "fs";
import path from "path";
import {
  buildScrapeResultFromInstagramRaw,
  flattenInstagramFollowers,
  flattenInstagramReels,
  isInstagramCommentsDataset,
  isInstagramFollowersDataset,
  isInstagramPostsDataset,
  isInstagramProfileDataset,
  isInstagramReelsDataset,
  type RawInstagramComment,
  type RawInstagramPost,
  type RawInstagramProfile,
} from "../lib/importInstagramRaw";

/**
 * Usage:
 *   npx tsx scripts/import-instagram-snapshot.ts <handle> \
 *     --profile <profile.json> \
 *     --posts <posts.json> \
 *     [--reels <reels.json>] \
 *     [--comments <comments.json>] \
 *     [--followers <followers.json>] \
 *     [--no-soft-presence]
 *
 * Example:
 *   npx tsx scripts/import-instagram-snapshot.ts kossof-instagram \
 *     --profile data/insta_raw/dataset_instagram-profile-scraper_*.json \
 *     --posts data/insta_raw/dataset_instagram-post-scraper_*.json \
 *     --reels data/insta_raw/dataset_instagram-reel-scraper_*.json \
 *     --comments data/insta_raw/dataset_instagram-comment-scraper_*.json \
 *     --followers data/insta_raw/dataset_instagram-followers-scraper_*.json \
 *     --no-soft-presence
 */
function parseArgs(argv: string[]) {
  const handle = argv[0]?.replace(/^@/, "").trim().toLowerCase();
  const flags: Record<string, string> = {};
  const boolFlags = new Set<string>();
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      boolFlags.add(key);
      continue;
    }
    flags[key] = value;
    i += 1;
  }
  return { handle, flags, boolFlags };
}

const { handle, flags, boolFlags } = parseArgs(process.argv.slice(2));

if (!handle || !flags.posts) {
  console.error(
    "Usage: npx tsx scripts/import-instagram-snapshot.ts <handle> --posts <posts.json> [--profile <profile.json>] [--reels <reels.json>] [--comments <comments.json>] [--followers <followers.json>] [--no-soft-presence]",
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

const postsParsed = readJson(flags.posts);
if (!isInstagramPostsDataset(postsParsed)) {
  console.error("Unrecognized posts format — expected instagram-post-scraper export");
  process.exit(1);
}

let profile: RawInstagramProfile | null = null;
if (flags.profile) {
  const profileParsed = readJson(flags.profile);
  if (!isInstagramProfileDataset(profileParsed)) {
    console.error(
      "Unrecognized profile format — expected instagram-profile-scraper export",
    );
    process.exit(1);
  }
  profile = (profileParsed as RawInstagramProfile[])[0] ?? null;
}

let reels = [] as ReturnType<typeof flattenInstagramReels>;
if (flags.reels) {
  const reelsParsed = readJson(flags.reels);
  if (!isInstagramReelsDataset(reelsParsed)) {
    console.error("Unrecognized reels format — expected instagram-reel-scraper export");
    process.exit(1);
  }
  reels = flattenInstagramReels(reelsParsed);
}

let comments: RawInstagramComment[] = [];
if (flags.comments) {
  const commentsParsed = readJson(flags.comments);
  if (!isInstagramCommentsDataset(commentsParsed)) {
    console.error(
      "Unrecognized comments format — expected instagram-comment-scraper export",
    );
    process.exit(1);
  }
  comments = commentsParsed as RawInstagramComment[];
}

let followers = [] as ReturnType<typeof flattenInstagramFollowers>;
if (flags.followers) {
  const followersParsed = readJson(flags.followers);
  if (!isInstagramFollowersDataset(followersParsed)) {
    console.error(
      "Unrecognized followers format — expected instagram-followers-scraper export",
    );
    process.exit(1);
  }
  followers = flattenInstagramFollowers(followersParsed);
}

const result = buildScrapeResultFromInstagramRaw(handle, {
  profile,
  posts: postsParsed as RawInstagramPost[],
  reels,
  comments,
  followers,
  includeSoftPresence: !boolFlags.has("no-soft-presence"),
});

const outDir = path.join(process.cwd(), "data", "snapshots");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${handle}.json`);
fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf-8");

const likes = (result.posts ?? []).reduce(
  (sum, p) => sum + (p.likesCount ?? 0),
  0,
);
const plays = (result.posts ?? []).reduce(
  (sum, p) => sum + (p.videoPlayCount ?? 0),
  0,
);

console.log(
  `Instagram snapshot → ${result.profile.fullName} (@${result.profile.username})`,
);
console.log(
  `  ${result.posts?.length ?? 0} posts, ${result.stats.shown} graph people, ${result.engagers?.length ?? 0} engagers, ${result.stats.totalComments} comments`,
);
console.log(`  aggregate likes=${likes}, reel plays=${plays}, followers=${result.profile.followersCount}`);
console.log(`Wrote ${outFile}`);
