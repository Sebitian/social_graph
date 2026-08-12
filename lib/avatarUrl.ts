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
    // LinkedIn signed URLs expire (~30d); GraphVisualizer falls back to the
    // live /api/avatar/linkedin/:handle lookup when the scraped URL 403s.
    if (/^https?:\/\//i.test(scraped)) {
      return proxiedAvatarUrl(scraped);
    }
    return scraped;
  }
  return undefined;
}
