/** Live Instagram avatar proxy — scraped CDN URLs expire quickly. */
export function instagramAvatarUrl(username: string): string {
  const handle = username.replace(/^@/, "").trim().toLowerCase();
  return `/api/avatar/instagram/${encodeURIComponent(handle)}`;
}

/**
 * Prefer the live Instagram proxy when on the IG platform; otherwise use the
 * scraped URL (LinkedIn / fresh scrapes).
 */
export function resolveProfilePicUrl(
  username: string,
  profilePicUrl: string | undefined,
  platform?: "instagram" | "linkedin" | "spotify" | null,
): string | undefined {
  const handle = username.replace(/^@/, "").trim();
  if (platform === "instagram" && handle) {
    return instagramAvatarUrl(handle);
  }
  const scraped = profilePicUrl?.trim();
  return scraped || undefined;
}
