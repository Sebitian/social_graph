import fs from "fs";
import path from "path";
import { head, put } from "@vercel/blob";
import type { ScrapeResult } from "./types";
import { blobConfigured } from "./blob";

const SNAPSHOT_DIR = path.join(process.cwd(), "data", "snapshots");
const SNAPSHOT_BLOB_PREFIX = "snapshots";

function cleanHandle(handle: string): string {
  return handle.replace(/^@/, "").trim().toLowerCase();
}

function snapshotPath(handle: string): string {
  return path.join(SNAPSHOT_DIR, `${cleanHandle(handle)}.json`);
}

function snapshotBlobPathname(handle: string): string {
  return `${SNAPSHOT_BLOB_PREFIX}/${cleanHandle(handle)}.json`;
}

function normalizeSnapshot(parsed: ScrapeResult): ScrapeResult {
  return {
    ...parsed,
    cached: true,
    demo: false,
    pinned: true,
  };
}

function readSnapshotFromDisk(handle: string): ScrapeResult | null {
  const file = snapshotPath(handle);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = fs.readFileSync(file, "utf-8");
    return normalizeSnapshot(JSON.parse(raw) as ScrapeResult);
  } catch {
    return null;
  }
}

function writeSnapshotToDisk(handle: string, payload: ScrapeResult): void {
  const clean = cleanHandle(handle);
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  fs.writeFileSync(snapshotPath(clean), JSON.stringify(payload, null, 2), "utf-8");
}

async function readSnapshotFromBlob(handle: string): Promise<ScrapeResult | null> {
  const pathname = snapshotBlobPathname(handle);
  try {
    const meta = await head(pathname);
    const response = await fetch(meta.downloadUrl);
    if (!response.ok) return null;
    return normalizeSnapshot((await response.json()) as ScrapeResult);
  } catch {
    return null;
  }
}

async function writeSnapshotToBlob(handle: string, payload: ScrapeResult): Promise<void> {
  const pathname = snapshotBlobPathname(handle);
  await put(pathname, JSON.stringify(payload), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

async function blobSnapshotExists(handle: string): Promise<boolean> {
  try {
    await head(snapshotBlobPathname(handle));
    return true;
  } catch {
    return false;
  }
}

/** True if a pinned snapshot exists in Blob and/or on disk. */
export async function hasSnapshot(handle: string): Promise<boolean> {
  const clean = cleanHandle(handle);

  if (blobConfigured()) {
    if (await blobSnapshotExists(clean)) return true;
  }

  return fs.existsSync(snapshotPath(clean));
}

/**
 * Read a pinned snapshot (no Apify).
 * Production: Vercel Blob. Local dev: Blob if configured, else gitignored file on disk.
 */
export async function readSnapshot(handle: string): Promise<ScrapeResult | null> {
  const clean = cleanHandle(handle);

  if (blobConfigured()) {
    const fromBlob = await readSnapshotFromBlob(clean);
    if (fromBlob) return fromBlob;
  }

  return readSnapshotFromDisk(clean);
}

/**
 * Persist a scrape result for the pinned share route.
 * Writes to Vercel Blob when configured (production) and always to local disk (dev).
 */
export async function writeSnapshot(
  handle: string,
  result: ScrapeResult,
): Promise<string> {
  const clean = cleanHandle(handle);
  const payload: ScrapeResult = {
    ...result,
    pinned: true,
    cached: true,
    scrapedAt: result.scrapedAt ?? Date.now(),
  };

  writeSnapshotToDisk(clean, payload);

  if (blobConfigured()) {
    try {
      await writeSnapshotToBlob(clean, payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Blob write failed";
      throw new Error(`Snapshot saved locally but Blob upload failed: ${message}`);
    }
  }

  return clean;
}

export function pinnedGraphPath(handle: string): string {
  return `/graph/${cleanHandle(handle)}/pinned`;
}

export type SnapshotStorage = "blob" | "disk" | "none";

/** Where the snapshot was stored after write. */
export async function snapshotStorageFor(handle: string): Promise<SnapshotStorage> {
  const clean = cleanHandle(handle);
  if (blobConfigured() && (await blobSnapshotExists(clean))) return "blob";
  return fs.existsSync(snapshotPath(clean)) ? "disk" : "none";
}
