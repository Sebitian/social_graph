/** Analytics time ranges and period aggregations for the Analytics panel. */

import type { GraphNode, ScrapeResult } from "@/lib/types";
import type { TikTokResult, TikTokVideo } from "@/lib/tiktokTypes";
import type { SpotifyTasteResult, SpotifyTrack } from "@/lib/spotifyTypes";
import type { CompanyResult } from "@/lib/companyTypes";

export type AnalyticsRangeId = "1d" | "7d" | "14d" | "30d" | "90d" | "all";

export const ANALYTICS_RANGES: {
  id: AnalyticsRangeId;
  label: string;
  days: number | null;
}[] = [
  { id: "1d", label: "1D", days: 1 },
  { id: "7d", label: "7D", days: 7 },
  { id: "14d", label: "14D", days: 14 },
  { id: "30d", label: "1M", days: 30 },
  { id: "90d", label: "3M", days: 90 },
  { id: "all", label: "All", days: null },
];

export const DEFAULT_ANALYTICS_RANGE: AnalyticsRangeId = "7d";

const MS_DAY = 86_400_000;

/** Parse ISO timestamps or relative strings like "3w", "2mo", "today". */
export function parseEventMs(
  value?: string | number | null,
  now = Date.now(),
): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    // Heuristic: seconds vs ms
    return value < 1e12 ? value * 1000 : value;
  }
  const raw = value.trim();
  if (!raw) return null;

  const iso = Date.parse(raw);
  if (!Number.isNaN(iso)) return iso;

  const clean = raw.toLowerCase();
  if (clean === "today" || clean === "recently" || clean === "just now") return now;

  const match = clean.match(
    /^(\d+)\s*(second|minute|hour|day|week|month|year|s|m|h|d|w|mo|y)s?(?:\s+ago)?$/i,
  );
  if (!match) return null;
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  let days = 0;
  if (
    unit.startsWith("s") ||
    unit === "m" ||
    unit.startsWith("minute") ||
    unit.startsWith("h")
  ) {
    days = 0;
  } else if (unit.startsWith("d")) {
    days = n;
  } else if (unit.startsWith("w")) {
    days = n * 7;
  } else if (unit === "mo" || unit.startsWith("month")) {
    days = n * 30;
  } else {
    days = n * 365;
  }
  return now - days * MS_DAY;
}

export function rangeWindow(
  range: AnalyticsRangeId,
  now = Date.now(),
): { startMs: number | null; endMs: number } {
  const def = ANALYTICS_RANGES.find((r) => r.id === range);
  if (!def || def.days == null) return { startMs: null, endMs: now };
  return { startMs: now - def.days * MS_DAY, endMs: now };
}

export function inRange(
  ms: number | null,
  range: AnalyticsRangeId,
  now = Date.now(),
): boolean {
  if (ms == null) return range === "all";
  const { startMs, endMs } = rangeWindow(range, now);
  if (startMs == null) return ms <= endMs;
  return ms >= startMs && ms <= endMs;
}

/** Bucket event timestamps into sparkline series (count per bucket). */
export function bucketSeries(
  timestamps: number[],
  range: AnalyticsRangeId,
  now = Date.now(),
  bucketCount = 12,
): number[] {
  const { startMs, endMs } = rangeWindow(range, now);
  const start =
    startMs ??
    (timestamps.length
      ? Math.min(...timestamps)
      : endMs - 30 * MS_DAY);
  const span = Math.max(endMs - start, MS_DAY);
  const buckets = Math.max(2, bucketCount);
  const series = Array.from({ length: buckets }, () => 0);
  for (const t of timestamps) {
    if (t < start || t > endMs) continue;
    const idx = Math.min(
      buckets - 1,
      Math.floor(((t - start) / span) * buckets),
    );
    series[idx] += 1;
  }
  return series;
}

export interface AnalyticsPersonRow {
  username: string;
  fullName?: string;
  profilePicUrl?: string;
  position?: string;
  comments: number;
  reactions: number;
  metricLabel: string;
}

export interface SocialAnalyticsOverview {
  comments: number;
  reactions: number;
  activeEngagers: number;
  postsTouched: number;
  commentSeries: number[];
  hasDatedEvents: boolean;
  topEngagers: AnalyticsPersonRow[];
  newProfiles: AnalyticsPersonRow[];
}

function memberNodes(data: ScrapeResult): GraphNode[] {
  return (data.engagers ?? data.graph.nodes).filter((n) => n.group === "member");
}

function commentMs(when?: string, timestamp?: string, now = Date.now()): number | null {
  return parseEventMs(timestamp, now) ?? parseEventMs(when, now);
}

export function computeSocialAnalytics(
  data: ScrapeResult,
  range: AnalyticsRangeId,
  now = Date.now(),
): SocialAnalyticsOverview {
  const members = memberNodes(data);
  const posts = data.posts ?? [];
  const postById = new Map(posts.map((p) => [p.id, p]));

  let comments = 0;
  let reactions = 0;
  const commentTimestamps: number[] = [];
  const postsTouched = new Set<string>();
  const engagerCounts = new Map<
    string,
    { node: GraphNode; comments: number; reactions: number; firstMs: number | null; latestMs: number | null }
  >();

  for (const node of members) {
    const history = node.history ?? [];
    let periodComments = 0;
    let firstMs: number | null = null;
    let latestMs: number | null = null;

    for (const c of history) {
      const ms = commentMs(c.when, c.timestamp, now);
      if (ms != null) {
        if (firstMs == null || ms < firstMs) firstMs = ms;
        if (latestMs == null || ms > latestMs) latestMs = ms;
      }
      if (!inRange(ms, range, now)) continue;
      periodComments += 1;
      comments += 1;
      if (ms != null) commentTimestamps.push(ms);
      if (c.postId) postsTouched.add(c.postId);
    }

    // Reactions approximated via posts in range (no per-reaction timestamps).
    let periodReactions = 0;
    const engagement = node.postEngagement ?? {};
    for (const [postId, eng] of Object.entries(engagement)) {
      if (!eng.reactionType && !eng.commented) continue;
      const post = postById.get(postId);
      const postMs = parseEventMs(post?.postedAt, now);
      const postInRange =
        range === "all"
          ? true
          : postMs != null
            ? inRange(postMs, range, now)
            : periodComments > 0; // soft: if they commented in range, count their reactions on undated posts
      if (!postInRange) continue;
      if (eng.reactionType) {
        periodReactions += 1;
        reactions += 1;
        postsTouched.add(postId);
      }
    }

    // Also count posts published in range that appear in history labels.
    for (const c of history) {
      if (!inRange(commentMs(c.when, c.timestamp, now), range, now)) continue;
      // Match post by label when postId missing
      if (!c.postId && c.post) {
        const match = posts.find((p) => p.label === c.post);
        if (match) postsTouched.add(match.id);
      }
    }

    const featuresFirst = parseEventMs(node.features?.firstInteractionDate, now);
    if (featuresFirst != null && (firstMs == null || featuresFirst < firstMs)) {
      firstMs = featuresFirst;
    }

    if (periodComments > 0 || periodReactions > 0) {
      engagerCounts.set(node.id || node.label, {
        node,
        comments: periodComments,
        reactions: periodReactions,
        firstMs,
        latestMs,
      });
    }
  }

  // Posts published in range count toward postsTouched even without engagement.
  for (const post of posts) {
    const ms = parseEventMs(post.postedAt, now);
    if (inRange(ms, range, now)) postsTouched.add(post.id);
  }

  const { startMs } = rangeWindow(range, now);

  const topEngagers: AnalyticsPersonRow[] = [...engagerCounts.values()]
    .sort(
      (a, b) =>
        b.comments + b.reactions - (a.comments + a.reactions) ||
        b.comments - a.comments,
    )
    .slice(0, 12)
    .map(({ node, comments: c, reactions: r }) => ({
      username: node.label || node.id,
      fullName: node.fullName,
      profilePicUrl: node.profilePicUrl,
      position: node.position,
      comments: c,
      reactions: r,
      metricLabel: formatPersonMetric(c, r),
    }));

  const newProfiles: AnalyticsPersonRow[] = [...engagerCounts.values()]
    .filter(({ firstMs }) => {
      if (firstMs == null) return false;
      if (startMs == null) return true;
      return firstMs >= startMs;
    })
    .sort((a, b) => (b.firstMs ?? 0) - (a.firstMs ?? 0))
    .slice(0, 12)
    .map(({ node, comments: c, reactions: r }) => ({
      username: node.label || node.id,
      fullName: node.fullName,
      profilePicUrl: node.profilePicUrl,
      position: node.position,
      comments: c,
      reactions: r,
      metricLabel: formatPersonMetric(c, r),
    }));

  return {
    comments,
    reactions,
    activeEngagers: engagerCounts.size,
    postsTouched: postsTouched.size,
    commentSeries: bucketSeries(commentTimestamps, range, now),
    hasDatedEvents: commentTimestamps.length > 0 || posts.some((p) => parseEventMs(p.postedAt, now) != null),
    topEngagers,
    newProfiles,
  };
}

function formatPersonMetric(comments: number, reactions: number): string {
  const parts: string[] = [];
  if (comments > 0) parts.push(`${comments} comment${comments === 1 ? "" : "s"}`);
  if (reactions > 0) parts.push(`${reactions} reaction${reactions === 1 ? "" : "s"}`);
  return parts.join(" · ") || "Active";
}

export interface TikTokAnalyticsOverview {
  plays: number;
  likes: number;
  shares: number;
  videosPosted: number;
  playSeries: number[];
  hasDatedEvents: boolean;
  topVideos: {
    id: string;
    text: string;
    playCount: number;
    diggCount: number;
    coverUrl?: string;
    url: string;
  }[];
  topHashtags: { label: string; weight: number; color?: string; plays: number }[];
}

export function computeTikTokAnalytics(
  data: TikTokResult,
  range: AnalyticsRangeId,
  now = Date.now(),
): TikTokAnalyticsOverview {
  const inPeriod: TikTokVideo[] = [];
  const playTimestamps: number[] = [];

  for (const video of data.videos) {
    const ms = parseEventMs(video.createTime, now);
    if (range === "all" || inRange(ms, range, now)) {
      inPeriod.push(video);
      if (ms != null) playTimestamps.push(ms);
    }
  }

  let plays = 0;
  let likes = 0;
  let shares = 0;
  for (const v of inPeriod) {
    plays += v.playCount;
    likes += v.diggCount;
    shares += v.shareCount;
  }

  const hashtagMap = new Map<
    string,
    { label: string; weight: number; plays: number; color?: string }
  >();
  for (const v of inPeriod) {
    for (const tag of v.hashtags) {
      const key = tag.name.toLowerCase();
      const existing = hashtagMap.get(key);
      if (existing) {
        existing.weight += 1;
        existing.plays += v.playCount;
      } else {
        const known = data.hashtags.find(
          (h) => h.label.toLowerCase() === key || h.id === tag.id,
        );
        hashtagMap.set(key, {
          label: tag.name,
          weight: 1,
          plays: v.playCount,
          color: known?.color,
        });
      }
    }
  }

  return {
    plays,
    likes,
    shares,
    videosPosted: inPeriod.length,
    playSeries: bucketSeries(playTimestamps, range, now),
    hasDatedEvents: data.videos.some((v) => parseEventMs(v.createTime, now) != null),
    topVideos: [...inPeriod]
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 8)
      .map((v) => ({
        id: v.id,
        text: v.text,
        playCount: v.playCount,
        diggCount: v.diggCount,
        coverUrl: v.coverUrl,
        url: v.url,
      })),
    topHashtags: [...hashtagMap.values()]
      .sort((a, b) => b.weight - a.weight || b.plays - a.plays)
      .slice(0, 10),
  };
}

export interface SpotifyAnalyticsOverview {
  tracksAdded: number;
  artistsTouched: number;
  playlistsActive: number;
  trackSeries: number[];
  hasDatedEvents: boolean;
  topArtists: { name: string; tracks: number }[];
  topGenres: { label: string; weight: number; color?: string }[];
  friendCount: number;
}

export function computeSpotifyAnalytics(
  data: SpotifyTasteResult,
  range: AnalyticsRangeId,
  now = Date.now(),
): SpotifyAnalyticsOverview {
  const tracks: { track: SpotifyTrack; playlistId: string; ms: number | null }[] =
    [];
  for (const pl of data.playlists) {
    for (const track of pl.tracks ?? []) {
      const ms = parseEventMs(track.addedAt, now);
      if (range === "all" || inRange(ms, range, now)) {
        tracks.push({ track, playlistId: pl.id, ms });
      }
    }
  }

  const artistCounts = new Map<string, number>();
  const playlistIds = new Set<string>();
  const timestamps: number[] = [];

  for (const { track, playlistId, ms } of tracks) {
    playlistIds.add(playlistId);
    if (ms != null) timestamps.push(ms);
    for (const a of track.artists) {
      const name = a.artistName.trim();
      if (!name) continue;
      artistCounts.set(name, (artistCounts.get(name) ?? 0) + 1);
    }
  }

  // Genres: weight by playlist overlap with active playlists in range.
  const topGenres = data.genres
    .map((g) => ({
      label: g.label,
      weight: g.playlistIds.filter((id) => playlistIds.has(id)).length || (range === "all" ? g.weight : 0),
      color: g.color,
    }))
    .filter((g) => g.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10);

  return {
    tracksAdded: tracks.length,
    artistsTouched: artistCounts.size,
    playlistsActive: playlistIds.size,
    trackSeries: bucketSeries(timestamps, range, now),
    hasDatedEvents: data.playlists.some((p) =>
      (p.tracks ?? []).some((t) => parseEventMs(t.addedAt, now) != null),
    ),
    topArtists: [...artistCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, tracks: count })),
    topGenres,
    friendCount: data.stats.friendCount,
  };
}

export interface CompanyAnalyticsOverview {
  employeeCount: number;
  totalReported?: number;
  locationCount: number;
  schoolCount: number;
  avgConnections: number;
  topLocations: { label: string; count: number }[];
  topSchools: { label: string; count: number }[];
  snapshotOnly: true;
}

export function computeCompanyAnalytics(
  data: CompanyResult,
): CompanyAnalyticsOverview {
  return {
    employeeCount: data.stats.employeeCount,
    totalReported: data.stats.totalReported,
    locationCount: data.stats.locationCount,
    schoolCount: data.stats.schoolCount,
    avgConnections: data.stats.avgConnections,
    topLocations: data.stats.topLocations.slice(0, 8),
    topSchools: data.stats.topSchools.slice(0, 8),
    snapshotOnly: true,
  };
}
