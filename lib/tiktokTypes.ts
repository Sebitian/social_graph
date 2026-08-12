/** TikTok profile → videos → hashtags graph types. */

export type TikTokNodeKind = "self" | "video" | "hashtag";

export interface TikTokProfile {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  profileUrl: string;
  followerCount: number;
  followingCount: number;
  heartCount: number;
  videoCount: number;
  verified: boolean;
}

export interface TikTokHashtagRef {
  id?: string;
  name: string;
  title?: string;
}

export interface TikTokVideo {
  id: string;
  text: string;
  url: string;
  createTime?: string;
  coverUrl?: string;
  diggCount: number;
  shareCount: number;
  playCount: number;
  commentCount: number;
  collectCount: number;
  hashtags: TikTokHashtagRef[];
  musicName?: string;
  musicAuthor?: string;
  durationMs?: number;
}

export interface TikTokHashtag {
  id: string;
  label: string;
  weight: number;
  videoIds: string[];
  playCount: number;
  diggCount: number;
  color: string;
}

export interface TikTokGraphNode {
  id: string;
  label: string;
  kind: TikTokNodeKind;
  imageUrl?: string;
  refId?: string;
  weight?: number;
  color?: string;
  playCount?: number;
  diggCount?: number;
}

export interface TikTokGraphLink {
  source: string;
  target: string;
  kind: "self-video" | "video-hashtag";
  weight?: number;
}

export interface TikTokGraphData {
  nodes: TikTokGraphNode[];
  links: TikTokGraphLink[];
}

export interface TikTokStats {
  videoCount: number;
  hashtagCount: number;
  totalPlays: number;
  totalDiggs: number;
  totalShares: number;
  totalComments: number;
  followers: number;
  following: number;
  hearts: number;
}

export interface TikTokResult {
  kind: "tiktok";
  scrapedAt: number;
  pinned?: boolean;
  cached?: boolean;
  demo?: boolean;
  profile: TikTokProfile;
  videos: TikTokVideo[];
  hashtags: TikTokHashtag[];
  graph: TikTokGraphData;
  stats: TikTokStats;
}

export function isTikTokResult(value: unknown): value is TikTokResult {
  if (!value || typeof value !== "object") return false;
  return (value as { kind?: string }).kind === "tiktok";
}

/** Compact count for UI (e.g. 3.7K). */
export function formatTikTokCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}
