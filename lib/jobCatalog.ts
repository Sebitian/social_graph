/** Public runs. The id is the share link. There is no /jobs index. */

export const DEMO_JOB_ID = "6f0c2a84-1b57-4e93-9d20-8a4c7e1f3b65";

export const RUN_PLATFORMS = [
  "linkedin",
  "instagram",
  "facebook",
  "tiktok",
  "spotify",
] as const;

export type RunPlatform = (typeof RUN_PLATFORMS)[number];

export type CatalogJobKind =
  | "bundle"
  | "social"
  | "company"
  | "spotify"
  | "tiktok"
  | "conference"
  | "aiman";

export type JobLane = "account" | "conference";

export interface CatalogJob {
  id: string;
  title: string;
  detail: string;
  /** Who this run belongs to. Accounts group by this. Conferences are their own lane. */
  subject: string;
  /**
   * Path label. Accounts are `{name}-{platform}` (`kossof-salon-facebook`).
   * Conferences are the event name only (`romanian`).
   */
  label: string;
  lane: JobLane;
  kind: CatalogJobKind;
  /** Snapshot file stem, or the builtin page key. */
  source: string;
  aliases: string[];
  /** Social snapshots: which network the file is. */
  platform?: "linkedin" | "instagram" | "facebook";
  /** Instagram company runs also load the person dropdown. */
  instagramPeopleSource?: string;
}

export const SHOWCASE_JOBS: CatalogJob[] = [
  {
    id: DEMO_JOB_ID,
    title: "Diandra",
    detail: "LinkedIn, with Instagram, Facebook, TikTok, Spotify, and company beside it",
    subject: "Diandra",
    label: "diandra-all",
    lane: "account",
    kind: "bundle",
    source: "diandra",
    aliases: ["diandra"],
    platform: "linkedin",
  },
  {
    id: "c3a91e70-5d24-4b8f-a617-2e0b9c4d8f13",
    title: "Romanian Conference",
    detail: "Guest list, companies, and attendees",
    subject: "Romanian Conference",
    label: "romanian",
    lane: "conference",
    kind: "conference",
    source: "romanian",
    aliases: ["romanian"],
  },
  {
    id: "e7b4d012-8c36-4a5f-9e81-1d6f0a3c7b29",
    title: "Aiman FMA",
    detail: "Two reels, the loudest commenters, and who replied to them",
    subject: "Aiman",
    label: "aiman-fma",
    lane: "account",
    kind: "aiman",
    source: "aiman-fma",
    aliases: ["aiman-fma"],
  },
  {
    id: "f3a8c1d6-4e20-4b97-9a15-7d2e0c6b8f41",
    title: "Aiman Instagram",
    detail: "Posts, reels, comments, and engagers",
    subject: "Aiman",
    label: "aiman-instagram",
    lane: "account",
    kind: "social",
    source: "aiman-instagram",
    aliases: ["aiman-instagram", "nuancedaiman"],
    platform: "instagram",
  },
  {
    id: "2a7e9c14-6b80-4f31-9d45-8c1b0e6a3f78",
    title: "Kossof Instagram",
    detail: "Salon posts, comments, reactions, and people",
    subject: "Kossof Salon",
    label: "kossof-salon-instagram",
    lane: "account",
    kind: "social",
    source: "kossof-instagram",
    aliases: ["kossof-instagram", "kossof_salonspa"],
    platform: "instagram",
    instagramPeopleSource: "kossof-instagram-people",
  },
  {
    id: "b5c0e287-3a49-4d16-8f70-1e9a4c6b2d05",
    title: "Kossof Facebook",
    detail: "Page followers, following, and post engagers",
    subject: "Kossof Salon",
    label: "kossof-salon-facebook",
    lane: "account",
    kind: "social",
    source: "kossof-facebook",
    aliases: ["kossof-facebook", "kossof-salon-spa-61582500130935"],
    platform: "facebook",
  },
  {
    id: "8f1d6a30-4c72-4b9e-a053-7d2e5b8c1f64",
    title: "Kossof TikTok",
    detail: "Videos, hashtags, and likes",
    subject: "Kossof Salon",
    label: "kossof-salon-tiktok",
    lane: "account",
    kind: "tiktok",
    source: "kossof-tiktok",
    aliases: ["kossof-tiktok", "kossof.salon.spa"],
  },
  {
    id: "0e4a7b92-5d18-4c63-9f20-6a3c1e8d4b57",
    title: "Sebastian Spotify",
    detail: "Playlists, genres, and taste",
    subject: "Sebastian",
    label: "sebastian-spotify",
    lane: "account",
    kind: "spotify",
    source: "sebastian-spotify",
    aliases: ["sebastian-spotify", "sebastian"],
  },
  {
    id: "7b2c5e08-9a41-4d76-b3f1-0c8e6a4d1f39",
    title: "Formation Bio",
    detail: "Employee roster, locations, and tenure",
    subject: "Formation Bio",
    label: "formation-bio-company",
    lane: "account",
    kind: "company",
    source: "formationbio",
    aliases: ["formationbio", "formation-bio"],
  },
  {
    id: "4d8b1f36-a0c5-4e72-8b94-3f6a1c0e7d52",
    title: "Nous Research",
    detail: "Employee roster",
    subject: "Nous Research",
    label: "nous-research-company",
    lane: "account",
    kind: "company",
    source: "nousresearch",
    aliases: ["nousresearch", "nous-research"],
  },
];

const JOB_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const byId = new Map<string, CatalogJob>();
const byAlias = new Map<string, CatalogJob>();

for (const job of SHOWCASE_JOBS) {
  byId.set(job.id, job);
  for (const alias of [job.source, ...job.aliases]) {
    byAlias.set(normalizeHandle(alias), job);
  }
}

export function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, "").trim().toLowerCase();
}

export function normalizeJobId(id: string): string | null {
  const clean = id.trim().toLowerCase();
  return JOB_ID_RE.test(clean) ? clean : null;
}

/** Accounts: /jobs/{name}-{platform}/{run}. Conferences: /jobs/conferences/{name}/{run}. */
export function jobPath(id: string): string {
  const job = catalogJobById(id);
  if (!job) return `/jobs/${id}`;
  if (job.lane === "conference") return `/jobs/conferences/${job.label}/${job.id}`;
  return `/jobs/${job.label}/${job.id}`;
}

/** Slug for a new account run. A second scrape of the same handle keeps this prefix. */
export function accountRunLabel(handle: string, platform: string): string {
  const name = handle
    .replace(/^@/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${name}-${platform}`;
}

export function catalogJobById(id: string): CatalogJob | null {
  const clean = normalizeJobId(id);
  if (!clean) return null;
  return byId.get(clean) ?? null;
}

export function catalogJobForHandle(handle: string): CatalogJob | null {
  const clean = normalizeHandle(handle);
  if (!clean) return null;
  return byAlias.get(clean) ?? null;
}

/** True when this saved run is the right page for that form field. */
export function catalogJobMatchesPlatform(
  job: CatalogJob,
  platform: RunPlatform,
): boolean {
  if (job.kind === "bundle") return platform === "linkedin";
  if (job.kind === "aiman") return platform === "instagram";
  if (job.kind === "company") return platform === "linkedin";
  if (job.kind === "spotify") return platform === "spotify";
  if (job.kind === "tiktok") return platform === "tiktok";
  if (job.kind === "social") return job.platform === platform;
  return false;
}
