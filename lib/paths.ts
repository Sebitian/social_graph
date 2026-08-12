/** Canonical demo handle (LinkedIn person + multi-platform companions). */
export const DEMO_HANDLE = "diandra";

/** Public share path for a pinned snapshot. Diandra's demo lives at `/demo`. */
export function pinnedGraphPath(handle: string): string {
  const clean = handle.replace(/^@/, "").trim().toLowerCase();
  if (clean === DEMO_HANDLE) return "/demo";
  return `/graph/${clean}/pinned`;
}
