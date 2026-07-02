import { ApifyClient } from "apify-client";
import {
  deriveFeatures,
  deriveLabels,
  deriveRelationshipEdge,
  extractInteractionSignals,
} from "./labels";
import type { Commentator, PostComment, ProfileData } from "./types";
import { MAX_NODES, compareByCloseness, computePresenceScore } from "./graphUtils";
import type { ScrapeBudget } from "./scrapeBudget";
import { normalizeScrapeBudget } from "./scrapeBudget";

// Actor IDs for the scrapers (run in sequence).
const ACTORS = {
  profile: "apify/instagram-profile-scraper",
  comments: "SbK00X0JYCPblD2wp",
} as const;

interface PostRef {
  url: string;
  label: string;
}

function getClient(): ApifyClient | null {
  const token = process.env.APIFY_TOKEN;
  if (!token) return null;
  return new ApifyClient({ token });
}

/** Whether real scraping is configured. */
export function isApifyConfigured(): boolean {
  return Boolean(process.env.APIFY_TOKEN);
}

async function runActor<T>(
  client: ApifyClient,
  actorId: string,
  input: Record<string, unknown>,
): Promise<T[]> {
  const run = await client.actor(actorId).call(input, { waitSecs: 120 });
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return items as T[];
}

/** Scraper 1: profile metadata. Confirms the account exists. */
export async function scrapeProfile(handle: string): Promise<ProfileData> {
  const client = getClient();
  if (!client) throw new Error("APIFY_TOKEN is required for live scraping");

  const items = await runActor<Record<string, unknown>>(client, ACTORS.profile, {
    usernames: [handle],
  });
  const raw = items[0];
  if (!raw) throw new Error(`Profile not found for @${handle}`);

  return profileFromRaw(raw, handle);
}

function profileFromRaw(raw: Record<string, unknown>, handle: string): ProfileData {
  return {
    username: String(raw.username ?? handle),
    fullName: String(raw.fullName ?? ""),
    biography: String(raw.biography ?? ""),
    profilePicUrl: String(raw.profilePicUrl ?? raw.profilePicUrlHD ?? ""),
    followersCount: Number(raw.followersCount ?? 0),
    followingCount: Number(raw.followsCount ?? raw.followingCount ?? 0),
    postsCount: Number(raw.postsCount ?? 0),
    isPrivate: Boolean(raw.private ?? raw.isPrivate ?? false),
    isVerified: Boolean(raw.verified ?? raw.isVerified ?? false),
    highlightReelCount: Number(raw.highlightReelCount ?? 0),
  };
}

function readString(raw: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function readValue(raw: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const parts = key.split(".");
    let value: unknown = raw;
    for (const part of parts) {
      if (!value || typeof value !== "object") {
        value = undefined;
        break;
      }
      value = (value as Record<string, unknown>)[part];
    }
    if (value != null && value !== "") return value;
  }
  return undefined;
}

function readNestedString(raw: Record<string, unknown>, key: string): string | undefined {
  const [parent, child] = key.split(".");
  const value = raw[parent];
  if (!value || typeof value !== "object") return undefined;
  const nested = (value as Record<string, unknown>)[child];
  return typeof nested === "string" && nested.trim() ? nested.trim() : undefined;
}

function shortcodeFromUrl(url: string): string | undefined {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/i);
  return match?.[1];
}

function canonicalPostKey(value: string): string {
  const shortcode = shortcodeFromUrl(value);
  if (shortcode) return shortcode.toLowerCase();
  return value.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
}

function compactPostLabel(label: string): string {
  const clean = label.replace(/\s+/g, " ").trim();
  return clean.length > 64 ? `${clean.slice(0, 61)}...` : clean;
}

function inferPostType(text: string): PostComment["postType"] {
  if (/reel/i.test(text)) return "reel";
  if (/carousel|dump/i.test(text)) return "carousel";
  if (/birthday|hbd/i.test(text)) return "birthday";
  if (/graduation|promotion|anniversary|milestone/i.test(text)) return "milestone";
  if (/travel|trip|beach|hotel|flight|airport|lisbon|paris|london|nyc/i.test(text)) return "travel";
  if (/work|studio|client|project|campaign|launch/i.test(text)) return "work";
  if (/concert|festival|wedding|party|event|dinner/i.test(text)) return "event";
  return "unknown";
}

function mentionedUsers(text: string): string[] {
  return [...new Set([...text.matchAll(/@([a-z0-9._]{1,30})/gi)].map((m) => m[1].toLowerCase()))];
}

function labelFromPost(post: Record<string, unknown>, url: string): string {
  const label = readString(post, [
    "title",
    "caption",
    "alt",
    "accessibilityCaption",
    "description",
    "text",
  ]);
  if (label) return compactPostLabel(label);

  const shortcode =
    readString(post, ["shortCode", "shortcode", "code"]) ?? shortcodeFromUrl(url);
  return shortcode ? `Post ${shortcode}` : "Instagram post";
}

function postRefFromRaw(raw: unknown): PostRef | undefined {
  if (typeof raw === "string") {
    if (!raw.includes("instagram.com/")) return undefined;
    const shortcode = shortcodeFromUrl(raw);
    return { url: raw, label: shortcode ? `Post ${shortcode}` : "Instagram post" };
  }
  if (!raw || typeof raw !== "object") return undefined;

  const post = raw as Record<string, unknown>;
  const url = readString(post, ["url", "postUrl", "inputUrl", "link", "permalink"]);
  if (url?.includes("instagram.com/")) {
    return { url, label: labelFromPost(post, url) };
  }

  const shortcode = readString(post, ["shortCode", "shortcode", "code"]);
  if (shortcode) {
    const derivedUrl = `https://www.instagram.com/p/${shortcode}`;
    return { url: derivedUrl, label: labelFromPost(post, derivedUrl) };
  }

  return undefined;
}

function extractPostRefs(
  profileRaw: Record<string, unknown>,
  postLimit: number,
): PostRef[] {
  const refs = new Map<string, PostRef>();
  const sources = [
    profileRaw.latestPosts,
    profileRaw.posts,
    profileRaw.latestReels,
    profileRaw.reels,
    profileRaw.latestIgtvVideos,
  ];

  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const post of source) {
      const ref = postRefFromRaw(post);
      if (ref) refs.set(canonicalPostKey(ref.url), ref);
      if (refs.size >= postLimit) return [...refs.values()];
    }
  }

  return [...refs.values()];
}

async function scrapeProfileWithPosts(
  client: ApifyClient,
  handle: string,
  budget: ScrapeBudget,
): Promise<{ profile: ProfileData; posts: PostRef[] }> {
  const items = await runActor<Record<string, unknown>>(client, ACTORS.profile, {
    usernames: [handle],
  });
  const raw = items[0];
  if (!raw) throw new Error(`Profile not found for @${handle}`);

  return {
    profile: profileFromRaw(raw, handle),
    posts: extractPostRefs(raw, budget.postLimit),
  };
}

function dateFromValue(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    return new Date(ms);
  }
  if (typeof value !== "string" || !value.trim()) return null;

  const clean = value.trim();
  if (/^\d+$/.test(clean)) {
    const numeric = Number(clean);
    const ms = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
    return new Date(ms);
  }

  const parsed = Date.parse(clean);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

function relativeStringFromValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.trim().match(/^(\d+)\s*(second|minute|hour|day|week|month|year|s|m|h|d|w|mo|y)s?(?:\s+ago)?$/i);
  if (!match) return undefined;

  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith("s")) return n === 1 ? "1 second ago" : `${n} seconds ago`;
  if (unit === "m" || unit.startsWith("minute")) return n === 1 ? "1 minute ago" : `${n} minutes ago`;
  if (unit.startsWith("h")) return n === 1 ? "1 hour ago" : `${n} hours ago`;
  if (unit.startsWith("d")) return n === 1 ? "1 day ago" : `${n} days ago`;
  if (unit.startsWith("w")) return n === 1 ? "1 week ago" : `${n} weeks ago`;
  if (unit === "mo" || unit.startsWith("month")) return n === 1 ? "1 month ago" : `${n} months ago`;
  return n === 1 ? "1 year ago" : `${n} years ago`;
}

function relativeTime(value: unknown): string {
  const relative = relativeStringFromValue(value);
  if (relative) return relative;

  const date = dateFromValue(value);
  if (!date || Number.isNaN(date.getTime())) return "recently";

  const days = Math.max(0, Math.round((Date.now() - date.getTime()) / 86_400_000));
  if (days < 1) return "today";
  if (days < 7) return days === 1 ? "1 day ago" : `${days} days ago`;

  const weeks = Math.round(days / 7);
  if (weeks < 104) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;

  const years = Math.round(days / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

function commentFromRaw(raw: Record<string, unknown>): {
  authorId?: string;
  username: string;
  fullName?: string;
  profilePicUrl?: string;
  text: string;
  when: string;
  timestamp?: string;
  post: string;
  postId?: string;
  isReply?: boolean;
  isTopLevel?: boolean;
  ownerReplied?: boolean;
  mentionedUsers?: string[];
  postType?: PostComment["postType"];
  captionCategory?: string;
} | null {
  const username =
    readString(raw, ["ownerUsername", "username", "authorUsername", "userUsername"]) ??
    readNestedString(raw, "owner.username") ??
    readNestedString(raw, "user.username") ??
    readNestedString(raw, "author.username");

  const text = readString(raw, ["text", "comment", "commentText", "message", "body"]);
  if (!username || !text) return null;

  const timestampValue = readValue(raw, [
    "commentTimestamp",
    "commentCreatedAt",
    "commentCreatedAtUtc",
    "commentDate",
    "commentTime",
    "createdAtUtc",
    "createdAt",
    "timestamp",
    "date",
    "time",
  ]);
  const date = dateFromValue(timestampValue);
  const post =
    readString(raw, ["postTitle", "postCaption", "caption", "title"]) ??
    readString(raw, ["postShortCode", "shortCode", "shortcode", "postUrl", "url"]) ??
    "Instagram post";

  return {
    authorId:
      readString(raw, ["ownerId", "authorId", "userId", "owner.id"]) ??
      readNestedString(raw, "owner.id") ??
      readNestedString(raw, "user.id") ??
      readNestedString(raw, "author.id"),
    username,
    fullName:
      readString(raw, ["ownerFullName", "fullName", "authorFullName", "userFullName"]) ??
      readNestedString(raw, "owner.fullName") ??
      readNestedString(raw, "user.fullName") ??
      readNestedString(raw, "author.fullName"),
    profilePicUrl:
      readString(raw, ["ownerProfilePicUrl", "profilePicUrl", "authorProfilePicUrl"]) ??
      readNestedString(raw, "owner.profilePicUrl") ??
      readNestedString(raw, "user.profilePicUrl") ??
      readNestedString(raw, "author.profilePicUrl"),
    text,
    when: relativeTime(timestampValue),
    timestamp: date?.toISOString(),
    post,
    postId: readString(raw, ["postId", "post.id", "postShortCode", "shortCode", "shortcode", "postUrl", "url"]),
    isReply: Boolean(readValue(raw, ["isReply", "isCommentReply", "parentCommentId"])),
    isTopLevel: !readValue(raw, ["isReply", "isCommentReply", "parentCommentId"]),
    ownerReplied: Boolean(readValue(raw, ["ownerReplied", "hasOwnerReply", "viewerHasLiked"])),
    mentionedUsers: mentionedUsers(text),
    postType: inferPostType(`${post} ${text}`),
    captionCategory: inferPostType(post),
  };
}

async function scrapeCommentators(
  client: ApifyClient,
  posts: PostRef[],
  profile: ProfileData,
  budget: ScrapeBudget,
): Promise<{ commentators: Commentator[]; scanned: number }> {
  const postLabels = new Map<string, string>();
  for (const post of posts) {
    postLabels.set(canonicalPostKey(post.url), post.label);
  }

  const items = await runActor<Record<string, unknown>>(client, ACTORS.comments, {
    directUrls: posts.map((post) => post.url),
    resultsLimit: budget.commentsPerPost,
  });

  const byUsername = new Map<
    string,
    {
      username: string;
      fullName?: string;
      profilePicUrl?: string;
      history: PostComment[];
    }
  >();
  const self = profile.username.toLowerCase();

  for (const raw of items) {
    const comment = commentFromRaw(raw);
    if (!comment || comment.username.toLowerCase() === self) continue;

    const id = comment.username.toLowerCase();
    const existing = byUsername.get(id) ?? {
      username: comment.username,
      fullName: comment.fullName,
      profilePicUrl: comment.profilePicUrl,
      history: [],
    };

    existing.fullName ??= comment.fullName;
    existing.profilePicUrl ??= comment.profilePicUrl;
    const postLabel = postLabels.get(canonicalPostKey(comment.post)) ?? comment.post;
    existing.history.push({
      authorId: comment.authorId,
      authorUsername: comment.username,
      postId: comment.postId,
      text: comment.text,
      when: comment.when,
      timestamp: comment.timestamp,
      post: postLabel.includes("instagram.com/") ? "Instagram post" : postLabel,
      isReply: comment.isReply,
      isTopLevel: comment.isTopLevel,
      ownerReplied: comment.ownerReplied,
      mentionedUsers: comment.mentionedUsers,
      postType: comment.postType,
      captionCategory: comment.captionCategory,
    });
    byUsername.set(id, existing);
  }

  const ranked = [...byUsername.values()]
    .map((person) => {
      const enriched = person.history.map((comment) => ({
        ...comment,
        signals: extractInteractionSignals(comment),
      }));
      const presenceScore = computePresenceScore(enriched);
      return {
        ...person,
        history: enriched,
        comments: enriched.length,
        presenceScore,
        features: deriveFeatures(enriched),
      };
    })
    .sort(compareByCloseness)
    .slice(0, MAX_NODES);

  return {
    scanned: items.length,
    commentators: ranked.map((person) => {
      const labels = deriveLabels(person.history);
      const features = deriveFeatures(person.history);
      return {
        username: person.username,
        fullName: person.fullName,
        profilePicUrl: person.profilePicUrl,
        comments: person.history.length,
        circle: -1,
        history: person.history,
        labels,
        features,
        relationshipEdge: deriveRelationshipEdge(profile.username.toLowerCase(), person.username.toLowerCase(), labels, features),
      };
    }),
  };
}

function mergePeerCounts(
  base: Record<string, number> | undefined,
  extra: Record<string, number>,
): Record<string, number> {
  const out = { ...(base ?? {}) };
  for (const [peerId, count] of Object.entries(extra)) {
    out[peerId] = (out[peerId] ?? 0) + count;
  }
  return out;
}

interface FriendPostRef extends PostRef {
  friendId: string;
}

/**
 * Scrape recent posts from top commenters and detect outbound comments from
 * the searched account plus cross-profile peer comment counts.
 */
async function scrapeReciprocity(
  client: ApifyClient,
  profile: ProfileData,
  commentators: Commentator[],
  budget: ScrapeBudget,
): Promise<{ commentators: Commentator[]; scanned: number }> {
  if (
    !budget.reciprocityEnabled ||
    budget.reciprocityFriends <= 0 ||
    budget.reciprocityPostsPerFriend <= 0 ||
    commentators.length === 0
  ) {
    return { commentators, scanned: 0 };
  }

  const self = profile.username.toLowerCase();
  const topFriends = commentators.slice(0, budget.reciprocityFriends);
  const friendUsernames = topFriends.map((c) => c.username);

  const profileItems = await runActor<Record<string, unknown>>(client, ACTORS.profile, {
    usernames: friendUsernames,
  });

  const friendPosts: FriendPostRef[] = [];
  const observedFriendIds = new Set<string>();

  for (const raw of profileItems) {
    const username = String(raw.username ?? "").toLowerCase();
    if (!username) continue;
    if (Boolean(raw.private ?? raw.isPrivate)) continue;

    observedFriendIds.add(username);
    const posts = extractPostRefs(raw, budget.reciprocityPostsPerFriend);
    for (const post of posts) {
      friendPosts.push({ friendId: username, url: post.url, label: post.label });
    }
  }

  if (friendPosts.length === 0) {
    return { commentators, scanned: 0 };
  }

  const postToFriend = new Map<string, string>();
  for (const fp of friendPosts) {
    postToFriend.set(canonicalPostKey(fp.url), fp.friendId);
    const shortcode = shortcodeFromUrl(fp.url);
    if (shortcode) postToFriend.set(shortcode.toLowerCase(), fp.friendId);
  }

  const items = await runActor<Record<string, unknown>>(client, ACTORS.comments, {
    directUrls: friendPosts.map((post) => post.url),
    resultsLimit: budget.commentsPerPost,
  });

  const outboundFromTarget = new Map<string, number>();
  const peerIncrements = new Map<string, Record<string, number>>();
  const commentatorIds = new Set(commentators.map((c) => c.username.toLowerCase()));

  for (const raw of items) {
    const comment = commentFromRaw(raw);
    if (!comment) continue;

    const postKeys = [
      comment.postId ? canonicalPostKey(comment.postId) : null,
      canonicalPostKey(comment.post),
    ].filter((k): k is string => Boolean(k));

    let friendId: string | undefined;
    for (const key of postKeys) {
      friendId = postToFriend.get(key);
      if (friendId) break;
    }
    if (!friendId) continue;

    const authorId = comment.username.toLowerCase();
    if (authorId === self) {
      outboundFromTarget.set(friendId, (outboundFromTarget.get(friendId) ?? 0) + 1);
      continue;
    }

    if (!commentatorIds.has(authorId)) continue;
    const peers = peerIncrements.get(authorId) ?? {};
    peers[friendId] = (peers[friendId] ?? 0) + 1;
    peerIncrements.set(authorId, peers);
  }

  const updated = commentators.map((commentator) => {
    const id = commentator.username.toLowerCase();
    const reciprocityObserved = observedFriendIds.has(id);
    const outbound = reciprocityObserved ? (outboundFromTarget.get(id) ?? 0) : undefined;
    const peerComments = mergePeerCounts(commentator.peerComments, peerIncrements.get(id) ?? {});
    const features = deriveFeatures(commentator.history, {
      outboundFromTarget: outbound,
      reciprocityObserved,
      reciprocityPostsCap: budget.reciprocityPostsPerFriend,
    });
    const labels = deriveLabels(commentator.history, {
      outboundFromTarget: outbound,
      reciprocityObserved,
      reciprocityPostsCap: budget.reciprocityPostsPerFriend,
    });
    const relationshipEdge = deriveRelationshipEdge(
      self,
      id,
      labels,
      features,
    );

    return {
      ...commentator,
      peerComments: Object.keys(peerComments).length ? peerComments : commentator.peerComments,
      outboundFromTarget: outbound,
      features,
      labels,
      relationshipEdge,
    };
  });

  return { commentators: updated, scanned: items.length };
}

/**
 * Runs the live comments actor and converts its dataset into graph-ready
 * commentators ranked by how often they comment on the searched account's posts.
 */
export interface RawNetwork {
  profile: ProfileData;
  commentators: Commentator[];
  scanned: number;
}

/** Orchestrates scraping in the required sequence, then clusters the result. */
export async function scrapeNetwork(
  handle: string,
  inputBudget: Partial<ScrapeBudget> = {},
): Promise<RawNetwork> {
  const client = getClient();
  if (!client) throw new Error("APIFY_TOKEN is required for live scraping");
  const budget = normalizeScrapeBudget(inputBudget);

  const { profile, posts } = await scrapeProfileWithPosts(client, handle, budget);
  if (profile.isPrivate) {
    throw new Error(`@${profile.username} is private, so comments cannot be scraped`);
  }
  if (posts.length === 0) {
    throw new Error(`No recent Instagram post or reel URLs found for @${profile.username}`);
  }

  const { commentators, scanned } = await scrapeCommentators(
    client,
    posts,
    profile,
    budget,
  );

  const reciprocity = await scrapeReciprocity(client, profile, commentators, budget);

  return {
    profile,
    commentators: reciprocity.commentators,
    scanned: scanned + reciprocity.scanned,
  };
}

/** Parse one Apify-style or hand-exported comment row. */
export function parseCommentRecord(raw: Record<string, unknown>) {
  return commentFromRaw(raw);
}
