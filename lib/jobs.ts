import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { head, put } from "@vercel/blob";
import { blobConfigured } from "./blob";
import {
  catalogJobById,
  catalogJobForHandle,
  catalogJobMatchesPlatform,
  accountRunLabel,
  jobPath,
  normalizeHandle,
  normalizeJobId,
  RUN_PLATFORMS,
  SHOWCASE_JOBS,
  type CatalogJob,
  type JobLane,
  type RunPlatform,
} from "./jobCatalog";
import { getNetwork, getSpotifyTaste } from "./scrape";
import {
  readCompanySnapshot,
  readConferenceSnapshot,
  readInstagramPeopleSnapshot,
  readSnapshot,
  readSpotifySnapshot,
  readTikTokSnapshot,
} from "./snapshot";
import type { CompanyResult } from "./companyTypes";
import type { ConferenceResult } from "./conferenceTypes";
import type { InstagramPeopleResult } from "./instagramPeople";
import type { SpotifyTasteResult } from "./spotifyTypes";
import { isSpotifyTasteResult } from "./spotifyTypes";
import type { TikTokResult } from "./tiktokTypes";
import type { ScrapeResult, SocialSourcePlatform } from "./types";

const JOBS_DIR = path.join(process.cwd(), "data", "jobs");
const JOB_BLOB_PREFIX = "jobs";
const INSTAGRAM_PEOPLE_SOURCE = "kossof-instagram-people";

export type JobPart =
  | { kind: "social-snapshot"; handle: string }
  | { kind: "social-result"; result: ScrapeResult }
  | { kind: "spotify-snapshot"; handle: string }
  | { kind: "spotify-result"; result: SpotifyTasteResult }
  | { kind: "tiktok-snapshot"; handle: string }
  | { kind: "company-snapshot"; handle: string }
  | { kind: "conference-snapshot"; handle: string };

export interface StoredJob {
  id: string;
  createdAt: number;
  title: string;
  /** `{name}-{platform}`, or `{name}-all` when one run holds several platforms. */
  label: string;
  lane: JobLane;
  parts: JobPart[];
}

export type ResolvedJob =
  | { kind: "bundle"; title: string }
  | { kind: "aiman"; title: string }
  | {
      kind: "graph";
      title: string;
      handle: string;
      initialData: ScrapeResult | null;
      initialPlatformData: Partial<Record<SocialSourcePlatform, ScrapeResult>>;
      spotifyData: SpotifyTasteResult | null;
      companyData: CompanyResult | null;
      tiktokData: TikTokResult | null;
      instagramPeopleData: InstagramPeopleResult | null;
      conferenceData: ConferenceResult | null;
    };

export type StartJobResult = { url: string } | { error: string };

function jobFile(id: string): string {
  return path.join(JOBS_DIR, `${id}.json`);
}

function jobBlobPath(id: string): string {
  return `${JOB_BLOB_PREFIX}/${id}.json`;
}

function blankGraph(
  title: string,
  handle: string,
): Extract<ResolvedJob, { kind: "graph" }> {
  return {
    kind: "graph",
    title,
    handle,
    initialData: null,
    initialPlatformData: {},
    spotifyData: null,
    companyData: null,
    tiktokData: null,
    instagramPeopleData: null,
    conferenceData: null,
  };
}

function socialPlatformOf(result: ScrapeResult): SocialSourcePlatform {
  if (result.platform) return result.platform;
  return result.posts?.length ? "linkedin" : "instagram";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isSocialResult(value: unknown): value is ScrapeResult {
  return isRecord(value) && "profile" in value && "graph" in value;
}

function parsePart(value: unknown): JobPart | null {
  if (!isRecord(value) || typeof value.kind !== "string") return null;
  if (
    (value.kind === "social-snapshot" ||
      value.kind === "spotify-snapshot" ||
      value.kind === "tiktok-snapshot" ||
      value.kind === "company-snapshot" ||
      value.kind === "conference-snapshot") &&
    typeof value.handle === "string"
  ) {
    return { kind: value.kind, handle: value.handle };
  }
  if (value.kind === "social-result" && isSocialResult(value.result)) {
    return { kind: "social-result", result: value.result };
  }
  if (value.kind === "spotify-result" && isSpotifyTasteResult(value.result)) {
    return { kind: "spotify-result", result: value.result };
  }
  return null;
}

function parseStoredJob(value: unknown): StoredJob | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  if (!Array.isArray(value.parts)) return null;
  const parts = value.parts
    .map(parsePart)
    .filter((part): part is JobPart => part !== null);
  if (!parts.length) return null;
  const id = normalizeJobId(value.id) ?? value.id;
  return {
    id,
    createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now(),
    title: typeof value.title === "string" ? value.title : "Run",
    label: typeof value.label === "string" ? value.label : "run",
    lane: value.lane === "conference" ? "conference" : "account",
    parts,
  };
}

export interface JobIndexEntry {
  id: string;
  title: string;
  /** Person, salon, or event. The right sidebar groups runs by this. */
  subject: string;
  label: string;
  lane: JobLane;
  href: string;
  /** Catalog-only: what kind of run this is. */
  kind?: CatalogJob["kind"];
  /** Catalog-only: the source network for social runs. */
  platform?: RunPlatform;
}

function platformFromLabel(label: string): RunPlatform | undefined {
  for (const platform of RUN_PLATFORMS) {
    if (label.endsWith(`-${platform}`)) return platform;
  }
  return undefined;
}

/** Catalog runs plus any JSON files in data/jobs, for the private file list. */
export function listJobIndex(): JobIndexEntry[] {
  const entries: JobIndexEntry[] = SHOWCASE_JOBS.map((job) => ({
    id: job.id,
    title: job.title,
    subject: job.subject,
    label: job.label,
    lane: job.lane,
    href: jobPath(job.id),
    kind: job.kind,
    platform: job.platform,
  }));
  const seen = new Set(entries.map((entry) => entry.id));
  if (!fs.existsSync(JOBS_DIR)) return entries;
  for (const name of fs.readdirSync(JOBS_DIR)) {
    if (!name.endsWith(".json")) continue;
    const id = name.slice(0, -".json".length);
    if (seen.has(id)) continue;
    let stored: StoredJob | null = null;
    try {
      stored = parseStoredJob(
        JSON.parse(fs.readFileSync(path.join(JOBS_DIR, name), "utf-8")),
      );
    } catch {
      stored = null;
    }
    if (!stored) continue;
    seen.add(stored.id);
    entries.push({
      id: stored.id,
      title: stored.title,
      subject: stored.title,
      label: stored.label,
      lane: stored.lane,
      href: pathForRun(stored.lane, stored.label, stored.id),
      platform: platformFromLabel(stored.label),
    });
  }
  return entries;
}

export function pathForRun(lane: JobLane, label: string, id: string): string {
  if (lane === "conference") return `/jobs/conferences/${label}/${id}`;
  return `/jobs/${label}/${id}`;
}

export async function canonicalJobPath(id: string): Promise<string | null> {
  const clean = normalizeJobId(id);
  if (!clean) return null;
  const known = catalogJobById(clean);
  if (known) return jobPath(known.id);
  const stored = await readStoredJob(clean);
  if (!stored) return null;
  return pathForRun(stored.lane, stored.label, stored.id);
}

async function readStoredJob(id: string): Promise<StoredJob | null> {
  if (blobConfigured()) {
    try {
      const meta = await head(jobBlobPath(id));
      const response = await fetch(meta.downloadUrl);
      if (response.ok) {
        const parsed = parseStoredJob(await response.json());
        if (parsed) return parsed;
      }
    } catch {
      // Fall through to disk.
    }
  }

  const file = jobFile(id);
  if (!fs.existsSync(file)) return null;
  try {
    return parseStoredJob(JSON.parse(fs.readFileSync(file, "utf-8")));
  } catch {
    return null;
  }
}

async function writeStoredJob(job: StoredJob): Promise<void> {
  const payload = JSON.stringify(job);
  fs.mkdirSync(JOBS_DIR, { recursive: true });
  fs.writeFileSync(jobFile(job.id), payload, "utf-8");

  if (blobConfigured()) {
    await put(jobBlobPath(job.id), payload, {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  }
}

function addSocial(
  view: Extract<ResolvedJob, { kind: "graph" }>,
  result: ScrapeResult,
) {
  const platform = socialPlatformOf(result);
  view.initialPlatformData[platform] = result;
  if (!view.initialData) {
    view.initialData = result;
    view.handle = result.profile.username || view.handle;
  }
}

async function resolveCatalog(job: CatalogJob): Promise<ResolvedJob | null> {
  if (job.kind === "bundle") return { kind: "bundle", title: job.title };
  if (job.kind === "aiman") return { kind: "aiman", title: job.title };

  const view = blankGraph(job.title, job.source);

  if (job.kind === "social") {
    const snapshot = await readSnapshot(job.source);
    if (!snapshot) return null;
    addSocial(view, snapshot);
    if (job.instagramPeopleSource) {
      view.instagramPeopleData = await readInstagramPeopleSnapshot(
        job.instagramPeopleSource,
      );
    }
    return view;
  }

  if (job.kind === "company") {
    view.companyData = await readCompanySnapshot(job.source);
    return view.companyData ? view : null;
  }

  if (job.kind === "spotify") {
    view.spotifyData = await readSpotifySnapshot(job.source);
    return view.spotifyData ? view : null;
  }

  if (job.kind === "tiktok") {
    view.tiktokData = await readTikTokSnapshot(job.source);
    return view.tiktokData ? view : null;
  }

  if (job.kind === "conference") {
    view.conferenceData = await readConferenceSnapshot(job.source);
    return view.conferenceData ? view : null;
  }

  return null;
}

async function resolveStored(job: StoredJob): Promise<ResolvedJob | null> {
  const view = blankGraph(job.title, job.title.replace(/^@/, ""));
  let people = false;

  for (const part of job.parts) {
    if (part.kind === "social-snapshot") {
      const snapshot = await readSnapshot(part.handle);
      if (!snapshot) continue;
      addSocial(view, snapshot);
      if (part.handle === "kossof-instagram") people = true;
      continue;
    }
    if (part.kind === "social-result") {
      addSocial(view, part.result);
      continue;
    }
    if (part.kind === "spotify-snapshot") {
      view.spotifyData = await readSpotifySnapshot(part.handle);
      continue;
    }
    if (part.kind === "spotify-result") {
      view.spotifyData = part.result;
      continue;
    }
    if (part.kind === "tiktok-snapshot") {
      view.tiktokData = await readTikTokSnapshot(part.handle);
      continue;
    }
    if (part.kind === "company-snapshot") {
      view.companyData = await readCompanySnapshot(part.handle);
      continue;
    }
    if (part.kind === "conference-snapshot") {
      view.conferenceData = await readConferenceSnapshot(part.handle);
    }
  }

  if (people) {
    view.instagramPeopleData = await readInstagramPeopleSnapshot(
      INSTAGRAM_PEOPLE_SOURCE,
    );
  }

  const hasGraph =
    view.initialData ||
    view.spotifyData ||
    view.companyData ||
    view.tiktokData ||
    view.conferenceData;
  return hasGraph ? view : null;
}

export async function readJobTitle(id: string): Promise<string | null> {
  const clean = normalizeJobId(id);
  if (!clean) return null;
  const known = catalogJobById(clean);
  if (known) return known.title;
  const stored = await readStoredJob(clean);
  return stored?.title ?? null;
}

export async function resolveJob(id: string): Promise<ResolvedJob | null> {
  const clean = normalizeJobId(id);
  if (!clean) return null;
  const known = catalogJobById(clean);
  if (known) return resolveCatalog(known);
  const stored = await readStoredJob(clean);
  if (!stored) return null;
  return resolveStored(stored);
}

function isRunPlatform(value: string): value is RunPlatform {
  return (RUN_PLATFORMS as readonly string[]).includes(value);
}

const PLATFORM_LABEL: Record<RunPlatform, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  spotify: "Spotify",
};

/**
 * Open a saved run, or store a new one and return /jobs/{id}.
 * Generated slices come from getNetwork / getSpotifyTaste. Those are still
 * sample data until live Apify is wired into getNetwork. The job file is the
 * place that result is shown.
 */
export async function openOrCreateJob(
  input: Partial<Record<string, string>>,
): Promise<StartJobResult> {
  const entries: { platform: RunPlatform; handle: string }[] = [];

  for (const [key, raw] of Object.entries(input)) {
    if (!raw || !isRunPlatform(key)) continue;
    const handle = normalizeHandle(raw);
    if (!/^[a-z0-9._-]{1,64}$/.test(handle)) {
      return { error: `Enter a valid ${PLATFORM_LABEL[key]} handle` };
    }
    entries.push({ platform: key, handle });
  }

  if (!entries.length) {
    return { error: "Add at least one handle to map your network" };
  }

  if (entries.length === 1) {
    const known = catalogJobForHandle(entries[0].handle);
    if (known && catalogJobMatchesPlatform(known, entries[0].platform)) {
      return { url: jobPath(known.id) };
    }
  }

  const parts: JobPart[] = [];
  const missing: string[] = [];

  for (const entry of entries) {
    const part = await partForEntry(entry.platform, entry.handle);
    if (!part) {
      missing.push(PLATFORM_LABEL[entry.platform]);
      continue;
    }
    parts.push(part);
  }

  if (missing.length) {
    return {
      error: `No saved ${missing.join(" or ")} run for that handle, and live scraping is not connected yet.`,
    };
  }

  const id = randomUUID();
  const label =
    entries.length === 1
      ? accountRunLabel(entries[0].handle, entries[0].platform)
      : accountRunLabel(entries[0].handle, "all");
  const stored: StoredJob = {
    id,
    createdAt: Date.now(),
    title: entries.map((entry) => `@${entry.handle}`).join(" · "),
    label,
    lane: "account",
    parts,
  };
  await writeStoredJob(stored);
  return { url: pathForRun("account", label, id) };
}

async function partForEntry(
  platform: RunPlatform,
  handle: string,
): Promise<JobPart | null> {
  const known = catalogJobForHandle(handle);
  if (known && catalogJobMatchesPlatform(known, platform)) {
    if (known.kind === "bundle" || known.kind === "social") {
      return { kind: "social-snapshot", handle: known.source };
    }
    if (known.kind === "spotify") {
      return { kind: "spotify-snapshot", handle: known.source };
    }
    if (known.kind === "tiktok") {
      return { kind: "tiktok-snapshot", handle: known.source };
    }
    if (known.kind === "company") {
      return { kind: "company-snapshot", handle: known.source };
    }
  }

  if (platform === "linkedin" || platform === "instagram" || platform === "facebook") {
    const snapshot = await readSnapshot(handle);
    if (snapshot && socialPlatformOf(snapshot) === platform) {
      return { kind: "social-snapshot", handle };
    }
    if (platform === "facebook") return null;
    try {
      const result = await getNetwork(handle, { platform });
      return {
        kind: "social-result",
        result: { ...result, platform, pinned: true },
      };
    } catch {
      return null;
    }
  }

  if (platform === "spotify") {
    const snapshot = await readSpotifySnapshot(handle);
    if (snapshot) return { kind: "spotify-snapshot", handle };
    try {
      const result = await getSpotifyTaste(handle);
      return { kind: "spotify-result", result: { ...result, pinned: true } };
    } catch {
      return null;
    }
  }

  if (platform === "tiktok") {
    const snapshot = await readTikTokSnapshot(handle);
    if (snapshot) return { kind: "tiktok-snapshot", handle };
    return null;
  }

  return null;
}
