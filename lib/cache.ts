import { kv } from "@vercel/kv";
import type { ScrapeResult } from "./types";
import type { ScrapeBudget } from "./scrapeBudget";
import { budgetCacheSuffix, normalizeScrapeBudget } from "./scrapeBudget";

// Cache scrape results to avoid re-running (slow, paid) Apify actors.
// Falls back to an in-process Map when Vercel KV isn't configured (local dev).

const TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS ?? 60 * 60 * 24);
const CACHE_VERSION = "v12";

export function kvConfigured(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN,
  );
}

const memory = new Map<string, { value: ScrapeResult; expires: number }>();

function key(handle: string, budget: Partial<ScrapeBudget>): string {
  const normalized = normalizeScrapeBudget(budget);
  return `graph:${CACHE_VERSION}:${handle.replace(/^@/, "").toLowerCase()}:${budgetCacheSuffix(normalized)}`;
}

export async function getCached(
  handle: string,
  budget: Partial<ScrapeBudget>,
): Promise<ScrapeResult | null> {
  const k = key(handle, budget);
  if (kvConfigured()) {
    try {
      return (await kv.get<ScrapeResult>(k)) ?? null;
    } catch {
      return null;
    }
  }
  const hit = memory.get(k);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    memory.delete(k);
    return null;
  }
  return hit.value;
}

export async function setCached(
  handle: string,
  budget: Partial<ScrapeBudget>,
  value: ScrapeResult,
): Promise<void> {
  const k = key(handle, budget);
  if (kvConfigured()) {
    try {
      await kv.set(k, value, { ex: TTL_SECONDS });
    } catch {
      // best-effort cache; ignore write failures
    }
    return;
  }
  memory.set(k, { value, expires: Date.now() + TTL_SECONDS * 1000 });
}
