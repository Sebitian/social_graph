import type {
  TikTokGraphData,
  TikTokGraphLink,
  TikTokGraphNode,
  TikTokHashtag,
  TikTokProfile,
  TikTokResult,
  TikTokStats,
  TikTokVideo,
} from "./tiktokTypes";

/** Raw profile row from khadinakbar/tiktok-profile-scraper. */
export interface RawTikTokProfile {
  username?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  profile_url?: string;
  follower_count?: number;
  following_count?: number;
  heart_count?: number;
  video_count?: number;
  verified?: boolean;
}

/** Raw post row from scrapeforge/tiktok-posts. */
export interface RawTikTokPost {
  id?: string;
  text?: string;
  webVideoUrl?: string;
  createTime?: number;
  createTimeISO?: string;
  diggCount?: number;
  shareCount?: number;
  playCount?: number;
  commentCount?: number;
  collectCount?: number;
  covers?: { default?: string; dynamic?: string };
  videoMeta?: { coverUrl?: string; duration?: number };
  hashtags?: Array<{ id?: string; name?: string; title?: string }>;
  musicMeta?: {
    musicName?: string;
    musicAuthor?: string;
  };
  authorMeta?: {
    id?: string;
    name?: string;
    nickName?: string;
    verified?: boolean;
    signature?: string;
    avatar?: string;
    fans?: number;
    following?: number;
    heart?: number;
    video?: number;
  };
}

const HASHTAG_COLORS = [
  "#FE2C55",
  "#25F4EE",
  "#FFFFFF",
  "#69C9D0",
  "#EE1D52",
  "#A8E6CF",
  "#FFD93D",
  "#6C5CE7",
];

const SELF_COLOR = "#FE2C55";
const VIDEO_COLOR = "#25F4EE";

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function videoSnippet(text?: string, max = 48): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "TikTok video";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function isTikTokProfileDataset(raw: unknown): raw is RawTikTokProfile[] {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  const first = raw[0];
  return Boolean(
    first &&
      typeof first === "object" &&
      "username" in first &&
      ("follower_count" in first || "heart_count" in first || "video_count" in first),
  );
}

export function isTikTokPostsDataset(raw: unknown): raw is RawTikTokPost[] {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  const sample = raw.slice(0, 10);
  return sample.some(
    (item) =>
      item &&
      typeof item === "object" &&
      ("webVideoUrl" in item || "diggCount" in item) &&
      ("authorMeta" in item || "playCount" in item),
  );
}

function buildProfile(
  handle: string,
  rawProfile: RawTikTokProfile | null,
  posts: RawTikTokPost[],
): TikTokProfile {
  const author = posts.find((p) => p.authorMeta)?.authorMeta;
  const username =
    rawProfile?.username || author?.name || handle.replace(/^@/, "");
  return {
    username,
    displayName:
      rawProfile?.display_name || author?.nickName || username,
    bio: rawProfile?.bio || author?.signature || "",
    avatarUrl: rawProfile?.avatar_url || author?.avatar,
    profileUrl:
      rawProfile?.profile_url || `https://www.tiktok.com/@${username}`,
    followerCount: rawProfile?.follower_count ?? author?.fans ?? 0,
    followingCount: rawProfile?.following_count ?? author?.following ?? 0,
    heartCount: rawProfile?.heart_count ?? author?.heart ?? 0,
    videoCount: rawProfile?.video_count ?? author?.video ?? posts.length,
    verified: Boolean(rawProfile?.verified ?? author?.verified),
  };
}

function buildVideos(posts: RawTikTokPost[]): TikTokVideo[] {
  const videos: TikTokVideo[] = [];
  for (const post of posts) {
    if (!post.id) continue;
    videos.push({
      id: post.id,
      text: post.text ?? "",
      url: post.webVideoUrl ?? `https://www.tiktok.com/video/${post.id}`,
      createTime:
        post.createTimeISO ||
        (typeof post.createTime === "number"
          ? new Date(
              post.createTime * (post.createTime < 1e12 ? 1000 : 1),
            ).toISOString()
          : undefined),
      coverUrl:
        post.covers?.default ||
        post.videoMeta?.coverUrl ||
        post.covers?.dynamic,
      diggCount: post.diggCount ?? 0,
      shareCount: post.shareCount ?? 0,
      playCount: post.playCount ?? 0,
      commentCount: post.commentCount ?? 0,
      collectCount: post.collectCount ?? 0,
      hashtags: (post.hashtags ?? [])
        .filter((h) => h.name)
        .map((h) => ({
          id: h.id,
          name: h.name!,
          title: h.title,
        })),
      musicName: post.musicMeta?.musicName,
      musicAuthor: post.musicMeta?.musicAuthor,
      durationMs: post.videoMeta?.duration,
    });
  }
  return videos.sort((a, b) => {
    const ta = a.createTime ? Date.parse(a.createTime) : 0;
    const tb = b.createTime ? Date.parse(b.createTime) : 0;
    return tb - ta;
  });
}

function buildHashtags(videos: TikTokVideo[]): TikTokHashtag[] {
  const map = new Map<
    string,
    {
      label: string;
      videoIds: string[];
      playCount: number;
      diggCount: number;
    }
  >();

  for (const video of videos) {
    for (const tag of video.hashtags) {
      const id = `tag:${slugify(tag.name)}`;
      const existing = map.get(id);
      if (existing) {
        if (!existing.videoIds.includes(video.id)) {
          existing.videoIds.push(video.id);
        }
        existing.playCount += video.playCount;
        existing.diggCount += video.diggCount;
      } else {
        map.set(id, {
          label: tag.name.replace(/^#/, ""),
          videoIds: [video.id],
          playCount: video.playCount,
          diggCount: video.diggCount,
        });
      }
    }
  }

  return [...map.entries()]
    .map(([id, value], i) => ({
      id,
      label: value.label,
      weight: value.videoIds.length,
      videoIds: value.videoIds,
      playCount: value.playCount,
      diggCount: value.diggCount,
      color: HASHTAG_COLORS[i % HASHTAG_COLORS.length],
    }))
    .sort((a, b) => b.weight - a.weight || b.playCount - a.playCount);
}

function buildGraph(
  profile: TikTokProfile,
  videos: TikTokVideo[],
  hashtags: TikTokHashtag[],
): TikTokGraphData {
  const selfId = `self:${profile.username}`;
  const nodes: TikTokGraphNode[] = [
    {
      id: selfId,
      label: profile.displayName,
      kind: "self",
      imageUrl: profile.avatarUrl,
      refId: profile.username,
      weight: profile.followerCount || 1,
      color: SELF_COLOR,
    },
  ];
  const links: TikTokGraphLink[] = [];

  // Cap videos on the map so the layout stays readable.
  const mapVideos = videos.slice(0, 24);
  for (const video of mapVideos) {
    const nodeId = `video:${video.id}`;
    nodes.push({
      id: nodeId,
      label: videoSnippet(video.text),
      kind: "video",
      imageUrl: video.coverUrl,
      refId: video.id,
      weight: Math.max(1, Math.log10(video.playCount + 10)),
      color: VIDEO_COLOR,
      playCount: video.playCount,
      diggCount: video.diggCount,
    });
    links.push({
      source: selfId,
      target: nodeId,
      kind: "self-video",
      weight: Math.max(1, Math.log10(video.playCount + 10)),
    });
  }

  const videoIdSet = new Set(mapVideos.map((v) => v.id));
  // Keep top hashtags that appear on mapped videos.
  const mapHashtags = hashtags
    .filter((h) => h.videoIds.some((id) => videoIdSet.has(id)))
    .slice(0, 16);

  for (const tag of mapHashtags) {
    nodes.push({
      id: tag.id,
      label: `#${tag.label}`,
      kind: "hashtag",
      refId: tag.label,
      weight: tag.weight,
      color: tag.color,
      playCount: tag.playCount,
      diggCount: tag.diggCount,
    });
    for (const videoId of tag.videoIds) {
      if (!videoIdSet.has(videoId)) continue;
      links.push({
        source: `video:${videoId}`,
        target: tag.id,
        kind: "video-hashtag",
        weight: tag.weight,
      });
    }
  }

  return { nodes, links };
}

function buildStats(
  profile: TikTokProfile,
  videos: TikTokVideo[],
  hashtags: TikTokHashtag[],
): TikTokStats {
  return {
    videoCount: videos.length,
    hashtagCount: hashtags.length,
    totalPlays: videos.reduce((s, v) => s + v.playCount, 0),
    totalDiggs: videos.reduce((s, v) => s + v.diggCount, 0),
    totalShares: videos.reduce((s, v) => s + v.shareCount, 0),
    totalComments: videos.reduce((s, v) => s + v.commentCount, 0),
    followers: profile.followerCount,
    following: profile.followingCount,
    hearts: profile.heartCount,
  };
}

export function buildTikTokResult(
  handle: string,
  posts: RawTikTokPost[],
  options?: {
    profile?: RawTikTokProfile | null;
    scrapedAt?: number;
    pinned?: boolean;
  },
): TikTokResult {
  const clean = handle.replace(/^@/, "").trim().toLowerCase();
  if (posts.length === 0) {
    throw new Error("TikTok dataset has no posts — cannot build snapshot");
  }

  const profile = buildProfile(clean, options?.profile ?? null, posts);
  const videos = buildVideos(posts);
  const hashtags = buildHashtags(videos);
  const graph = buildGraph(profile, videos, hashtags);

  return {
    kind: "tiktok",
    scrapedAt: options?.scrapedAt ?? Date.now(),
    pinned: options?.pinned ?? true,
    cached: false,
    demo: false,
    profile,
    videos,
    hashtags,
    graph,
    stats: buildStats(profile, videos, hashtags),
  };
}
