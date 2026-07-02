import fs from "fs";
import path from "path";
import { buildScrapeResultFromRawComments } from "../lib/importRawComments";
import { blobConfigured } from "../lib/blob";
import { pinnedGraphPath, writeSnapshot } from "../lib/snapshot";

const args = process.argv.slice(2);
const pushFlag = args.includes("--push");
const filtered = args.filter((a) => a !== "--push");
const handle = filtered[0]?.replace(/^@/, "").trim().toLowerCase();
const jsonPath = filtered[1];
const site = filtered[2] ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

if (!handle || !jsonPath) {
  console.error(
    "Usage: npx tsx scripts/import-raw-snapshot.ts <handle> <comments.json> [--push] [site-url]",
  );
  process.exit(1);
}

const abs = path.resolve(jsonPath);
if (!fs.existsSync(abs)) {
  console.error(`File not found: ${abs}`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(abs, "utf-8"));
if (!Array.isArray(raw)) {
  console.error("JSON must be an array of comment objects");
  process.exit(1);
}

async function pushToRemote(result: Awaited<ReturnType<typeof buildScrapeResultFromRawComments>>) {
  const secret = process.env.SNAPSHOT_PIN_SECRET;
  if (!secret) {
    throw new Error("Set SNAPSHOT_PIN_SECRET to push snapshots to production.");
  }

  const res = await fetch(`${site.replace(/\/$/, "")}/api/snapshot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pin-secret": secret,
    },
    body: JSON.stringify(result),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
  return json as { url: string; storage: string };
}

async function main() {
  const result = buildScrapeResultFromRawComments(handle, raw);
  const saved = await writeSnapshot(handle, result);

  console.log(`Imported ${raw.length} comments → ${result.stats.shown} people on graph`);
  console.log(`Local file (gitignored): data/snapshots/${saved}.json`);

  if (blobConfigured()) {
    console.log("Vercel Blob: snapshot uploaded (BLOB_READ_WRITE_TOKEN detected)");
  } else {
    console.log("Vercel Blob: not configured — snapshot is local disk only");
  }

  if (pushFlag) {
    const remote = await pushToRemote(result);
    console.log(`Production push: ${remote.storage} @ ${remote.url}`);
  } else {
    console.log(`Open locally: ${site}${pinnedGraphPath(saved)}`);
    console.log("To upload after Vercel deploy: re-run with --push and your live URL");
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
