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
  { id: "all", label: "All", days: null },
  { id: "1d", label: "1D", days: 1 },
  { id: "7d", label: "7D", days: 7 },
  { id: "14d", label: "14D", days: 14 },
  { id: "30d", label: "1M", days: 30 },
  { id: "90d", label: "3M", days: 90 },
];

export const DEFAULT_ANALYTICS_RANGE: AnalyticsRangeId = "all";

const MS_DAY = 86_400_000;

export interface ChartPoint {
  /** Bucket start timestamp (ms). */
  t: number;
  /** Short axis label. */
  label: string;
  /** Value in this bucket. */
  v: number;
  /** True when the bucket includes "now" (partial period). */
  incomplete?: boolean;
}

export interface AnalyticsDelta {
  /** Percent change vs previous equal-length window; null when undefined. */
  pct: number | null;
}

/** Parse ISO timestamps or relative strings like "3w", "2mo", "today". */
export function parseEventMs(
  value?: string | number | null,
  now = Date.now(),
): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
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

function formatBucketLabel(t: number, bucketMs: number): string {
  const d = new Date(t);
  if (bucketMs <= MS_DAY) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  if (bucketMs <= 7 * MS_DAY) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function resolveBucketLayout(
  range: AnalyticsRangeId,
  timestamps: number[],
  now: number,
): { start: number; end: number; bucketCount: number; bucketMs: number } {
  const { startMs, endMs } = rangeWindow(range, now);
  const end = endMs;
  let start =
    startMs ??
    (timestamps.length ? Math.min(...timestamps) : end - 30 * MS_DAY);
  if (start >= end) start = end - MS_DAY;

  const span = end - start;
  let bucketCount: number;
  if (range === "1d") bucketCount = 12;
  else if (range === "7d") bucketCount = 7;
  else if (range === "14d") bucketCount = 14;
  else if (range === "30d") bucketCount = 15;
  else if (range === "90d") bucketCount = 12;
  else bucketCount = Math.min(16, Math.max(6, Math.ceil(span / MS_DAY)));

  const bucketMs = span / bucketCount;
  return { start, end, bucketCount, bucketMs };
}

/** Weighted events → labeled chart points for the selected range. */
export function bucketSeriesPoints(
  events: { t: number; weight?: number }[],
  range: AnalyticsRangeId,
  now = Date.now(),
): ChartPoint[] {
  const timestamps = events.map((e) => e.t);
  const { start, end, bucketCount, bucketMs } = resolveBucketLayout(
    range,
    timestamps,
    now,
  );
  const values = Array.from({ length: bucketCount }, () => 0);

  for (const event of events) {
    if (event.t < start || event.t > end) continue;
    const idx = Math.min(
      bucketCount - 1,
      Math.floor(((event.t - start) / (end - start || 1)) * bucketCount),
    );
    values[idx] += event.weight ?? 1;
  }

  return values.map((v, i) => {
    const t = start + i * bucketMs;
    const bucketEnd = t + bucketMs;
    return {
      t,
      label: formatBucketLabel(t, bucketMs),
      v,
      incomplete: now >= t && now < bucketEnd,
    };
  });
}

/** Legacy sparkline helper (counts only). */
export function bucketSeries(
  timestamps: number[],
  range: AnalyticsRangeId,
  now = Date.now(),
  _bucketCount = 12,
): number[] {
  return bucketSeriesPoints(
    timestamps.map((t) => ({ t })),
    range,
    now,
  ).map((p) => p.v);
}

export function percentDelta(
  current: number,
  previous: number,
): number | null {
  if (previous <= 0 && current <= 0) return 0;
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function previousWindow(
  range: AnalyticsRangeId,
  now: number,
): { startMs: number; endMs: number } | null {
  const def = ANALYTICS_RANGES.find((r) => r.id === range);
  if (!def || def.days == null) return null;
  const endMs = now - def.days * MS_DAY;
  const startMs = endMs - def.days * MS_DAY;
  return { startMs, endMs };
}

function inWindow(
  ms: number | null,
  startMs: number,
  endMs: number,
): boolean {
  if (ms == null) return false;
  return ms >= startMs && ms <= endMs;
}

export interface AnalyticsPersonRow {
  username: string;
  fullName?: string;
  profilePicUrl?: string;
  position?: string;
  comments: number;
  reactions: number;
  metricLabel: string;
  value: number;
}

export interface AnalyticsPostRow {
  id: string;
  label: string;
  url?: string;
  imageUrl?: string;
  comments: number;
  reactions: number;
  value: number;
}

export interface AnalyticsBreakdownRow {
  id: string;
  label: string;
  value: number;
  subtitle?: string;
  leadingColor?: string;
}

export interface SocialAnalyticsOverview {
  comments: number;
  reactions: number;
  activeEngagers: number;
  postsTouched: number;
  commentsDelta: AnalyticsDelta;
  reactionsDelta: AnalyticsDelta;
  engagersDelta: AnalyticsDelta;
  postsDelta: AnalyticsDelta;
  commentsSeries: ChartPoint[];
  reactionsSeries: ChartPoint[];
  engagersSeries: ChartPoint[];
  postsSeries: ChartPoint[];
  /** @deprecated use commentsSeries */
  commentSeries: number[];
  hasDatedEvents: boolean;
  topEngagers: AnalyticsPersonRow[];
  newProfiles: AnalyticsPersonRow[];
  topPosts: AnalyticsPostRow[];
  reactionMix: AnalyticsBreakdownRow[];
}

function memberNodes(data: ScrapeResult): GraphNode[] {
  return (data.engagers ?? data.graph.nodes).filter((n) => n.group === "member");
}

function commentMs(
  when?: string,
  timestamp?: string,
  now = Date.now(),
): number | null {
  return parseEventMs(timestamp, now) ?? parseEventMs(when, now);
}

function formatPersonMetric(comments: number, reactions: number): string {
  const parts: string[] = [];
  if (comments > 0)
    parts.push(`${comments} comment${comments === 1 ? "" : "s"}`);
  if (reactions > 0)
    parts.push(`${reactions} reaction${reactions === 1 ? "" : "s"}`);
  return parts.join(" · ") || "Active";
}

export function computeSocialAnalytics(
  data: ScrapeResult,
  range: AnalyticsRangeId,
  now = Date.now(),
): SocialAnalyticsOverview {
  const members = memberNodes(data);
  const posts = data.posts ?? [];
  const postById = new Map(posts.map((p) => [p.id, p]));
  const prev = previousWindow(range, now);

  let comments = 0;
  let reactions = 0;
  let prevComments = 0;
  let prevReactions = 0;
  const commentEvents: { t: number }[] = [];
  const reactionEvents: { t: number }[] = [];
  const engagerEvents: { t: number; id: string }[] = [];
  const postEvents: { t: number; id: string }[] = [];
  const postsTouched = new Set<string>();
  const prevEngagers = new Set<string>();
  const prevPosts = new Set<string>();
  const postStats = new Map<
    string,
    { comments: number; reactions: number }
  >();
  const reactionTypes = new Map<string, number>();

  const engagerCounts = new Map<
    string,
    {
      node: GraphNode;
      comments: number;
      reactions: number;
      firstMs: number | null;
      latestMs: number | null;
    }
  >();

  const bumpPost = (postId: string, kind: "comments" | "reactions") => {
    const cur = postStats.get(postId) ?? { comments: 0, reactions: 0 };
    cur[kind] += 1;
    postStats.set(postId, cur);
  };

  for (const node of members) {
    const history = node.history ?? [];
    let periodComments = 0;
    let firstMs: number | null = null;
    let latestMs: number | null = null;
    const nodeId = node.id || node.label;

    for (const c of history) {
      const ms = commentMs(c.when, c.timestamp, now);
      if (ms != null) {
        if (firstMs == null || ms < firstMs) firstMs = ms;
        if (latestMs == null || ms > latestMs) latestMs = ms;
      }

      if (prev && inWindow(ms, prev.startMs, prev.endMs)) {
        prevComments += 1;
        prevEngagers.add(nodeId);
        if (c.postId) prevPosts.add(c.postId);
      }

      if (!inRange(ms, range, now)) continue;
      periodComments += 1;
      comments += 1;
      if (ms != null) {
        commentEvents.push({ t: ms });
        engagerEvents.push({ t: ms, id: nodeId });
      }
      if (c.postId) {
        postsTouched.add(c.postId);
        bumpPost(c.postId, "comments");
      } else if (c.post) {
        const match = posts.find((p) => p.label === c.post);
        if (match) {
          postsTouched.add(match.id);
          bumpPost(match.id, "comments");
        }
      }
    }

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
            : periodComments > 0;
      const postInPrev =
        prev && postMs != null
          ? inWindow(postMs, prev.startMs, prev.endMs)
          : false;

      if (eng.reactionType && postInPrev) {
        prevReactions += 1;
        prevEngagers.add(nodeId);
        prevPosts.add(postId);
      }

      if (!postInRange) continue;
      if (eng.reactionType) {
        periodReactions += 1;
        reactions += 1;
        postsTouched.add(postId);
        bumpPost(postId, "reactions");
        const key = eng.reactionType;
        reactionTypes.set(key, (reactionTypes.get(key) ?? 0) + 1);
        const t = postMs ?? latestMs ?? now;
        reactionEvents.push({ t });
        engagerEvents.push({ t, id: nodeId });
      }
    }

    const featuresFirst = parseEventMs(
      node.features?.firstInteractionDate,
      now,
    );
    if (featuresFirst != null && (firstMs == null || featuresFirst < firstMs)) {
      firstMs = featuresFirst;
    }

    if (periodComments > 0 || periodReactions > 0) {
      engagerCounts.set(nodeId, {
        node,
        comments: periodComments,
        reactions: periodReactions,
        firstMs,
        latestMs,
      });
    }
  }

  for (const post of posts) {
    const ms = parseEventMs(post.postedAt, now);
    if (inRange(ms, range, now)) {
      postsTouched.add(post.id);
      if (ms != null) postEvents.push({ t: ms, id: post.id });
    }
    if (prev && inWindow(ms, prev.startMs, prev.endMs)) {
      prevPosts.add(post.id);
    }
  }

  // Unique engagers per bucket
  const { start, end, bucketCount } = resolveBucketLayout(
    range,
    engagerEvents.map((e) => e.t),
    now,
  );
  const engagerBuckets = Array.from(
    { length: bucketCount },
    () => new Set<string>(),
  );
  for (const e of engagerEvents) {
    if (e.t < start || e.t > end) continue;
    const idx = Math.min(
      bucketCount - 1,
      Math.floor(((e.t - start) / (end - start || 1)) * bucketCount),
    );
    engagerBuckets[idx].add(e.id);
  }
  const engagersSeries = bucketSeriesPoints(
    engagerEvents.map((e) => ({ t: e.t })),
    range,
    now,
  ).map((p, i) => ({ ...p, v: engagerBuckets[i]?.size ?? 0 }));

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
      value: c + r,
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
      value: c + r,
    }));

  const topPosts: AnalyticsPostRow[] = [...postStats.entries()]
    .map(([id, stats]) => {
      const post = postById.get(id);
      return {
        id,
        label: post?.label ?? id,
        url: post?.url,
        imageUrl: post?.imageUrl,
        comments: stats.comments,
        reactions: stats.reactions,
        value: stats.comments + stats.reactions,
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  const reactionMix: AnalyticsBreakdownRow[] = [...reactionTypes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, value]) => ({
      id: label,
      label,
      value,
    }));

  const commentsSeries = bucketSeriesPoints(commentEvents, range, now);
  const reactionsSeries = bucketSeriesPoints(reactionEvents, range, now);
  const postsSeries = bucketSeriesPoints(
    postEvents.map((e) => ({ t: e.t })),
    range,
    now,
  );

  return {
    comments,
    reactions,
    activeEngagers: engagerCounts.size,
    postsTouched: postsTouched.size,
    commentsDelta: { pct: percentDelta(comments, prevComments) },
    reactionsDelta: { pct: percentDelta(reactions, prevReactions) },
    engagersDelta: {
      pct: percentDelta(engagerCounts.size, prevEngagers.size),
    },
    postsDelta: { pct: percentDelta(postsTouched.size, prevPosts.size) },
    commentsSeries,
    reactionsSeries,
    engagersSeries,
    postsSeries,
    commentSeries: commentsSeries.map((p) => p.v),
    hasDatedEvents:
      commentEvents.length > 0 ||
      posts.some((p) => parseEventMs(p.postedAt, now) != null),
    topEngagers,
    newProfiles,
    topPosts,
    reactionMix,
  };
}

export interface TikTokAnalyticsOverview {
  plays: number;
  likes: number;
  shares: number;
  videosPosted: number;
  playsDelta: AnalyticsDelta;
  likesDelta: AnalyticsDelta;
  sharesDelta: AnalyticsDelta;
  videosDelta: AnalyticsDelta;
  playsSeries: ChartPoint[];
  likesSeries: ChartPoint[];
  sharesSeries: ChartPoint[];
  videosSeries: ChartPoint[];
  /** @deprecated use playsSeries */
  playSeries: number[];
  hasDatedEvents: boolean;
  topVideos: {
    id: string;
    text: string;
    playCount: number;
    diggCount: number;
    coverUrl?: string;
    url: string;
    value: number;
  }[];
  topHashtags: {
    label: string;
    weight: number;
    color?: string;
    plays: number;
    value: number;
  }[];
}

export function computeTikTokAnalytics(
  data: TikTokResult,
  range: AnalyticsRangeId,
  now = Date.now(),
): TikTokAnalyticsOverview {
  const prev = previousWindow(range, now);
  const inPeriod: TikTokVideo[] = [];
  const playEvents: { t: number; weight: number }[] = [];
  const likeEvents: { t: number; weight: number }[] = [];
  const shareEvents: { t: number; weight: number }[] = [];
  const videoEvents: { t: number }[] = [];

  let prevPlays = 0;
  let prevLikes = 0;
  let prevShares = 0;
  let prevVideos = 0;

  for (const video of data.videos) {
    const ms = parseEventMs(video.createTime, now);
    if (prev && inWindow(ms, prev.startMs, prev.endMs)) {
      prevPlays += video.playCount;
      prevLikes += video.diggCount;
      prevShares += video.shareCount;
      prevVideos += 1;
    }
    if (range === "all" || inRange(ms, range, now)) {
      inPeriod.push(video);
      if (ms != null) {
        playEvents.push({ t: ms, weight: video.playCount });
        likeEvents.push({ t: ms, weight: video.diggCount });
        shareEvents.push({ t: ms, weight: video.shareCount });
        videoEvents.push({ t: ms });
      }
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

  const playsSeries = bucketSeriesPoints(playEvents, range, now);
  const likesSeries = bucketSeriesPoints(likeEvents, range, now);
  const sharesSeries = bucketSeriesPoints(shareEvents, range, now);
  const videosSeries = bucketSeriesPoints(videoEvents, range, now);

  return {
    plays,
    likes,
    shares,
    videosPosted: inPeriod.length,
    playsDelta: { pct: percentDelta(plays, prevPlays) },
    likesDelta: { pct: percentDelta(likes, prevLikes) },
    sharesDelta: { pct: percentDelta(shares, prevShares) },
    videosDelta: { pct: percentDelta(inPeriod.length, prevVideos) },
    playsSeries,
    likesSeries,
    sharesSeries,
    videosSeries,
    playSeries: playsSeries.map((p) => p.v),
    hasDatedEvents: data.videos.some(
      (v) => parseEventMs(v.createTime, now) != null,
    ),
    topVideos: [...inPeriod]
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 10)
      .map((v) => ({
        id: v.id,
        text: v.text,
        playCount: v.playCount,
        diggCount: v.diggCount,
        coverUrl: v.coverUrl,
        url: v.url,
        value: v.playCount,
      })),
    topHashtags: [...hashtagMap.values()]
      .sort((a, b) => b.weight - a.weight || b.plays - a.plays)
      .slice(0, 10)
      .map((h) => ({ ...h, value: h.weight })),
  };
}

export interface SpotifyAnalyticsOverview {
  tracksAdded: number;
  artistsTouched: number;
  playlistsActive: number;
  friendCount: number;
  tracksDelta: AnalyticsDelta;
  artistsDelta: AnalyticsDelta;
  playlistsDelta: AnalyticsDelta;
  tracksSeries: ChartPoint[];
  artistsSeries: ChartPoint[];
  playlistsSeries: ChartPoint[];
  /** @deprecated use tracksSeries */
  trackSeries: number[];
  hasDatedEvents: boolean;
  topArtists: { name: string; tracks: number; value: number }[];
  topGenres: {
    label: string;
    weight: number;
    color?: string;
    value: number;
  }[];
  topPlaylists: {
    id: string;
    name: string;
    tracks: number;
    value: number;
  }[];
  friends: { id: string; name: string; value: number }[];
}

export function computeSpotifyAnalytics(
  data: SpotifyTasteResult,
  range: AnalyticsRangeId,
  now = Date.now(),
): SpotifyAnalyticsOverview {
  const prev = previousWindow(range, now);
  const tracks: { track: SpotifyTrack; playlistId: string; ms: number | null }[] =
    [];
  const prevTracks: typeof tracks = [];

  for (const pl of data.playlists) {
    for (const track of pl.tracks ?? []) {
      const ms = parseEventMs(track.addedAt, now);
      if (range === "all" || inRange(ms, range, now)) {
        tracks.push({ track, playlistId: pl.id, ms });
      }
      if (prev && inWindow(ms, prev.startMs, prev.endMs)) {
        prevTracks.push({ track, playlistId: pl.id, ms });
      }
    }
  }

  const artistCounts = new Map<string, number>();
  const playlistTrackCounts = new Map<string, number>();
  const playlistIds = new Set<string>();
  const trackEvents: { t: number }[] = [];
  const artistEvents: { t: number; id: string }[] = [];
  const playlistEvents: { t: number; id: string }[] = [];

  for (const { track, playlistId, ms } of tracks) {
    playlistIds.add(playlistId);
    playlistTrackCounts.set(
      playlistId,
      (playlistTrackCounts.get(playlistId) ?? 0) + 1,
    );
    if (ms != null) {
      trackEvents.push({ t: ms });
      playlistEvents.push({ t: ms, id: playlistId });
    }
    for (const a of track.artists) {
      const name = a.artistName.trim();
      if (!name) continue;
      artistCounts.set(name, (artistCounts.get(name) ?? 0) + 1);
      if (ms != null) artistEvents.push({ t: ms, id: name });
    }
  }

  const prevArtistCounts = new Set<string>();
  const prevPlaylistIds = new Set<string>();
  for (const { track, playlistId } of prevTracks) {
    prevPlaylistIds.add(playlistId);
    for (const a of track.artists) {
      const name = a.artistName.trim();
      if (name) prevArtistCounts.add(name);
    }
  }

  const topGenres = data.genres
    .map((g) => ({
      label: g.label,
      weight:
        g.playlistIds.filter((id) => playlistIds.has(id)).length ||
        (range === "all" ? g.weight : 0),
      color: g.color,
      value: 0,
    }))
    .map((g) => ({ ...g, value: g.weight }))
    .filter((g) => g.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10);

  const playlistById = new Map(data.playlists.map((p) => [p.id, p]));

  // Unique artists / playlists per bucket
  const artistLayout = resolveBucketLayout(
    range,
    artistEvents.map((e) => e.t),
    now,
  );
  const artistBuckets = Array.from(
    { length: artistLayout.bucketCount },
    () => new Set<string>(),
  );
  for (const e of artistEvents) {
    if (e.t < artistLayout.start || e.t > artistLayout.end) continue;
    const idx = Math.min(
      artistLayout.bucketCount - 1,
      Math.floor(
        ((e.t - artistLayout.start) /
          (artistLayout.end - artistLayout.start || 1)) *
          artistLayout.bucketCount,
      ),
    );
    artistBuckets[idx].add(e.id);
  }
  const artistsSeries = bucketSeriesPoints(
    artistEvents.map((e) => ({ t: e.t })),
    range,
    now,
  ).map((p, i) => ({ ...p, v: artistBuckets[i]?.size ?? 0 }));

  const plLayout = resolveBucketLayout(
    range,
    playlistEvents.map((e) => e.t),
    now,
  );
  const plBuckets = Array.from(
    { length: plLayout.bucketCount },
    () => new Set<string>(),
  );
  for (const e of playlistEvents) {
    if (e.t < plLayout.start || e.t > plLayout.end) continue;
    const idx = Math.min(
      plLayout.bucketCount - 1,
      Math.floor(
        ((e.t - plLayout.start) / (plLayout.end - plLayout.start || 1)) *
          plLayout.bucketCount,
      ),
    );
    plBuckets[idx].add(e.id);
  }
  const playlistsSeries = bucketSeriesPoints(
    playlistEvents.map((e) => ({ t: e.t })),
    range,
    now,
  ).map((p, i) => ({ ...p, v: plBuckets[i]?.size ?? 0 }));

  const tracksSeries = bucketSeriesPoints(trackEvents, range, now);

  return {
    tracksAdded: tracks.length,
    artistsTouched: artistCounts.size,
    playlistsActive: playlistIds.size,
    friendCount: data.stats.friendCount,
    tracksDelta: { pct: percentDelta(tracks.length, prevTracks.length) },
    artistsDelta: {
      pct: percentDelta(artistCounts.size, prevArtistCounts.size),
    },
    playlistsDelta: {
      pct: percentDelta(playlistIds.size, prevPlaylistIds.size),
    },
    tracksSeries,
    artistsSeries,
    playlistsSeries,
    trackSeries: tracksSeries.map((p) => p.v),
    hasDatedEvents: data.playlists.some((p) =>
      (p.tracks ?? []).some((t) => parseEventMs(t.addedAt, now) != null),
    ),
    topArtists: [...artistCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, tracks: count, value: count })),
    topGenres,
    topPlaylists: [...playlistTrackCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({
        id,
        name: playlistById.get(id)?.title ?? id,
        tracks: count,
        value: count,
      })),
    friends: (data.friends ?? []).map((f) => ({
      id: f.userId,
      name: f.displayName,
      value: 1,
    })),
  };
}

export interface CompanyEmployeeRankRow {
  id: string;
  name: string;
  title: string;
  location?: string;
  profilePicUrl?: string;
  linkedinUrl: string;
  followers: number;
  connections: number;
  value: number;
}

export interface CompanyEmploymentTimelineRow {
  id: string;
  name: string;
  title: string;
  profilePicUrl?: string;
  linkedinUrl: string;
  startedAt: number;
  startedLabel: string;
  tenure?: string;
}

export interface CompanyAnalyticsOverview {
  employeeCount: number;
  totalReported?: number;
  locationCount: number;
  schoolCount: number;
  avgConnections: number;
  avgFollowers: number;
  topLocations: { label: string; count: number; value: number }[];
  topSchools: { label: string; count: number; value: number; logoUrl?: string }[];
  topByFollowers: CompanyEmployeeRankRow[];
  topByConnections: CompanyEmployeeRankRow[];
  employmentTimeline: CompanyEmploymentTimelineRow[];
  /** Snapshot coverage bars (in graph vs LinkedIn-reported). */
  employeeSeries: ChartPoint[];
  snapshotOnly: true;
}

export function computeCompanyAnalytics(
  data: CompanyResult,
): CompanyAnalyticsOverview {
  const topLocations = data.stats.topLocations.slice(0, 12).map((l) => ({
    ...l,
    value: l.count,
  }));
  const topSchools = data.stats.topSchools.slice(0, 12).map((s) => ({
    ...s,
    value: s.count,
  }));

  const employeeSeries: ChartPoint[] = [
    {
      t: 0,
      label: "In graph",
      v: data.stats.employeeCount,
    },
    ...(data.stats.totalReported != null
      ? [
          {
            t: 1,
            label: "Reported",
            v: data.stats.totalReported,
          },
        ]
      : []),
  ];

  const ranked = data.employees.map((emp) => {
    const followers = emp.followerCount ?? 0;
    const connections = emp.connectionsCount ?? 0;
    return {
      id: emp.id,
      name: emp.fullName,
      title: emp.title,
      location: emp.location,
      profilePicUrl: emp.profilePicUrl,
      linkedinUrl: emp.linkedinUrl,
      followers,
      connections,
      value: Math.max(followers, connections),
    } satisfies CompanyEmployeeRankRow;
  });

  const topByFollowers = [...ranked]
    .sort((a, b) => b.followers - a.followers || b.connections - a.connections)
    .slice(0, 10)
    .map((row) => ({ ...row, value: row.followers || row.connections }));

  const topByConnections = [...ranked]
    .sort((a, b) => b.connections - a.connections || b.followers - a.followers)
    .slice(0, 10)
    .map((row) => ({ ...row, value: row.connections || row.followers }));

  let followerSum = 0;
  let followerN = 0;
  for (const emp of data.employees) {
    if (typeof emp.followerCount === "number") {
      followerSum += emp.followerCount;
      followerN += 1;
    }
  }

  const employmentTimeline = data.employees
    .filter(
      (emp): emp is typeof emp & { startedAt: number } =>
        typeof emp.startedAt === "number" && Number.isFinite(emp.startedAt),
    )
    .map((emp) => ({
      id: emp.id,
      name: emp.fullName,
      title: emp.title,
      profilePicUrl: emp.profilePicUrl,
      linkedinUrl: emp.linkedinUrl,
      startedAt: emp.startedAt,
      startedLabel: emp.startedLabel ?? new Date(emp.startedAt).getUTCFullYear().toString(),
      tenure: emp.tenure,
    }))
    .sort((a, b) => a.startedAt - b.startedAt);

  return {
    employeeCount: data.stats.employeeCount,
    totalReported: data.stats.totalReported,
    locationCount: data.stats.locationCount,
    schoolCount: data.stats.schoolCount,
    avgConnections: data.stats.avgConnections,
    avgFollowers: followerN > 0 ? Math.round(followerSum / followerN) : 0,
    topLocations,
    topSchools,
    topByFollowers,
    topByConnections,
    employmentTimeline,
    employeeSeries,
    snapshotOnly: true,
  };
}
