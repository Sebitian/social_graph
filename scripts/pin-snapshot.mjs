#!/usr/bin/env node
/**
 * Save the latest cached scrape for a handle as a pinned snapshot (no Apify credits).
 *
 * Usage:
 *   npm run pin-snapshot -- yourhandle
 *   npm run pin-snapshot -- yourhandle path/to/export.json
 *
 * With no JSON path, fetches from the running dev server (uses server cache).
 * Start `npm run dev` first if you scraped in the browser recently.
 */

import fs from "fs";
import path from "path";

const handle = process.argv[2]?.replace(/^@/, "").trim().toLowerCase();
const jsonPath = process.argv[3];

if (!handle) {
  console.error("Usage: npm run pin-snapshot -- <handle> [path/to/result.json]");
  process.exit(1);
}

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const secret = process.env.SNAPSHOT_PIN_SECRET ?? "";

async function loadResult() {
  if (jsonPath) {
    const abs = path.resolve(jsonPath);
    if (!fs.existsSync(abs)) {
      throw new Error(`File not found: ${abs}`);
    }
    return JSON.parse(fs.readFileSync(abs, "utf-8"));
  }

  const url = `${site}/api/scrape?handle=${encodeURIComponent(handle)}`;
  console.log(`Fetching cached scrape from ${url} …`);
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
  if (json.demo) {
    console.warn("Warning: server returned demo data (APIFY_TOKEN not set).");
  }
  return json;
}

async function main() {
  const result = await loadResult();
  const headers = { "Content-Type": "application/json" };
  if (secret) headers["x-pin-secret"] = secret;

  const res = await fetch(`${site}/api/snapshot`, {
    method: "POST",
    headers,
    body: JSON.stringify(result),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }

  console.log(`Pinned @${json.handle}`);
  console.log(`Share link: ${json.url}`);
  console.log(`File: data/snapshots/${json.handle}.json`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
