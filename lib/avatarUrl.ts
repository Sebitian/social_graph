/** Live Instagram avatar proxy — scraped CDN URLs expire quickly. */
export function instagramAvatarUrl(username: string): string {
  const handle = username.replace(/^@/, "").trim().toLowerCase();
  return `/api/avatar/instagram/${encodeURIComponent(handle)}`;
}

/** Live LinkedIn avatar proxy — signed media.licdn.com URLs expire. */
export function linkedinAvatarUrl(username: string): string {
  const handle = username
    .replace(/^@/, "")
    .replace(/^in\//, "")
    .trim()
    .toLowerCase();
  return `/api/avatar/linkedin/${encodeURIComponent(handle)}`;
}

/** Same-origin proxy for scraped CDN URLs (canvas-safe, referer-friendly). */
export function proxiedAvatarUrl(remoteUrl: string): string {
  return `/api/avatar/image?url=${encodeURIComponent(remoteUrl)}`;
}

/**
 * LinkedIn (and similar) signed CDN URLs carry unix-seconds `e=`.
 * After that timestamp the CDN returns 403 "Invalid e query string".
 */
export function isSignedMediaExpired(
  remoteUrl: string,
  skewMs = 60_000,
): boolean {
  try {
    const raw = new URL(remoteUrl).searchParams.get("e");
    if (!raw) return false;
    const expiry = Number(raw);
    if (!Number.isFinite(expiry) || expiry <= 0) return false;
    const expMs = expiry < 1e12 ? expiry * 1000 : expiry;
    return expMs + skewMs < Date.now();
  } catch {
    return false;
  }
}

/** Proxy a remote photo unless its signed CDN expiry has already passed. */
export function proxiedAvatarUrlIfFresh(
  remoteUrl: string,
): string | undefined {
  const scraped = remoteUrl.trim();
  if (!scraped) return undefined;
  if (!/^https?:\/\//i.test(scraped)) return scraped;
  if (isSignedMediaExpired(scraped)) return undefined;
  return proxiedAvatarUrl(scraped);
}

export type AvatarPlatform =
  | "instagram"
  | "linkedin"
  | "facebook"
  | "spotify"
  | null
  | undefined;

/**
 * Prefer a live platform proxy when CDN links go stale; otherwise proxy the
 * scraped URL so canvas nodes can paint photos without CORS/referer issues.
 */
export function resolveProfilePicUrl(
  username: string,
  profilePicUrl: string | undefined,
  platform?: AvatarPlatform,
): string | undefined {
  const handle = username.replace(/^@/, "").trim();
  const scraped = profilePicUrl?.trim();

  // Live proxies need a handle; only use them when we already had a photo in
  // the scrape (keeps empty mock nodes offline).
  if (platform === "instagram" && handle && scraped) {
    return instagramAvatarUrl(handle);
  }

  if (scraped) {
    // Facebook / LinkedIn CDN / leftover IG CDN — same-origin proxy for canvas.
    // Skip expired signed URLs so the graph shows initials instead of 502s.
    return proxiedAvatarUrlIfFresh(scraped);
  }
  return undefined;
}
