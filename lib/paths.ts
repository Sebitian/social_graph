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

/** Public share path for a pinned snapshot. Diandra's demo lives at `/demo`. */
export function pinnedGraphPath(handle: string): string {
  const clean = handle.replace(/^@/, "").trim().toLowerCase();
  if (clean === DEMO_HANDLE) return "/demo";
  return `/graph/${clean}/pinned`;
}
