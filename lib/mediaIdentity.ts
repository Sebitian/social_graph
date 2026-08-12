/** Resolve public @handles + profile URLs for Analytics media tags. */

import type { ProfilePost, ScrapeResult } from "@/lib/types";
import type { SpotifyTasteResult } from "@/lib/spotifyTypes";
import type { TikTokResult } from "@/lib/tiktokTypes";
import type { CompanyResult } from "@/lib/companyTypes";

export type MediaPlatform =
  | "linkedin"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "spotify";

export interface MediaIdentity {
  /** Display handle without leading @ */
  tag: string;
  href: string;
}

function cleanTag(value: string): string {
  return value.replace(/^@/, "").trim();
}

function linkedInVanityFromPosts(posts?: ProfilePost[]): string | null {
  for (const post of posts ?? []) {
    const url = post.url;
    if (!url) continue;
    const fromPosts = url.match(
      /linkedin\.com\/posts\/([^/?#_]+)(?:_|\/|\?|#|$)/i,
    );
    if (fromPosts?.[1]) return cleanTag(fromPosts[1]);
    const fromIn = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
    if (fromIn?.[1]) return cleanTag(fromIn[1]);
  }
  return null;
}

function facebookSlugFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(
    /facebook\.com\/(?:profile\.php\?id=(\d+)|p\/([^/?#]+)|([^/?#]+))/i,
  );
  if (!match) return null;
  const slug = match[1] || match[2] || match[3];
  if (!slug || slug === "p" || slug === "pages" || slug === "watch") return null;
  return cleanTag(decodeURIComponent(slug));
}

function companySlugFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/company\/([^/?#]+)/i);
  return match?.[1] ? cleanTag(decodeURIComponent(match[1])) : null;
}

function socialIdentity(
  platform: "linkedin" | "instagram" | "facebook",
  data: ScrapeResult,
): MediaIdentity {
  const profile = data.profile;
  if (platform === "linkedin") {
    const tag =
      linkedInVanityFromPosts(data.posts) ||
      cleanTag(profile.username) ||
      "linkedin";
    return {
      tag,
      href:
        profile.profileUrl ||
        `https://www.linkedin.com/in/${encodeURIComponent(tag)}`,
    };
  }

  if (platform === "instagram") {
    const tag = cleanTag(profile.username) || "instagram";
    return {
      tag,
      href:
        profile.profileUrl ||
        `https://www.instagram.com/${encodeURIComponent(tag)}/`,
    };
  }

  const fromUrl =
    facebookSlugFromUrl(profile.profileUrl) ||
    facebookSlugFromUrl(
      data.posts?.find((p) => p.url?.includes("facebook.com"))?.url,
    );
  const tag = fromUrl || cleanTag(profile.username) || "facebook";
  return {
    tag,
    href:
      profile.profileUrl ||
      (fromUrl?.match(/^\d+$/)
        ? `https://www.facebook.com/profile.php?id=${fromUrl}`
        : `https://www.facebook.com/${encodeURIComponent(tag)}`),
  };
}

export function resolveAnalyticsMediaIdentity(args: {
  platform: MediaPlatform;
  linkedinMode?: "person" | "company";
  socialResults: Partial<
    Record<"linkedin" | "instagram" | "facebook", ScrapeResult | null>
  >;
  spotifyResult?: SpotifyTasteResult | null;
  companyResult?: CompanyResult | null;
  tiktokResult?: TikTokResult | null;
}): MediaIdentity | null {
  const {
    platform,
    linkedinMode = "person",
    socialResults,
    spotifyResult,
    companyResult,
    tiktokResult,
  } = args;

  if (platform === "linkedin" && linkedinMode === "company" && companyResult) {
    const tag =
      companySlugFromUrl(companyResult.company.linkedinUrl) ||
      cleanTag(companyResult.company.name.replace(/\s+/g, "")) ||
      "company";
    return {
      tag,
      href:
        companyResult.company.linkedinUrl ||
        `https://www.linkedin.com/company/${encodeURIComponent(tag)}/`,
    };
  }

  if (platform === "linkedin" || platform === "instagram" || platform === "facebook") {
    const social = socialResults[platform];
    if (!social) return null;
    return socialIdentity(platform, social);
  }

  if (platform === "tiktok" && tiktokResult) {
    const tag = cleanTag(tiktokResult.profile.username) || "tiktok";
    return {
      tag,
      href:
        tiktokResult.profile.profileUrl ||
        `https://www.tiktok.com/@${encodeURIComponent(tag)}`,
    };
  }

  if (platform === "spotify" && spotifyResult) {
    const tag =
      cleanTag(spotifyResult.profile.username) ||
      cleanTag(spotifyResult.profile.userId) ||
      "spotify";
    return {
      tag,
      href:
        spotifyResult.profile.sourceUrl ||
        `https://open.spotify.com/user/${encodeURIComponent(spotifyResult.profile.userId || tag)}`,
    };
  }

  return null;
}
