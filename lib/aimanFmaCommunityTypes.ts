export type FmaNodeKind = "creator" | "post" | "voice" | "member";
export type FmaVoiceWhy = "likes" | "thread";
export type FmaLinkKind = "authored" | "commented" | "community" | "mention";

export type FmaSentiment = "positive" | "neutral" | "negative";

export interface FmaPersonComment {
  text: string;
  likes: number;
  postId: string;
  postLabel: string;
  sentiment: FmaSentiment;
  timestamp?: string;
}

export interface FmaCommunityNode {
  id: string;
  label: string;
  kind: FmaNodeKind;
  color: string;
  likes: number;
  comments: number;
  mentionsIn: number;
  postIds: string[];
  communityId?: string;
  communityLabel?: string;
  voiceWhy?: FmaVoiceWhy;
  sentiment?: FmaSentiment;
  quote?: string;
  commentsList?: FmaPersonComment[];
  imageUrl?: string;
  url?: string;
  plays?: number;
  caption?: string;
  postedAt?: string;
  dateLabel?: string;
  commentedAt?: number;
}

export interface FmaCommunityLink {
  source: string;
  target: string;
  kind: FmaLinkKind;
  weight: number;
}

export interface FmaCommunityGraph {
  nodes: FmaCommunityNode[];
  links: FmaCommunityLink[];
  posts: { id: string; label: string; plays: number; likes: number }[];
  voices: { id: string; label: string; likes: number; communitySize: number }[];
}

export const FMA_CREATOR_ID = "nuancedaiman";
export const FMA_STONE_ID = "DcuVssYgD6J";
export const FMA_TUCKER_ID = "Dcw8mslgoYs";

export function formatFmaDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
