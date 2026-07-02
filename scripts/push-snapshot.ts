import fs from "fs";
import path from "path";

/**
 * Upload an existing local snapshot JSON to production KV via /api/snapshot.
 *
 * Usage:
 *   SNAPSHOT_PIN_SECRET=xxx npx tsx scripts/push-snapshot.ts jp_jppap https://your-app.vercel.app
 */

const handle = process.argv[2]?.replace(/^@/, "").trim().toLowerCase();
const site = process.argv[3] ?? process.env.NEXT_PUBLIC_SITE_URL;

if (!handle || !site) {
  console.error(
    "Usage: SNAPSHOT_PIN_SECRET=... npx tsx scripts/push-snapshot.ts <handle> <site-url>",
  );
  process.exit(1);
}

const secret = process.env.SNAPSHOT_PIN_SECRET;
if (!secret) {
  console.error("Missing SNAPSHOT_PIN_SECRET");
  process.exit(1);
}

const file = path.join(process.cwd(), "data", "snapshots", `${handle}.json`);
if (!fs.existsSync(file)) {
  console.error(`No local snapshot at ${file}`);
  console.error("Run: npm run import-raw-snapshot -- <handle> <comments.json>");
  process.exit(1);
}

const body = JSON.parse(fs.readFileSync(file, "utf-8"));
const base = site.replace(/\/$/, "");

const res = await fetch(`${base}/api/snapshot`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-pin-secret": secret,
  },
  body: JSON.stringify(body),
});

const json = await res.json();
if (!res.ok) {
  console.error(json.error ?? `HTTP ${res.status}`);
  process.exit(1);
}

console.log(`Pinned @${json.handle} → ${json.storage}`);
console.log(`Share: ${json.url}`);
