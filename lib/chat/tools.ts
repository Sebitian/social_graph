import { tool, type ToolSet } from "ai";
import { z } from "zod";
import {
  computeCompanyAnalytics,
  computeConferenceAnalytics,
  computeSocialAnalytics,
  computeTikTokAnalytics,
  inRange,
  parseEventMs,
  type AnalyticsRangeId,
} from "@/lib/analytics";
import type { CompanyEmployee, CompanyResult } from "@/lib/companyTypes";
import type { ConferenceAttendee, ConferenceResult } from "@/lib/conferenceTypes";
import { compareByCloseness, engagementVolume } from "@/lib/graphUtils";
import {
  instagramPersonRole,
  type InstagramPeopleResult,
  type InstagramPersonOption,
} from "@/lib/instagramPeople";
import type { TikTokResult, TikTokVideo } from "@/lib/tiktokTypes";
import type { GraphNode, PostComment, ProfilePost, ScrapeResult } from "@/lib/types";
import type { ChatBundle } from "./loadContext";
import { parseChatChart } from "./chart";
import { parseChatTable } from "./table";
import type { ChatSocialPlatform } from "./types";

const MAX_PEOPLE = 15;
const MAX_POSTS = 15;
const MAX_COMMENTS = 25;
const MAX_TEXT = 400;

const ANALYTICS_RANGES = [
  "1d",
  "7d",
  "14d",
  "30d",
  "90d",
  "all",
] as const satisfies readonly AnalyticsRangeId[];

function truncate(text: string, max = MAX_TEXT): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isSoftPresence(comment: PostComment): boolean {
  const post = comment.post ?? "";
  if (
    post === "Follower" ||
    post === "Following" ||
    post === "Tagged" ||
    post === "Mentioned"
  ) {
    return true;
  }
  const text = comment.text ?? "";
  return (
    text === "Follows this account" ||
    text === "Account follows this profile" ||
    text === "Follows this Page" ||
    text === "Page follows this account" ||
    text === "Tagged in this reel" ||
    text === "Mentioned in this reel"
  );
}

function memberPool(data: ScrapeResult): GraphNode[] {
  const byKey = new Map<string, GraphNode>();
  for (const node of [...(data.engagers ?? []), ...data.graph.nodes]) {
    if (node.group !== "member") continue;
    const key = (node.id || node.label).toLowerCase();
    const prev = byKey.get(key);
    if (!prev || (node.history?.length ?? 0) > (prev.history?.length ?? 0)) {
      byKey.set(key, node);
    }
  }
  return [...byKey.values()];
}

function realHistory(node: GraphNode): PostComment[] {
  return (node.history ?? []).filter((c) => !isSoftPresence(c));
}

function postTime(post: ProfilePost): number {
  return parseEventMs(post.postedAt) ?? 0;
}

function commentTime(comment: PostComment): number {
  return parseEventMs(comment.timestamp) ?? parseEventMs(comment.when) ?? 0;
}

function derivedPosts(data: ScrapeResult): ProfilePost[] {
  if (data.posts && data.posts.length > 0) return data.posts;
  const seen = new Map<string, ProfilePost>();
  for (const node of memberPool(data)) {
    for (const comment of realHistory(node)) {
      const id = comment.postId || comment.post;
      if (!id || seen.has(id)) continue;
      seen.set(id, {
        id,
        label: comment.post || id,
        postedAt: comment.timestamp,
      });
    }
  }
  return [...seen.values()];
}

function sortedPosts(data: ScrapeResult): ProfilePost[] {
  return [...derivedPosts(data)].sort((a, b) => postTime(b) - postTime(a));
}

function postMatches(
  comment: PostComment,
  post: { id?: string; label?: string },
): boolean {
  const needleId = (post.id ?? "").toLowerCase();
  const needleLabel = normalize(post.label ?? "");
  if (needleId && comment.postId && comment.postId.toLowerCase() === needleId) {
    return true;
  }
  if (needleLabel && normalize(comment.post ?? "") === needleLabel) return true;
  if (needleId && normalize(comment.post ?? "") === normalize(needleId)) {
    return true;
  }
  return false;
}

function personKey(node: GraphNode): string {
  return (node.label || node.id).replace(/^@/, "");
}

function serializePerson(node: GraphNode) {
  const history = realHistory(node);
  const latest = [...history].sort((a, b) => commentTime(b) - commentTime(a))[0];
  return {
    username: personKey(node),
    fullName: node.fullName ?? null,
    position: node.position ?? null,
    comments: node.comments,
    reactions: node.reactionsTotal ?? 0,
    engagementVolume: engagementVolume(node),
    postsCommentedOn: node.postsCommentedOn ?? history.length,
    labels: (node.labels ?? []).slice(0, 4).map((l) => l.label),
    latestComment: latest
      ? {
          text: truncate(latest.text),
          when: latest.when,
          post: latest.post,
        }
      : null,
  };
}

function serializeComment(comment: PostComment, author: string) {
  return {
    author,
    text: truncate(comment.text),
    when: comment.when,
    timestamp: comment.timestamp ?? null,
    post: comment.post,
    postId: comment.postId ?? null,
  };
}

function fuzzyScore(needle: string, haystack: string): number | null {
  if (!needle) return 0;
  const exact = haystack.indexOf(needle);
  if (exact >= 0) return exact;
  let searchFrom = 0;
  let score = 0;
  for (const char of needle) {
    const found = haystack.indexOf(char, searchFrom);
    if (found === -1) return null;
    score += found - searchFrom;
    searchFrom = found + 1;
  }
  return score + haystack.length - needle.length + 50;
}

export function queryOverview(
  data: ScrapeResult,
  range: AnalyticsRangeId = "all",
) {
  const overview = computeSocialAnalytics(data, range);
  return {
    profile: {
      username: data.profile.username,
      fullName: data.profile.fullName,
      platform: data.platform ?? null,
    },
    range,
    totals: {
      comments: overview.comments,
      reactions: overview.reactions,
      activeEngagers: overview.activeEngagers,
      postsTouched: overview.postsTouched,
      likes: overview.postLikes || null,
      plays: overview.postPlays || null,
      shares: overview.postShares || null,
    },
    feed: {
      count: overview.feed.count,
      likes: overview.feed.likes,
      comments: overview.feed.comments,
    },
    reels: {
      count: overview.reels.count,
      views: overview.reels.views || null,
      likes: overview.reels.likes,
      comments: overview.reels.comments,
    },
    graphShown: data.stats.shown,
    topCommentators: overview.topCommentators.slice(0, MAX_PEOPLE).map((row) => ({
      username: row.username,
      fullName: row.fullName ?? null,
      comments: row.comments,
    })),
    topEngagers: overview.topEngagers.slice(0, MAX_PEOPLE).map((row) => ({
      username: row.username,
      fullName: row.fullName ?? null,
      comments: row.comments,
      reactions: row.reactions,
      metric: row.metricLabel,
    })),
    topPosts: overview.topPosts.slice(0, 8).map((row) => ({
      id: row.id,
      label: row.label,
      comments: row.comments,
      reactions: row.reactions,
      plays: row.plays ?? null,
      likes: row.reactions,
      postType: row.postType ?? null,
    })),
    topFeedPosts: overview.feedPosts.slice(0, 8).map((row) => ({
      id: row.id,
      label: row.label,
      comments: row.comments,
      likes: row.reactions,
      postType: row.postType ?? null,
    })),
    topReelPosts: overview.reelPosts.slice(0, 8).map((row) => ({
      id: row.id,
      label: row.label,
      comments: row.comments,
      likes: row.reactions,
      views: row.plays ?? null,
      postType: row.postType ?? null,
    })),
    series: {
      comments: overview.commentsSeries.map((p) => ({
        t: p.t,
        label: p.label,
        v: p.v,
      })),
      reactions: overview.reactionsSeries.map((p) => ({
        t: p.t,
        label: p.label,
        v: p.v,
      })),
      engagers: overview.engagersSeries.map((p) => ({
        t: p.t,
        label: p.label,
        v: p.v,
      })),
      plays: overview.postPlaysSeries.map((p) => ({
        t: p.t,
        label: p.label,
        v: p.v,
      })),
      reelViews: overview.reels.viewsSeries.map((p) => ({
        t: p.t,
        label: p.label,
        v: p.v,
      })),
    },
  };
}

function commentCountForPost(data: ScrapeResult, post: ProfilePost): number {
  let count = 0;
  for (const node of memberPool(data)) {
    for (const comment of realHistory(node)) {
      if (postMatches(comment, post)) count += 1;
    }
  }
  return count;
}

export function queryPosts(data: ScrapeResult, limit = MAX_POSTS) {
  const posts = sortedPosts(data).slice(0, Math.min(limit, MAX_POSTS));
  const mapped = posts.map((post, index) => ({
    id: post.id,
    label: post.label,
    postedAt: post.postedAt ?? null,
    commentsInSnapshot: commentCountForPost(data, post),
    commentsCount: post.commentsCount ?? null,
    likesCount: post.likesCount ?? null,
    plays: post.videoPlayCount ?? null,
    sharesCount: post.sharesCount ?? null,
    isLatest: index === 0,
  }));
  return {
    count: derivedPosts(data).length,
    latest: mapped[0] ?? null,
    posts: mapped,
  };
}

export function queryFindPerson(data: ScrapeResult, query: string) {
  const needle = normalize(query.replace(/^@/, ""));
  if (!needle) return { matches: [] as ReturnType<typeof serializePerson>[] };

  const scored = memberPool(data)
    .map((node) => {
      const username = normalize(personKey(node));
      const fullName = normalize(node.fullName ?? "");
      let score: number | null = null;
      if (username === needle || fullName === needle) score = 0;
      else if (username.startsWith(needle) || fullName.startsWith(needle))
        score = 1;
      else {
        const u = fuzzyScore(needle, username);
        const n = fullName ? fuzzyScore(needle, fullName) : null;
        if (u == null && n == null) score = null;
        else score = 10 + Math.min(u ?? 999, n ?? 999);
      }
      return score == null ? null : { node, score };
    })
    .filter((row): row is { node: GraphNode; score: number } => row != null)
    .sort(
      (a, b) => a.score - b.score || compareByCloseness(a.node, b.node),
    )
    .slice(0, MAX_PEOPLE);

  return {
    query,
    matches: scored.map((row) => serializePerson(row.node)),
  };
}

export function queryComments(
  data: ScrapeResult,
  opts: {
    person?: string;
    post?: string;
    query?: string;
    latestPost?: boolean;
  },
) {
  const posts = sortedPosts(data);
  const latest = posts[0] ?? null;
  const postNeedle = opts.post?.trim();
  const wantLatest = Boolean(opts.latestPost) || (!opts.person && !opts.post && !opts.query);
  const targetPost = postNeedle
    ? posts.find(
        (p) =>
          p.id.toLowerCase() === postNeedle.toLowerCase() ||
          normalize(p.label) === normalize(postNeedle),
      ) ?? { id: postNeedle, label: postNeedle }
    : wantLatest
      ? latest
      : null;

  const personNeedle = opts.person
    ? normalize(opts.person.replace(/^@/, ""))
    : "";
  const textNeedle = opts.query ? normalize(opts.query) : "";

  const people = memberPool(data).filter((node) => {
    if (!personNeedle) return true;
    const username = normalize(personKey(node));
    const fullName = normalize(node.fullName ?? "");
    return (
      username === personNeedle ||
      username.includes(personNeedle) ||
      fullName.includes(personNeedle)
    );
  });

  const rows: ReturnType<typeof serializeComment>[] = [];
  for (const node of people) {
    const author = personKey(node);
    for (const comment of realHistory(node)) {
      if (targetPost && !postMatches(comment, targetPost)) continue;
      if (textNeedle && !normalize(comment.text).includes(textNeedle)) continue;
      rows.push(serializeComment(comment, author));
    }
  }

  rows.sort((a, b) => {
    const tb =
      parseEventMs(b.timestamp) ?? parseEventMs(b.when) ?? 0;
    const ta =
      parseEventMs(a.timestamp) ?? parseEventMs(a.when) ?? 0;
    return tb - ta;
  });

  return {
    filter: {
      person: opts.person ?? null,
      post: targetPost
        ? { id: targetPost.id, label: targetPost.label }
        : null,
      query: opts.query ?? null,
      latestPost: Boolean(targetPost && latest && targetPost.id === latest.id),
    },
    count: rows.length,
    comments: rows.slice(0, MAX_COMMENTS),
    truncated: rows.length > MAX_COMMENTS,
  };
}

const ROLE_ALIASES: Record<string, string[]> = {
  ceo: ["ceo", "chief executive"],
  eco: ["ceo", "chief executive"],
  cto: ["cto", "chief technology"],
  cfo: ["cfo", "chief financial"],
  coo: ["coo", "chief operating"],
  founder: ["founder", "co-founder", "cofounder"],
};

function serializeEmployee(emp: CompanyEmployee) {
  return {
    name: emp.fullName,
    username: emp.publicIdentifier,
    title: emp.title,
    headline: emp.headline,
    location: emp.location ?? null,
    tenure: emp.tenure ?? null,
    connections: emp.connectionsCount ?? null,
    followers: emp.followerCount ?? null,
    linkedinUrl: emp.linkedinUrl,
  };
}

export function queryCompanyOverview(data: CompanyResult) {
  const overview = computeCompanyAnalytics(data);
  return {
    source: "company" as const,
    company: {
      name: data.company.name,
      employeeCount: overview.employeeCount,
      totalReported: overview.totalReported ?? null,
      locationCount: overview.locationCount,
      schoolCount: overview.schoolCount,
    },
    leadership: data.employees
      .filter((emp) =>
        /ceo|chief|founder|president|vp\b/i.test(`${emp.title} ${emp.headline}`),
      )
      .slice(0, 12)
      .map(serializeEmployee),
    topByFollowers: overview.topByFollowers.slice(0, 8).map((row) => ({
      name: row.name,
      title: row.title,
      followers: row.followers,
    })),
    topLocations: overview.topLocations.slice(0, 6).map((row) => ({
      label: row.label,
      count: row.count,
    })),
  };
}

function serializeAttendee(person: ConferenceAttendee) {
  return {
    name: person.fullName,
    lumaName: person.lumaName,
    title: person.title || null,
    company: person.company ?? null,
    location: person.location ?? null,
    matchStatus: person.matchStatus,
    linkedinUrl: person.linkedinUrl ?? null,
    followers: person.followerCount ?? null,
    connections: person.connectionsCount ?? null,
  };
}

export function queryConferenceOverview(data: ConferenceResult) {
  const overview = computeConferenceAnalytics(data);
  return {
    source: "conference" as const,
    event: {
      name: data.event.name,
      attendeeCount: overview.attendeeCount,
      matchedCount: overview.matchedCount,
      unmatchedCount: overview.unmatchedCount,
      missingCount: overview.missingCount,
      companyCount: overview.companyCount,
      locationCount: overview.locationCount,
    },
    topCompanies: overview.topCompanies.slice(0, 8).map((row) => ({
      label: row.label,
      count: row.count,
    })),
    topLocations: overview.topLocations.slice(0, 6).map((row) => ({
      label: row.label,
      count: row.count,
    })),
    unmatched: data.attendees
      .filter((person) => person.matchStatus !== "matched")
      .map((person) => ({
        name: person.lumaName,
        status: person.matchStatus,
        note: person.matchNote ?? null,
      })),
  };
}

export function queryFindAttendee(data: ConferenceResult, query: string) {
  const needle = normalize(query.replace(/^@/, ""));
  if (!needle) return { source: "conference" as const, matches: [] };
  const tokens = needle.split(/\s+/).filter(Boolean);

  const scored = data.attendees
    .map((person) => {
      const hay = normalize(
        [
          person.fullName,
          person.lumaName,
          person.title,
          person.company,
          person.location,
          person.publicIdentifier,
        ]
          .filter(Boolean)
          .join(" "),
      );
      const hits = tokens.filter((token) => hay.includes(token)).length;
      return { person, hits };
    })
    .filter((row) => row.hits === tokens.length)
    .sort((a, b) => b.hits - a.hits);

  return {
    source: "conference" as const,
    matches: scored.slice(0, 8).map((row) => serializeAttendee(row.person)),
  };
}

export function queryFindEmployee(data: CompanyResult, query: string) {
  const needle = normalize(query.replace(/^@/, ""));
  if (!needle) return { source: "company" as const, matches: [] };

  const tokens = needle.split(/\s+/).filter(Boolean);
  const roleNeedles = new Set<string>();
  for (const token of tokens) {
    const aliases = ROLE_ALIASES[token];
    if (aliases) aliases.forEach((alias) => roleNeedles.add(alias));
  }

  const scored = data.employees
    .map((emp) => {
      const name = normalize(emp.fullName);
      const username = normalize(emp.publicIdentifier);
      const title = normalize(emp.title);
      const headline = normalize(emp.headline);
      const blob = `${name} ${username} ${title} ${headline}`;
      let score: number | null = null;
      if (name === needle || username === needle) score = 0;
      else if (name.includes(needle) || username.includes(needle)) score = 2;
      else {
        const fuzzy = fuzzyScore(needle, name) ?? fuzzyScore(needle, title);
        if (fuzzy != null) score = 20 + fuzzy;
      }
      if (roleNeedles.size > 0) {
        const roleHit = [...roleNeedles].some(
          (role) => title.includes(role) || headline.includes(role),
        );
        if (roleHit) score = score == null ? 1 : Math.min(score, 1);
      }
      if (score == null && tokens.every((token) => blob.includes(token))) {
        score = 8;
      }
      return score == null ? null : { emp, score };
    })
    .filter((row): row is { emp: CompanyEmployee; score: number } => row != null)
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_PEOPLE);

  return {
    source: "company" as const,
    company: data.company.name,
    query,
    matches: scored.map((row) => serializeEmployee(row.emp)),
  };
}

function videoTime(video: TikTokVideo): number {
  return parseEventMs(video.createTime) ?? 0;
}

function serializeTikTokVideo(video: TikTokVideo, index?: number) {
  return {
    id: video.id,
    text: truncate(video.text, 180),
    createdAt: video.createTime ?? null,
    plays: video.playCount,
    likes: video.diggCount,
    comments: video.commentCount,
    shares: video.shareCount,
    collects: video.collectCount,
    hashtags: video.hashtags.map((tag) => tag.name).slice(0, 8),
    music: video.musicName ?? null,
    url: video.url,
    isLatest: index === 0,
  };
}

function tiktokVideosInRange(
  data: TikTokResult,
  range: AnalyticsRangeId,
): TikTokVideo[] {
  if (range === "all") return data.videos;
  const now = Date.now();
  return data.videos.filter((video) =>
    inRange(parseEventMs(video.createTime, now), range, now),
  );
}

export function queryTikTokOverview(
  data: TikTokResult,
  range: AnalyticsRangeId = "all",
) {
  const overview = computeTikTokAnalytics(data, range);
  const inPeriod = tiktokVideosInRange(data, range);
  return {
    source: "tiktok" as const,
    profile: {
      username: data.profile.username,
      displayName: data.profile.displayName,
      followers: data.profile.followerCount,
      following: data.profile.followingCount,
      hearts: data.profile.heartCount,
      videoCount: data.profile.videoCount,
      verified: data.profile.verified,
      bio: truncate(data.profile.bio, 220),
    },
    range,
    totals: {
      plays: overview.plays,
      likes: overview.likes,
      shares: overview.shares,
      comments: inPeriod.reduce((sum, video) => sum + video.commentCount, 0),
      videosPosted: overview.videosPosted,
    },
    topVideos: overview.topVideos.slice(0, 8).map((row) => ({
      id: row.id,
      text: truncate(row.text, 120),
      plays: row.playCount,
      likes: row.diggCount,
      url: row.url,
    })),
    topHashtags: overview.topHashtags.slice(0, 8).map((row) => ({
      hashtag: row.label,
      videos: row.weight,
      plays: row.plays,
    })),
    series: {
      plays: overview.playsSeries.map((p) => ({
        t: p.t,
        label: p.label,
        v: p.v,
      })),
      likes: overview.likesSeries.map((p) => ({
        t: p.t,
        label: p.label,
        v: p.v,
      })),
      shares: overview.sharesSeries.map((p) => ({
        t: p.t,
        label: p.label,
        v: p.v,
      })),
    },
  };
}

export function queryTikTokVideos(data: TikTokResult, limit = MAX_POSTS) {
  const videos = [...data.videos]
    .sort((a, b) => videoTime(b) - videoTime(a))
    .slice(0, Math.min(limit, MAX_POSTS));
  const mapped = videos.map((video, index) => serializeTikTokVideo(video, index));
  return {
    source: "tiktok" as const,
    count: data.videos.length,
    latest: mapped[0] ?? null,
    videos: mapped,
  };
}

export function queryTikTokHashtag(data: TikTokResult, query?: string) {
  const needle = query ? normalize(query.replace(/^#/, "")) : "";
  const rows = data.hashtags
    .filter((tag) => {
      if (!needle) return true;
      return normalize(tag.label).includes(needle) || tag.id.toLowerCase() === needle;
    })
    .sort((a, b) => b.playCount - a.playCount || b.weight - a.weight)
    .slice(0, MAX_POSTS)
    .map((tag) => ({
      hashtag: tag.label,
      videos: tag.weight,
      plays: tag.playCount,
      likes: tag.diggCount,
      videoIds: tag.videoIds.slice(0, 8),
    }));
  return {
    source: "tiktok" as const,
    query: query ?? null,
    count: rows.length,
    hashtags: rows,
  };
}

function pickSocial(bundle: ChatBundle, source?: ChatSocialPlatform) {
  if (source) {
    const data = bundle.social[source];
    if (!data) {
      return {
        error: `No ${source} snapshot is loaded.`,
        available: bundle.sources.map((s) => s.id),
      };
    }
    return { source, data };
  }
  for (const id of ["linkedin", "instagram", "facebook"] as const) {
    const data = bundle.social[id];
    if (data) return { source: id, data };
  }
  return {
    error: "No person-graph snapshot is loaded.",
    available: bundle.sources.map((s) => s.id),
  };
}

function serializeInstagramEmployee(person: InstagramPersonOption) {
  const result = person.result;
  const members =
    result?.graph.nodes.filter((node) => node.group === "member").length ?? 0;
  return {
    username: person.username,
    fullName: person.fullName,
    title: person.title ?? null,
    role: instagramPersonRole(person),
    available: person.available,
    unavailableReason: person.unavailableReason ?? null,
    followers: person.followersCount ?? null,
    posts: result?.posts?.length ?? 0,
    graphPeople: members,
  };
}

function queryInstagramEmployees(data: InstagramPeopleResult | null) {
  const people = data?.people ?? [];
  return {
    source: "instagram" as const,
    companyHandle: data?.companyHandle ?? null,
    count: people.length,
    people: people.map(serializeInstagramEmployee),
  };
}

function queryFindInstagramEmployee(
  data: InstagramPeopleResult | null,
  query: string,
) {
  const people = data?.people ?? [];
  const needle = normalize(query.replace(/^@/, ""));
  if (!needle) {
    return { source: "instagram" as const, query, matches: [] };
  }
  const scored = people
    .map((person) => {
      const username = normalize(person.username);
      const fullName = normalize(person.fullName);
      const title = normalize(person.title ?? "");
      let score: number | null = null;
      if (username === needle || fullName === needle) score = 0;
      else if (username.startsWith(needle) || fullName.startsWith(needle))
        score = 1;
      else if (
        username.includes(needle) ||
        fullName.includes(needle) ||
        title.includes(needle)
      ) {
        score = 4;
      } else {
        const fuzzy =
          fuzzyScore(needle, username) ?? fuzzyScore(needle, fullName);
        if (fuzzy != null) score = 20 + fuzzy;
      }
      return score == null ? null : { person, score };
    })
    .filter(
      (row): row is { person: InstagramPersonOption; score: number } =>
        row != null,
    )
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_PEOPLE);

  return {
    source: "instagram" as const,
    companyHandle: data?.companyHandle ?? null,
    query,
    matches: scored.map((row) => serializeInstagramEmployee(row.person)),
  };
}

type InstagramAccountHit = {
  source: "instagram";
  account: string;
  kind: "company" | "employee";
  data: ScrapeResult;
};

function matchInstagramAccount(
  bundle: ChatBundle,
  account?: string,
): InstagramAccountHit | { error: string; available: string[] } {
  const company = bundle.social.instagram;
  const people = bundle.instagramPeople?.people ?? [];
  const available = [
    ...(company ? [company.profile.username] : []),
    ...people.map((person) => person.username),
  ];

  if (!account?.trim()) {
    if (company) {
      return {
        source: "instagram",
        account: company.profile.username,
        kind: "company",
        data: company,
      };
    }
    const first = people.find((person) => person.available && person.result);
    if (first?.result) {
      return {
        source: "instagram",
        account: first.username,
        kind: "employee",
        data: first.result,
      };
    }
    return {
      error: "No Instagram snapshot is loaded.",
      available,
    };
  }

  const needle = normalize(account.replace(/^@/, ""));
  if (company) {
    const username = normalize(company.profile.username);
    const fullName = normalize(company.profile.fullName);
    if (
      username === needle ||
      fullName === needle ||
      username.startsWith(needle) ||
      fullName.includes(needle)
    ) {
      return {
        source: "instagram",
        account: company.profile.username,
        kind: "company",
        data: company,
      };
    }
  }

  const scored = people
    .map((person) => {
      const username = normalize(person.username);
      const fullName = normalize(person.fullName);
      const title = normalize(person.title ?? "");
      let score: number | null = null;
      if (username === needle || fullName === needle) score = 0;
      else if (username.startsWith(needle) || fullName.startsWith(needle))
        score = 1;
      else if (
        username.includes(needle) ||
        fullName.includes(needle) ||
        title.includes(needle)
      ) {
        score = 3;
      }
      return score == null ? null : { person, score };
    })
    .filter(
      (row): row is { person: InstagramPersonOption; score: number } =>
        row != null,
    )
    .sort((a, b) => a.score - b.score);

  const hit = scored[0]?.person;
  if (!hit) {
    return {
      error: `No Instagram account matches "${account}".`,
      available,
    };
  }
  if (!hit.available || !hit.result) {
    return {
      error: `${hit.fullName} (@${hit.username}) has no Instagram graph${
        hit.unavailableReason ? `: ${hit.unavailableReason}` : ""
      }.`,
      available,
    };
  }
  return {
    source: "instagram",
    account: hit.username,
    kind: "employee",
    data: hit.result,
  };
}

function pickSocialAccount(
  bundle: ChatBundle,
  source?: ChatSocialPlatform,
  account?: string,
) {
  if (account?.trim() && (!source || source === "instagram")) {
    return matchInstagramAccount(bundle, account);
  }
  if (source === "instagram") {
    return matchInstagramAccount(bundle, account);
  }
  return pickSocial(bundle, source);
}

function instagramQueryTargets(
  bundle: ChatBundle,
): InstagramAccountHit[] {
  const targets: InstagramAccountHit[] = [];
  const company = bundle.social.instagram;
  if (company) {
    targets.push({
      source: "instagram",
      account: company.profile.username,
      kind: "company",
      data: company,
    });
  }
  for (const person of bundle.instagramPeople?.people ?? []) {
    if (!person.available || !person.result) continue;
    targets.push({
      source: "instagram",
      account: person.username,
      kind: "employee",
      data: person.result,
    });
  }
  return targets;
}

export function createChatTools(bundle: ChatBundle): ToolSet {
  const socialEnum = ["linkedin", "instagram", "facebook"] as const;
  const loadedSocial = socialEnum.filter((id) => bundle.social[id]);
  const hasSocial = loadedSocial.length > 0;
  const sourceEnum = (
    hasSocial ? loadedSocial : socialEnum
  ) as [(typeof socialEnum)[number], ...(typeof socialEnum)[number][]];
  const sourceField = z
    .enum(sourceEnum)
    .optional()
    .describe(
      "Which selected person-graph snapshot to query. Omit to use the first selected social account.",
    );
  const accountField = z
    .string()
    .optional()
    .describe(
      "Instagram company or employee @handle / name (kossof_salonspa, joanna_artistry, Jenny). Defaults to the salon company account. Aiman (@nuancedaiman) is a separate Instagram job, not salon staff. Ignored for LinkedIn and Facebook.",
    );

  const presentTable = tool({
    description:
      "Render a styled comparison table in the chat UI. Always use this for last/recent posts across platforms, rankings, and side-by-side metrics. Do not write those as bullets after calling this.",
    inputSchema: z.object({
      title: z
        .string()
        .max(80)
        .optional()
        .describe("Short table title, e.g. Platform performance."),
      caption: z
        .string()
        .max(160)
        .optional()
        .describe("Optional footnote under the table."),
      columns: z
        .array(
          z.object({
            key: z
              .string()
              .min(1)
              .max(40)
              .describe("Row object key, e.g. reactions."),
            label: z
              .string()
              .min(1)
              .max(40)
              .describe("Column header shown in the UI."),
            align: z
              .enum(["left", "right"])
              .optional()
              .describe("Right-align numeric columns."),
          }),
        )
        .min(2)
        .max(8),
      rows: z
        .array(
          z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
        )
        .min(1)
        .max(20)
        .describe(
          "One object per row. Keys must match column keys. Prefer raw numbers over preformatted strings.",
        ),
    }),
    execute: async (input) => {
      const table = parseChatTable(input);
      if (!table) {
        return { error: "Table needs at least two columns and one row." };
      }
      return table;
    },
  });

  const presentChart = tool({
    description:
      "Render an interactive time-series chart (stock-style hover). Use for trends over time from overview series (comments, reactions, plays, likes). Do not restate the same series as a table.",
    inputSchema: z.object({
      title: z
        .string()
        .max(80)
        .optional()
        .describe("Short chart title, e.g. Instagram engagement over time."),
      caption: z
        .string()
        .max(160)
        .optional()
        .describe("Optional footnote under the chart."),
      yLabel: z
        .string()
        .max(40)
        .optional()
        .describe("Y-axis label, e.g. Plays."),
      series: z
        .array(
          z.object({
            id: z.string().min(1).max(40),
            label: z.string().min(1).max(40),
            color: z.string().optional(),
            points: z
              .array(
                z.object({
                  t: z
                    .number()
                    .optional()
                    .describe("Unix timestamp in milliseconds when known."),
                  label: z.string().min(1).max(32),
                  v: z.number().describe("Raw numeric value."),
                }),
              )
              .min(2)
              .max(40),
          }),
        )
        .min(1)
        .max(4)
        .describe(
          "Copy series from get_overview / get_tiktok_overview. One series per metric or platform.",
        ),
    }),
    execute: async (input) => {
      const chart = parseChatChart(input);
      if (!chart) {
        return { error: "Chart needs at least one series with two points." };
      }
      return chart;
    },
  });

  const listSources = tool({
    description:
      "List the snapshots currently selected for this question, including Instagram employee accounts when loaded.",
    inputSchema: z.object({}),
    execute: async () => ({
      sources: bundle.sources,
      instagramAccounts: bundle.social.instagram
        ? [
            {
              username: bundle.social.instagram.profile.username,
              fullName: bundle.social.instagram.profile.fullName,
              kind: "company" as const,
              available: true,
            },
            ...(bundle.instagramPeople?.people ?? []).map(
              serializeInstagramEmployee,
            ),
          ]
        : [],
    }),
  });

  const socialTools = hasSocial
    ? {
        get_overview: tool({
          description:
            "Person-graph totals, top engagers, top posts, and time series for charts. Instagram splits feed vs reels (likes, comments, and reel views). Series include comments, reactions, engagers, plays, and reelViews. Plays/views are lifetime totals on posts published in the range, bucketed by post date. For an Instagram employee graph, pass account=@handle.",
          inputSchema: z.object({
            source: sourceField,
            account: accountField,
            range: z
              .enum(ANALYTICS_RANGES)
              .optional()
              .describe("Time window. Defaults to all available data."),
          }),
          execute: async ({ source, account, range }) => {
            const picked = pickSocialAccount(bundle, source, account);
            if ("error" in picked) return picked;
            return {
              source: picked.source,
              ...("account" in picked
                ? { account: picked.account, kind: picked.kind }
                : {}),
              ...queryOverview(picked.data, range ?? "all"),
            };
          },
        }),
        list_posts: tool({
          description:
            "List recent posts newest first, with comments, likes, and plays/views when the snapshot has them. Use with present_table for a sortable ranking. For an Instagram employee, pass account=@handle.",
          inputSchema: z.object({
            source: sourceField,
            account: accountField,
            limit: z
              .number()
              .int()
              .min(1)
              .max(MAX_POSTS)
              .optional()
              .describe("How many posts to return. Default 10."),
          }),
          execute: async ({ source, account, limit }) => {
            const picked = pickSocialAccount(bundle, source, account);
            if ("error" in picked) return picked;
            return {
              source: picked.source,
              ...("account" in picked
                ? { account: picked.account, kind: picked.kind }
                : {}),
              ...queryPosts(picked.data, limit ?? 10),
            };
          },
        }),
        find_person: tool({
          description:
            "Look up a commenter/engager by username or name in person-graph snapshots, including Instagram employee graphs. Also matches Instagram employee roster names. Not the LinkedIn company roster.",
          inputSchema: z.object({
            query: z
              .string()
              .min(1)
              .describe("Username, @handle, or full name to search for."),
            source: sourceField,
            account: accountField,
          }),
          execute: async ({ query, source, account }) => {
            const targets: Array<
              | { source: ChatSocialPlatform; data: ScrapeResult }
              | InstagramAccountHit
            > = [];
            const searchInstagram =
              !source || source === "instagram" || Boolean(account);

            if (searchInstagram) {
              if (account) {
                const picked = matchInstagramAccount(bundle, account);
                if ("error" in picked) return picked;
                targets.push(picked);
              } else {
                targets.push(...instagramQueryTargets(bundle));
              }
            }

            if (source && source !== "instagram") {
              const picked = pickSocial(bundle, source);
              if ("error" in picked) return picked;
              targets.push(picked);
            } else if (!source) {
              for (const id of ["linkedin", "facebook"] as const) {
                const data = bundle.social[id];
                if (data) targets.push({ source: id, data });
              }
            }

            const matches: Array<Record<string, unknown>> = [];
            if (
              searchInstagram &&
              !account &&
              bundle.instagramPeople?.people.length
            ) {
              const roster = queryFindInstagramEmployee(
                bundle.instagramPeople,
                query,
              );
              for (const person of roster.matches) {
                matches.push({
                  source: "instagram",
                  kind: "employee",
                  account: person.username,
                  ...person,
                });
              }
            }

            for (const picked of targets) {
              const found = queryFindPerson(picked.data, query);
              matches.push(
                ...found.matches.map((person) => ({
                  source: picked.source,
                  ...("account" in picked
                    ? { account: picked.account, kind: picked.kind }
                    : {}),
                  ...person,
                })),
              );
            }
            return { query, matches: matches.slice(0, MAX_PEOPLE) };
          },
        }),
        get_comments: tool({
          description:
            "Fetch comments from a person-graph snapshot. Filter by person and/or post. For an Instagram employee graph, pass account=@handle.",
          inputSchema: z.object({
            source: sourceField,
            account: accountField,
            person: z
              .string()
              .optional()
              .describe("Username or display name of the commenter."),
            post: z
              .string()
              .optional()
              .describe("Post id or post label/title."),
            query: z
              .string()
              .optional()
              .describe("Optional text search within comment bodies."),
            latestPost: z
              .boolean()
              .optional()
              .describe("If true, restrict to the most recent post."),
          }),
          execute: async (input) => {
            const picked = pickSocialAccount(
              bundle,
              input.source,
              input.account,
            );
            if ("error" in picked) return picked;
            return {
              source: picked.source,
              ...("account" in picked
                ? { account: picked.account, kind: picked.kind }
                : {}),
              ...queryComments(picked.data, input),
            };
          },
        }),
      }
    : {};

  const company = bundle.company;
  const companyTools = company
    ? {
        get_company_overview: tool({
          description:
            "LinkedIn company roster summary: name, headcount, leadership, top employees. Use for company questions.",
          inputSchema: z.object({}),
          execute: async () => queryCompanyOverview(company),
        }),
        find_employee: tool({
          description:
            "Look up someone on the LinkedIn company roster by name, title, or role (CEO, founder, etc.).",
          inputSchema: z.object({
            query: z
              .string()
              .min(1)
              .describe("Employee name, @handle, or role such as CEO / founder."),
          }),
          execute: async ({ query }) => queryFindEmployee(company, query),
        }),
      }
    : {};

  const instagramPeople = bundle.instagramPeople;
  const instagramPeopleTools = instagramPeople?.people.length
    ? {
        list_instagram_employees: tool({
          description:
            "List Instagram people on this salon run: employees, with availability and follower counts.",
          inputSchema: z.object({}),
          execute: async () => queryInstagramEmployees(instagramPeople),
        }),
        find_instagram_employee: tool({
          description:
            "Look up a salon Instagram person by name, @handle, or title. Use this for Joanna, Jenny, Brentley, Donna, and other rostered staff. Then get_overview / list_posts with account=@handle for their graph.",
          inputSchema: z.object({
            query: z
              .string()
              .min(1)
              .describe("Employee name, @handle, or role/title."),
          }),
          execute: async ({ query }) =>
            queryFindInstagramEmployee(instagramPeople, query),
        }),
      }
    : {};

  const tiktok = bundle.tiktok;
  const tiktokTools = tiktok
    ? {
        get_tiktok_overview: tool({
          description:
            "TikTok snapshot totals, top videos, top hashtags, and time series (plays/likes/shares) for charts.",
          inputSchema: z.object({
            range: z
              .enum(ANALYTICS_RANGES)
              .optional()
              .describe("Time window. Defaults to all available data."),
          }),
          execute: async ({ range }) =>
            queryTikTokOverview(tiktok, range ?? "all"),
        }),
        list_tiktok_videos: tool({
          description:
            "List recent TikTok videos, newest first, with plays, likes, comments, shares, and hashtags.",
          inputSchema: z.object({
            limit: z
              .number()
              .int()
              .min(1)
              .max(MAX_POSTS)
              .optional()
              .describe("How many videos to return. Default 10."),
          }),
          execute: async ({ limit }) =>
            queryTikTokVideos(tiktok, limit ?? 10),
        }),
        find_tiktok_hashtag: tool({
          description:
            "Look up TikTok hashtags by name, or list the top hashtags if no query is given.",
          inputSchema: z.object({
            query: z
              .string()
              .optional()
              .describe("Hashtag name without #. Omit to list top hashtags."),
          }),
          execute: async ({ query }) => queryTikTokHashtag(tiktok, query),
        }),
      }
    : {};

  const conference = bundle.conference;
  const conferenceTools = conference
    ? {
        get_conference_overview: tool({
          description:
            "Conference attendee snapshot: guest count, LinkedIn match coverage, companies, and locations.",
          inputSchema: z.object({}),
          execute: async () => queryConferenceOverview(conference),
        }),
        find_attendee: tool({
          description:
            "Look up a conference guest by Luma name, LinkedIn name, title, or company.",
          inputSchema: z.object({
            query: z
              .string()
              .min(1)
              .describe("Attendee name, company, or role."),
          }),
          execute: async ({ query }) => queryFindAttendee(conference, query),
        }),
      }
    : {};

  return {
    list_sources: listSources,
    ...socialTools,
    ...companyTools,
    ...instagramPeopleTools,
    ...tiktokTools,
    ...conferenceTools,
    present_table: presentTable,
    present_chart: presentChart,
  } as ToolSet;
}

export function chatSystemPrompt(bundle: ChatBundle): string {
  const catalog = [
    ...bundle.sources.map(
      (source) =>
        `- ${source.label}: ${source.title}${source.subtitle ? ` (${source.subtitle})` : ""}`,
    ),
    ...(bundle.instagramPeople?.people ?? []).map((person) => {
      const status = person.available
        ? "graph available"
        : person.unavailableReason || "no graph";
      const kind =
        instagramPersonRole(person) === "person"
          ? "Instagram person"
          : "Instagram employee";
      return `- ${kind}: ${person.fullName} (@${person.username})${person.title ? `, ${person.title}` : ""} — ${status}`;
    }),
  ].join("\n");
  const hasSocial = Boolean(
    bundle.social.linkedin || bundle.social.instagram || bundle.social.facebook,
  );
  const lines = [
    "You are Starling Chat, an assistant for social, company, and conference snapshots.",
    "The user selected these sources for this question. Only use them. If asked about a platform that is not listed, say it is not selected.",
    catalog || "- none",
  ];
  if (hasSocial) {
    lines.push(
      "Use list_sources, get_overview, find_person, and get_comments for person-graph engagement (comments/reactions).",
      "Instagram get_overview.feed / reels split posts vs reels (likes, comments, views). Instagram has no reaction types. series.plays and series.reelViews are lifetime view totals on items published in the range, plotted by post date.",
      "To compare views across Instagram, Facebook, and TikTok: call each overview with the same range (e.g. 7d), then present_chart with one series per platform (copy series.plays). LinkedIn has comments and reactions, not views.",
    );
  }
  if (bundle.company) {
    lines.push(
      "Use get_company_overview and find_employee for the LinkedIn company roster (employees, CEO, titles).",
      "Company people are not commenters. If a name is not in the person graph, try the company roster before saying they are missing.",
    );
  }
  if (bundle.instagramPeople?.people.length) {
    lines.push(
      "Instagram includes the salon company account and employee graphs (Joanna, Jenny, Brentley, Donna). Use list_instagram_employees and find_instagram_employee for that roster. Aiman Naqvi (@nuancedaiman) is a separate Instagram job.",
      "For an employee's own posts, comments, or overview, call get_overview / list_posts / get_comments / find_person with source=instagram and account=@their_handle. Donna has no graph if marked unavailable.",
      "Company-graph people are commenters on the salon account. Employees may not appear there even when their person graph exists.",
    );
  }
  if (bundle.tiktok) {
    lines.push(
      "Use get_tiktok_overview, list_tiktok_videos, and find_tiktok_hashtag for TikTok videos, plays, likes, shares, and hashtags. TikTok has no commenter graph in Chat.",
    );
  }
  if (bundle.conference) {
    lines.push(
      "Use get_conference_overview and find_attendee for the Luma guest list (names, companies, locations, LinkedIn match status).",
      "Unmatched guests were on the Luma list but did not get a confident LinkedIn profile. Do not treat unmatched LinkedIn names as attendees.",
    );
  }
  lines.push(
    "Use present_table for last/recent posts, rankings, and side-by-side snapshots (Platform, Posted, Post, metrics). Never answer 'last post' across multiple accounts as a bullet list.",
    "After present_table or present_chart, write at most one or two sentences. Do not paste a markdown table, restated rows, or the same intro twice — the UI already shows the tool output.",
    "Use present_chart for trends over time. Pass the series arrays from get_overview or get_tiktok_overview (t, label, v). Overlay platforms by putting each plays series on the same chart. The UI is an interactive stock-style chart — do not dump the same points as a table or bullet list.",
    "Keep prose short: one or two sentences around a table or chart. Skip long captions and nested quotes when a table already has the post title.",
    "Cite people as @handles when they are social accounts, and by full name + title for employees.",
    "Format leftover prose in Markdown: **bold** for names/dates, short lists only when a table does not fit. Avoid ## headings unless the answer has 3+ distinct sections.",
    "Only state facts tools return. Do not invent names, comments, titles, or chart points.",
    "Answers come from frozen snapshots, not live scraping. Spotify is not in Chat yet.",
  );
  return lines.join("\n");
}
