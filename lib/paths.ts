import { catalogJobForHandle, jobPath } from "./jobCatalog";

/** Canonical demo handle (LinkedIn person + multi-platform companions). */
export const DEMO_HANDLE = "diandra";

/** Extra platform demos loaded alongside the primary pinned handle. */
export const COMPANION_SNAPSHOTS = {
  instagram: "kossof-instagram",
  instagramPeople: "kossof-instagram-people",
  spotify: "sebastian-spotify",
  company: "formationbio",
  facebook: "kossof-facebook",
  tiktok: "kossof-tiktok",
} as const;

/** Public share path. Known runs live at /jobs/{name}-{platform}/{id}. */
export function pinnedGraphPath(handle: string): string {
  const clean = handle.replace(/^@/, "").trim().toLowerCase();
  const job = catalogJobForHandle(clean);
  if (job) return jobPath(job.id);
  return `/graph/${clean}/pinned`;
}
