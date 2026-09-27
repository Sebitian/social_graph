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
 * Repeat --profile / --posts / --reels to merge several salon-staff exports.
 * Aiman (@nuancedaiman) is a separate Instagram snapshot, not part of this roster.
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
  const lists: Record<"profile" | "posts" | "reels", string[]> = {
    profile: [],
    posts: [],
    reels: [],
  };
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      console.error(`Missing value for --${key}`);
      process.exit(1);
    }
    if (key === "profile" || key === "posts" || key === "reels") {
      lists[key].push(value);
    } else {
      console.error(`Unknown flag --${key}`);
      process.exit(1);
    }
    i += 1;
  }
  return { handle, lists };
}

const { handle, lists } = parseArgs(process.argv.slice(2));

if (!lists.profile.length || !lists.posts.length) {
  console.error(
    "Usage: npx tsx scripts/import-instagram-people-snapshot.ts [handle] --profile <profile.json> --posts <posts.json> [--reels <reels.json>] (flags may repeat)",
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

function concatArrays<T>(
  files: string[],
  check: (raw: unknown) => raw is T[],
  label: string,
): T[] {
  const out: T[] = [];
  for (const file of files) {
    const parsed = readJson(file);
    if (!check(parsed)) {
      console.error(`Unrecognized ${label} format: ${file}`);
      process.exit(1);
    }
    out.push(...parsed);
  }
  return out;
}

const profiles = concatArrays(
  lists.profile,
  isInstagramProfileDataset,
  "profile",
);
const posts = concatArrays(lists.posts, isInstagramPostsDataset, "posts");
const reels = lists.reels.length
  ? flattenInstagramReels(
      concatArrays(lists.reels, isInstagramReelsDataset, "reels"),
    )
  : [];

const result = buildInstagramPeopleResult({
  companyHandle: "kossof_salonspa",
  profiles,
  posts,
  reels,
});

const outDir = path.join(process.cwd(), "data", "snapshots");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${handle}.json`);
fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf-8");

console.log(`Instagram people snapshot → ${result.people.length} people`);
for (const person of result.people) {
  const personPosts = person.result?.posts ?? [];
  const reelCount = personPosts.filter(
    (post) => (post.postType ?? "").toLowerCase() === "reel",
  ).length;
  const plays = personPosts.reduce(
    (sum, post) => sum + (post.videoPlayCount ?? 0),
    0,
  );
  const nodes = person.result?.graph.nodes.length ?? 0;
  const role = person.role ?? "employee";
  console.log(
    `  ${person.available ? "✓" : "×"} @${person.username} (${person.fullName}) [${role}]` +
      (person.available
        ? ` — ${personPosts.length} posts (${reelCount} reels, ${plays} views), ${nodes} graph people`
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
