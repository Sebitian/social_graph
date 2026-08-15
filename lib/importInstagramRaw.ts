import {
  buildGraph,
  buildMemberNodes,
  compareByCloseness,
  computeStats,
  MAX_NODES,
} from "./graphUtils";
import {
  deriveFeatures,
  deriveLabels,
  deriveRelationshipEdge,
  extractInteractionSignals,
} from "./labels";
import { seedAudienceHistory } from "./audienceHistory";
import { estimateScrapeBudget } from "./scrapeBudget";
import type {
  Commentator,
  PostComment,
  PostEngagement,
  ProfileData,
  ProfilePost,
  ScrapeResult,
} from "./types";

/** Raw profile row from apify/instagram-profile-scraper. */
export interface RawInstagramProfile {
  id?: string;
  username?: string;
  fullName?: string;
  biography?: string;
  profilePicUrl?: string;
  profilePicUrlHD?: string;
  url?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  private?: boolean;
  verified?: boolean;
  highlightReelCount?: number;
  businessCategoryName?: string;
  about?: {
    date_joined?: string;
    country?: string;
  };
  latestPosts?: RawInstagramPost[];
}

export interface RawInstagramTaggedUser {
  username?: string;
  full_name?: string;
  profile_pic_url?: string;
  is_verified?: boolean;
  id?: string;
}

/** Raw post row from apify/instagram-post-scraper. */
export interface RawInstagramPost {
  id?: string;
  shortCode?: string;
  type?: string;
  productType?: string;
  caption?: string;
  url?: string;
  displayUrl?: string;
  timestamp?: string;
  likesCount?: number;
  commentsCount?: number;
  hashtags?: string[];
  mentions?: string[];
  taggedUsers?: RawInstagramTaggedUser[];
  coauthorProducers?: RawInstagramTaggedUser[];
  locationName?: string;
  ownerUsername?: string;
  ownerId?: string;
  ownerFullName?: string;
  videoUrl?: string;
  videoPlayCount?: number;
  videoViewCount?: number;
}

/** Nested comment on a reel (latestComments). */
export interface RawInstagramEmbeddedComment {
  id?: string;
  text?: string;
  ownerUsername?: string;
  ownerProfilePicUrl?: string;
  timestamp?: string;
  likesCount?: number;
  owner?: {
    username?: string;
    full_name?: string;
    profile_pic_url?: string;
    is_verified?: boolean;
    id?: string;
  };
}

/** Raw reel row from apify/instagram-reel-scraper. */
export interface RawInstagramReel {
  id?: string;
  shortCode?: string;
  type?: string;
  productType?: string;
  caption?: string;
  url?: string;
  displayUrl?: string;
  timestamp?: string;
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  videoPlayCount?: number;
  videoViewCount?: number;
  videoDuration?: number;
  hashtags?: string[];
  mentions?: string[];
  taggedUsers?: Array<{
    username?: string;
    full_name?: string;
    profile_pic_url?: string;
    is_verified?: boolean;
    id?: string;
  }>;
  latestComments?: RawInstagramEmbeddedComment[];
  ownerUsername?: string;
  ownerId?: string;
  ownerFullName?: string;
  locationName?: string;
  transcript?: string;
}

/** Dedicated comment row from apify/instagram-comment-scraper. */
export interface RawInstagramComment {
  id?: string;
  text?: string;
  timestamp?: string;
  ownerUsername?: string;
  ownerProfilePicUrl?: string;
  postUrl?: string;
  likesCount?: number;
  owner?: {
    username?: string;
    full_name?: string;
    profile_pic_url?: string;
    is_verified?: boolean;
    id?: string;
  };
}

/** Single follower row inside seemuapps/instagram-followers-scraper results. */
export interface RawInstagramFollower {
  relation?: string;
  userId?: string;
  username?: string;
  displayName?: string;
  isPrivate?: boolean;
  isVerified?: boolean;
  profilePicUrl?: string;
}

/** Top-level followers scraper export (cursor + results). */
export interface RawInstagramFollowersPage {
  cursor_next?: string | null;
  results?: RawInstagramFollower[];
}

export interface InstagramRawInputs {
  profile?: RawInstagramProfile | null;
  posts: RawInstagramPost[];
  reels?: RawInstagramReel[];
  comments?: RawInstagramComment[];
  followers?: RawInstagramFollower[];
  /** Followers / tags / mentions with no comments or reactions. Default true. */
  includeSoftPresence?: boolean;
}

function relativeWhen(timestamp?: string): string {
  if (!timestamp) return "recently";
  const ms = Date.parse(timestamp);
  if (Number.isNaN(ms)) return "recently";

  const days = Math.max(0, Math.round((Date.now() - ms) / 86_400_000));
  if (days < 1) return "today";
  if (days < 7) return days === 1 ? "1 day ago" : `${days} days ago`;

  const weeks = Math.round(days / 7);
  if (weeks < 104) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;

  const years = Math.round(days / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

function postSnippet(content?: string, max = 72): string {
  const clean = (content ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "Instagram post";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function shortcodeFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/i);
  return m?.[1];
}

function normalizeLikes(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return value;
}

type PersonAccumulator = {
  username: string;
  fullName?: string;
  profilePicUrl?: string;
  position?: string;
  isVerified?: boolean;
  history: PostComment[];
  commentedPostIds: Set<string>;
  postEngagement: Record<string, PostEngagement>;
  followRelation?: "follower" | "following";
  seenCommentIds: Set<string>;
};

function ensurePerson(
  byKey: Map<string, PersonAccumulator>,
  key: string,
  seed: Partial<PersonAccumulator> & { username: string },
): PersonAccumulator {
  const existing = byKey.get(key);
  if (existing) {
    existing.fullName ??= seed.fullName;
    existing.profilePicUrl ??= seed.profilePicUrl;
    existing.position ??= seed.position;
    existing.isVerified ??= seed.isVerified;
    existing.followRelation ??= seed.followRelation;
    return existing;
  }

  // Merge id-keyed and username-keyed rows for the same handle.
  const usernameKey = `user:${seed.username.toLowerCase()}`;
  const byUsername = byKey.get(usernameKey);
  if (byUsername && key !== usernameKey) {
    byUsername.fullName ??= seed.fullName;
    byUsername.profilePicUrl ??= seed.profilePicUrl;
    byUsername.position ??= seed.position;
    byUsername.isVerified ??= seed.isVerified;
    byUsername.followRelation ??= seed.followRelation;
    byKey.set(key, byUsername);
    return byUsername;
  }
  if (key.startsWith("id:")) {
    for (const person of byKey.values()) {
      if (person.username.toLowerCase() === seed.username.toLowerCase()) {
        person.fullName ??= seed.fullName;
        person.profilePicUrl ??= seed.profilePicUrl;
        person.position ??= seed.position;
        person.isVerified ??= seed.isVerified;
        person.followRelation ??= seed.followRelation;
        byKey.set(key, person);
        byKey.set(usernameKey, person);
        return person;
      }
    }
  }

  const created: PersonAccumulator = {
    username: seed.username,
    fullName: seed.fullName,
    profilePicUrl: seed.profilePicUrl,
    position: seed.position,
    isVerified: seed.isVerified,
    history: [],
    commentedPostIds: new Set(),
    postEngagement: {},
    followRelation: seed.followRelation,
    seenCommentIds: new Set(),
  };
  byKey.set(key, created);
  if (key !== usernameKey) byKey.set(usernameKey, created);
  return created;
}

function ensurePostEngagement(
  person: PersonAccumulator,
  postId: string,
): PostEngagement {
  const existing = person.postEngagement[postId];
  if (existing) return existing;
  const created: PostEngagement = { commented: false };
  person.postEngagement[postId] = created;
  return created;
}

function buildProfile(
  handle: string,
  profile: RawInstagramProfile | null | undefined,
  posts: RawInstagramPost[],
): ProfileData {
  const owner = posts.find((p) => p.ownerUsername)?.ownerUsername;
  const username = (profile?.username || owner || handle).replace(/^@/, "");
  const bioParts = [
    profile?.biography?.trim(),
    profile?.businessCategoryName?.trim(),
    profile?.about?.date_joined
      ? `Joined ${profile.about.date_joined}`
      : undefined,
  ].filter(Boolean);

  return {
    username,
    fullName: profile?.fullName || username,
    biography: bioParts.join(" · "),
    profilePicUrl:
      profile?.profilePicUrlHD || profile?.profilePicUrl || "",
    followersCount: profile?.followersCount ?? 0,
    followingCount: profile?.followsCount ?? 0,
    postsCount: profile?.postsCount ?? posts.length,
    isPrivate: Boolean(profile?.private),
    isVerified: Boolean(profile?.verified),
    highlightReelCount: profile?.highlightReelCount ?? 0,
    profileUrl: profile?.url || `https://www.instagram.com/${username}/`,
  };
}

function resolvePostType(
  post: RawInstagramPost,
  reelById: Map<string, RawInstagramReel>,
): string {
  if (reelById.has(post.id ?? "")) return "Reel";
  if (post.productType === "clips") return "Reel";
  return post.type || "Image";
}

function reelToProfilePost(reel: RawInstagramReel): ProfilePost | null {
  if (!reel.id) return null;
  return {
    id: reel.id,
    url: reel.url,
    label: postSnippet(reel.caption),
    postedAt: reel.timestamp,
    imageUrl: reel.displayUrl,
    likesCount: normalizeLikes(reel.likesCount),
    commentsCount: reel.commentsCount,
    sharesCount: reel.sharesCount,
    videoPlayCount: reel.videoPlayCount ?? reel.videoViewCount,
    videoViewCount: reel.videoViewCount,
    postType: "Reel",
  };
}

function mergeReelOntoPost(post: ProfilePost, reel: ProfilePost): ProfilePost {
  return {
    ...post,
    url: reel.url || post.url,
    label: reel.label || post.label,
    postedAt: reel.postedAt || post.postedAt,
    imageUrl: reel.imageUrl || post.imageUrl,
    likesCount: reel.likesCount ?? post.likesCount,
    commentsCount: reel.commentsCount ?? post.commentsCount,
    sharesCount: reel.sharesCount ?? post.sharesCount,
    videoPlayCount: reel.videoPlayCount ?? post.videoPlayCount,
    videoViewCount: reel.videoViewCount ?? post.videoViewCount,
    postType: "Reel",
  };
}

export function mergeReelsIntoProfilePosts(
  posts: ProfilePost[],
  reels: RawInstagramReel[],
): ProfilePost[] {
  const byId = new Map(posts.map((post) => [post.id, { ...post }]));
  for (const reel of reels) {
    const extra = reelToProfilePost(reel);
    if (!extra) continue;
    const existing = byId.get(extra.id);
    byId.set(extra.id, existing ? mergeReelOntoPost(existing, extra) : extra);
  }
  return [...byId.values()].sort((a, b) => {
    const ta = a.postedAt ? Date.parse(a.postedAt) : 0;
    const tb = b.postedAt ? Date.parse(b.postedAt) : 0;
    return tb - ta;
  });
}

function buildProfilePosts(
  posts: RawInstagramPost[],
  reels: RawInstagramReel[],
): ProfilePost[] {
  const reelById = new Map(
    reels.filter((r) => r.id).map((r) => [r.id as string, r]),
  );
  const built: ProfilePost[] = [];

  for (const post of posts) {
    if (!post.id) continue;
    const reel = reelById.get(post.id);
    const row: ProfilePost = {
      id: post.id,
      url: post.url || reel?.url,
      label: postSnippet(post.caption || reel?.caption),
      postedAt: post.timestamp || reel?.timestamp,
      imageUrl: post.displayUrl || reel?.displayUrl,
      likesCount: normalizeLikes(reel?.likesCount ?? post.likesCount),
      commentsCount: reel?.commentsCount ?? post.commentsCount,
      sharesCount: reel?.sharesCount,
      videoPlayCount:
        reel?.videoPlayCount ?? post.videoPlayCount ?? reel?.videoViewCount,
      videoViewCount: reel?.videoViewCount,
      postType: resolvePostType(post, reelById),
    };
    built.push(row);
  }

  return mergeReelsIntoProfilePosts(built, reels);
}

function postIdFromComment(
  comment: RawInstagramComment,
  urlToPostId: Map<string, string>,
): string | undefined {
  const shortcode = shortcodeFromUrl(comment.postUrl);
  if (shortcode && urlToPostId.has(shortcode)) return urlToPostId.get(shortcode);
  if (comment.postUrl && urlToPostId.has(comment.postUrl)) {
    return urlToPostId.get(comment.postUrl);
  }
  return undefined;
}

function peopleFromInstagram(
  handle: string,
  posts: RawInstagramPost[],
  reels: RawInstagramReel[],
  comments: RawInstagramComment[],
  followers: RawInstagramFollower[],
  selfIds: Set<string>,
): Commentator[] {
  const byKey = new Map<string, PersonAccumulator>();
  const totalPostsScraped = posts.length || reels.length;
  const postMeta = new Map<string, { url?: string; label: string }>();
  const urlToPostId = new Map<string, string>();

  for (const post of posts) {
    if (!post.id) continue;
    postMeta.set(post.id, {
      url: post.url,
      label: postSnippet(post.caption),
    });
    if (post.url) urlToPostId.set(post.url, post.id);
    if (post.shortCode) urlToPostId.set(post.shortCode, post.id);
  }
  for (const reel of reels) {
    if (!reel.id) continue;
    if (!postMeta.has(reel.id)) {
      postMeta.set(reel.id, {
        url: reel.url,
        label: postSnippet(reel.caption),
      });
    }
    if (reel.url) urlToPostId.set(reel.url, reel.id);
    if (reel.shortCode) urlToPostId.set(reel.shortCode, reel.id);
  }

  const addComment = (opts: {
    username?: string;
    fullName?: string;
    profilePicUrl?: string;
    isVerified?: boolean;
    userId?: string;
    text?: string;
    timestamp?: string;
    postId?: string;
    commentId?: string;
    postType?: PostComment["postType"];
  }) => {
    const username = opts.username?.replace(/^@/, "").trim().toLowerCase();
    if (!username || username === handle) return;
    if (opts.userId && selfIds.has(opts.userId)) return;

    const key = opts.userId ? `id:${opts.userId}` : `user:${username}`;
    const person = ensurePerson(byKey, key, {
      username,
      fullName: opts.fullName,
      profilePicUrl: opts.profilePicUrl,
      isVerified: opts.isVerified,
    });

    const text = (opts.text ?? "").trim();
    if (!text) return;

    const dedupeKey = opts.commentId || `${opts.postId ?? ""}:${text}:${opts.timestamp ?? ""}`;
    if (person.seenCommentIds.has(dedupeKey)) return;
    person.seenCommentIds.add(dedupeKey);

    if (opts.postId) {
      person.commentedPostIds.add(opts.postId);
      ensurePostEngagement(person, opts.postId).commented = true;
    }

    const meta = opts.postId ? postMeta.get(opts.postId) : undefined;
    person.history.push({
      authorId: opts.userId,
      authorUsername: person.username,
      postId: opts.postId,
      text,
      when: relativeWhen(opts.timestamp),
      timestamp: opts.timestamp,
      post: meta?.label ?? "Instagram post",
      isReply: false,
      isTopLevel: true,
      ownerReplied: false,
      mentionedUsers: [],
      postType: opts.postType ?? "unknown",
      captionCategory: "unknown",
    });
  };

  for (const comment of comments) {
    addComment({
      username: comment.ownerUsername || comment.owner?.username,
      fullName: comment.owner?.full_name,
      profilePicUrl:
        comment.ownerProfilePicUrl || comment.owner?.profile_pic_url,
      isVerified: comment.owner?.is_verified,
      userId: comment.owner?.id,
      text: comment.text,
      timestamp: comment.timestamp,
      postId: postIdFromComment(comment, urlToPostId),
      commentId: comment.id,
    });
  }

  for (const reel of reels) {
    if (!reel.id) continue;
    for (const comment of reel.latestComments ?? []) {
      addComment({
        username: comment.ownerUsername || comment.owner?.username,
        fullName: comment.owner?.full_name,
        profilePicUrl:
          comment.ownerProfilePicUrl || comment.owner?.profile_pic_url,
        isVerified: comment.owner?.is_verified,
        userId: comment.owner?.id,
        text: comment.text,
        timestamp: comment.timestamp,
        postId: reel.id,
        commentId: comment.id,
        postType: "reel",
      });
    }

    for (const tagged of reel.taggedUsers ?? []) {
      const username = tagged.username?.replace(/^@/, "").trim().toLowerCase();
      if (!username || username === handle) continue;
      if (tagged.id && selfIds.has(tagged.id)) continue;
      const key = tagged.id ? `id:${tagged.id}` : `user:${username}`;
      const person = ensurePerson(byKey, key, {
        username,
        fullName: tagged.full_name,
        profilePicUrl: tagged.profile_pic_url,
        isVerified: tagged.is_verified,
        position: "Tagged in reel",
      });
      if (person.history.length === 0) {
        // Soft presence only — no dated timestamp so analytics don't count tags as comments.
        person.history.push({
          authorUsername: person.username,
          postId: reel.id,
          text: "Tagged in this reel",
          when: "recently",
          post: "Tagged",
          isReply: false,
          isTopLevel: true,
          postType: "reel",
          captionCategory: "unknown",
        });
      }
    }

    for (const mention of reel.mentions ?? []) {
      const username = mention.replace(/^@/, "").trim().toLowerCase();
      if (!username || username === handle) continue;
      const key = `user:${username}`;
      const person = ensurePerson(byKey, key, {
        username,
        position: "Mentioned in reel",
      });
      if (person.history.length === 0) {
        person.history.push({
          authorUsername: person.username,
          postId: reel.id,
          text: "Mentioned in this reel",
          when: "recently",
          post: "Mentioned",
          isReply: false,
          isTopLevel: true,
          postType: "reel",
          captionCategory: "unknown",
        });
      }
    }
  }

  const addSoftTag = (opts: {
    username?: string;
    fullName?: string;
    profilePicUrl?: string;
    isVerified?: boolean;
    userId?: string;
    postId?: string;
    position: string;
    text: string;
    postType?: PostComment["postType"];
  }) => {
    const username = opts.username?.replace(/^@/, "").trim().toLowerCase();
    if (!username || username === handle) return;
    if (opts.userId && selfIds.has(opts.userId)) return;
    const key = opts.userId ? `id:${opts.userId}` : `user:${username}`;
    const person = ensurePerson(byKey, key, {
      username,
      fullName: opts.fullName,
      profilePicUrl: opts.profilePicUrl,
      isVerified: opts.isVerified,
      position: opts.position,
    });
    if (person.history.length === 0) {
      person.history.push({
        authorUsername: person.username,
        postId: opts.postId,
        text: opts.text,
        when: "recently",
        post: "Tagged",
        isReply: false,
        isTopLevel: true,
        postType: opts.postType ?? "unknown",
        captionCategory: "unknown",
      });
    }
  };

  for (const post of posts) {
    if (!post.id) continue;
    const postType: PostComment["postType"] =
      post.productType === "clips" || post.type === "Video" ? "reel" : "unknown";

    for (const tagged of post.taggedUsers ?? []) {
      addSoftTag({
        username: tagged.username,
        fullName: tagged.full_name,
        profilePicUrl: tagged.profile_pic_url,
        isVerified: tagged.is_verified,
        userId: tagged.id,
        postId: post.id,
        position: "Tagged in post",
        text: "Tagged in this post",
        postType,
      });
    }

    for (const coauthor of post.coauthorProducers ?? []) {
      addSoftTag({
        username: coauthor.username,
        fullName: coauthor.full_name,
        profilePicUrl: coauthor.profile_pic_url,
        isVerified: coauthor.is_verified,
        userId: coauthor.id,
        postId: post.id,
        position: "Collaborator",
        text: "Co-authored this post",
        postType,
      });
    }

    const captionMentions = [
      ...(post.mentions ?? []),
      ...((post.caption ?? "").match(/@([a-z0-9._]+)/gi) ?? []).map((m) =>
        m.slice(1),
      ),
    ];
    for (const mention of captionMentions) {
      addSoftTag({
        username: mention,
        postId: post.id,
        position: "Mentioned in post",
        text: "Mentioned in this post",
        postType,
      });
    }
  }

  for (const follower of followers) {
    const username = follower.username?.replace(/^@/, "").trim().toLowerCase();
    if (!username || username === handle) continue;
    if (follower.userId && selfIds.has(follower.userId)) continue;

    const key = follower.userId ? `id:${follower.userId}` : `user:${username}`;
    const relation =
      follower.relation === "following" ? "following" : "follower";
    const person = ensurePerson(byKey, key, {
      username,
      fullName: follower.displayName || undefined,
      profilePicUrl: follower.profilePicUrl,
      isVerified: follower.isVerified,
      position:
        relation === "follower" ? "Follower" : "Following",
      followRelation: relation,
    });

    if (person.history.length === 0) {
      person.history.push({
        authorUsername: person.username,
        text:
          relation === "follower"
            ? "Follows this account"
            : "Account follows this profile",
        when: "recently",
        post: relation === "follower" ? "Follower" : "Following",
        isReply: false,
        isTopLevel: true,
        postType: "unknown",
        captionCategory: "unknown",
      });
    }
  }

  const uniquePeople = [...new Set(byKey.values())];

  return uniquePeople
    .map((person) => {
      const enriched = person.history.map((comment) => ({
        ...comment,
        signals: extractInteractionSignals(comment),
      }));
      const labels = deriveLabels(enriched);
      const features = deriveFeatures(enriched);
      const realComments = enriched.filter(
        (c) =>
          c.post !== "Follower" &&
          c.post !== "Following" &&
          c.post !== "Tagged" &&
          c.post !== "Mentioned" &&
          c.text !== "Follows this account" &&
          c.text !== "Account follows this profile" &&
          c.text !== "Tagged in this reel" &&
          c.text !== "Mentioned in this reel" &&
          c.text !== "Tagged in this post" &&
          c.text !== "Mentioned in this post" &&
          c.text !== "Co-authored this post",
      ).length;

      return {
        username: person.username,
        fullName: person.fullName,
        profilePicUrl: person.profilePicUrl,
        position: person.position,
        isVerified: person.isVerified,
        comments:
          realComments > 0
            ? realComments
            : person.followRelation ||
                person.position === "Tagged in reel" ||
                person.position === "Mentioned in reel" ||
                person.position === "Tagged in post" ||
                person.position === "Mentioned in post" ||
                person.position === "Collaborator"
              ? 0
              : enriched.length,
        circle: -1,
        history: enriched,
        labels,
        features,
        relationshipEdge: deriveRelationshipEdge(
          handle,
          person.username.toLowerCase(),
          labels,
          features,
        ),
        postsCommentedOn: person.commentedPostIds.size,
        totalPostsScraped,
        postEngagement:
          Object.keys(person.postEngagement).length > 0
            ? { ...person.postEngagement }
            : undefined,
      } satisfies Commentator;
    })
    .sort(compareByCloseness);
}

/** True when the array looks like instagram-profile-scraper output. */
export function isInstagramProfileDataset(
  raw: unknown,
): raw is RawInstagramProfile[] {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  const first = raw[0];
  return Boolean(
    first &&
      typeof first === "object" &&
      "username" in first &&
      ("followersCount" in first || "postsCount" in first || "biography" in first),
  );
}

/** True when the array looks like instagram-post-scraper output. */
export function isInstagramPostsDataset(raw: unknown): raw is RawInstagramPost[] {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  const sample = raw.slice(0, 10);
  return sample.some(
    (item) =>
      item &&
      typeof item === "object" &&
      "shortCode" in item &&
      ("likesCount" in item || "ownerUsername" in item) &&
      !("videoPlayCount" in item && "transcript" in item),
  );
}

/** Flatten reel-scraper export, skipping empty/error rows. */
export function flattenInstagramReels(raw: unknown): RawInstagramReel[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is RawInstagramReel => {
    if (!item || typeof item !== "object") return false;
    const row = item as RawInstagramReel;
    return Boolean(row.id);
  });
}

/** True when the array looks like instagram-reel-scraper output. */
export function isInstagramReelsDataset(raw: unknown): raw is RawInstagramReel[] {
  return flattenInstagramReels(raw).length > 0;
}

/** True when the array looks like instagram-comment-scraper output. */
export function isInstagramCommentsDataset(
  raw: unknown,
): raw is RawInstagramComment[] {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  const sample = raw.slice(0, 10);
  return sample.every(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof (item as RawInstagramComment).text === "string" &&
      typeof (item as RawInstagramComment).ownerUsername === "string",
  );
}

/** Flatten followers scraper export into follower rows. */
export function flattenInstagramFollowers(raw: unknown): RawInstagramFollower[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const first = raw[0];
  if (
    first &&
    typeof first === "object" &&
    Array.isArray((first as RawInstagramFollowersPage).results)
  ) {
    return (first as RawInstagramFollowersPage).results ?? [];
  }
  if (
    first &&
    typeof first === "object" &&
    "username" in first &&
    ("relation" in first || "userId" in first)
  ) {
    return raw as RawInstagramFollower[];
  }
  return [];
}

export function isInstagramFollowersDataset(raw: unknown): boolean {
  return flattenInstagramFollowers(raw).length > 0;
}

/** Soft-presence followers kept for the map (beyond real commenters/tags). */
const MAX_FOLLOW_ONLY_NODES = 36;
/** Posts kept in the snapshot for the grid + analytics (newest first). */
const MAX_PROFILE_POSTS = 40;

function isSoftPresencePerson(person: Commentator): boolean {
  if (person.comments > 0) return false;
  return (
    person.position === "Follower" ||
    person.position === "Following" ||
    person.position === "Tagged in reel" ||
    person.position === "Mentioned in reel" ||
    person.position === "Tagged in post" ||
    person.position === "Mentioned in post" ||
    person.position === "Collaborator" ||
    person.history.every(
      (c) =>
        c.post === "Follower" ||
        c.post === "Following" ||
        c.post === "Tagged" ||
        c.post === "Mentioned",
    )
  );
}

function isReelProfilePost(post: ProfilePost): boolean {
  return (post.postType ?? "").toLowerCase() === "reel";
}

function trimProfilePosts(posts: ProfilePost[]): ProfilePost[] {
  const reels = posts.filter(isReelProfilePost);
  const feed = posts.filter((post) => !isReelProfilePost(post));
  if (feed.length <= MAX_PROFILE_POSTS) return posts;

  const newestFeed = feed.slice(0, MAX_PROFILE_POSTS);
  const keptIds = new Set(newestFeed.map((p) => p.id));
  const extras = feed
    .slice(MAX_PROFILE_POSTS)
    .filter(
      (p) =>
        !keptIds.has(p.id) &&
        ((p.videoPlayCount ?? 0) >= 500 || (p.likesCount ?? 0) >= 40),
    )
    .slice(0, 8);
  return [...newestFeed, ...extras, ...reels].sort((a, b) => {
    const ta = a.postedAt ? Date.parse(a.postedAt) : 0;
    const tb = b.postedAt ? Date.parse(b.postedAt) : 0;
    return tb - ta;
  });
}

/**
 * Build a social ScrapeResult from Instagram profile + posts + reels +
 * comments + followers. Graph people are commenters / tagged / mentioned,
 * with a capped follower sample filling the wider circle.
 */
export function buildScrapeResultFromInstagramRaw(
  handle: string,
  inputs: InstagramRawInputs,
): ScrapeResult {
  const clean = handle.replace(/^@/, "").trim().toLowerCase();
  const posts = inputs.posts.filter((p) => Boolean(p.id));
  const reels = (inputs.reels ?? []).filter((r) => Boolean(r.id));
  if (posts.length === 0 && reels.length === 0) {
    throw new Error(
      "Instagram dataset has no posts/reels — cannot build profile snapshot",
    );
  }

  const profileRaw = inputs.profile ?? null;
  const selfIds = new Set<string>();
  if (profileRaw?.id) selfIds.add(String(profileRaw.id));
  for (const post of posts) {
    if (post.ownerId) selfIds.add(String(post.ownerId));
  }
  for (const reel of reels) {
    if (reel.ownerId) selfIds.add(String(reel.ownerId));
  }

  const profile = buildProfile(clean, profileRaw, posts);
  const profileHandle = profile.username.toLowerCase();
  const profilePosts = trimProfilePosts(buildProfilePosts(posts, reels));
  const allPeople = peopleFromInstagram(
    profileHandle,
    posts,
    reels,
    inputs.comments ?? [],
    inputs.followers ?? [],
    selfIds,
  );

  // Prefer real engagers; only keep a small follower sample for map density.
  const activePeople = allPeople.filter((p) => !isSoftPresencePerson(p));
  const followOnly = allPeople.filter(isSoftPresencePerson);
  const includeSoftPresence = inputs.includeSoftPresence !== false;
  const cappedPeople = (
    includeSoftPresence
      ? [...activePeople, ...followOnly.slice(0, MAX_FOLLOW_ONLY_NODES)]
      : activePeople
  ).sort(compareByCloseness);

  const graphPeople = cappedPeople.slice(0, MAX_NODES);
  // Engagement grid uses the same capped set — full follower dumps make it lag.
  const gridPeople = cappedPeople;
  const budget = estimateScrapeBudget({});
  const graph = buildGraph(profile, graphPeople);
  const engagers = buildMemberNodes(profile, gridPeople);
  const selfNode = graph.nodes.find((node) => node.group === "self");
  if (selfNode && profile.fullName) {
    selfNode.fullName = profile.fullName;
  }

  const commentEvents = activePeople.reduce(
    (sum, p) =>
      sum +
      p.history.filter(
        (c) =>
          c.post !== "Follower" &&
          c.post !== "Following" &&
          c.post !== "Tagged" &&
          c.post !== "Mentioned",
      ).length,
    0,
  );

  const scrapedAt = Date.now();
  return {
    platform: "instagram",
    profile,
    graph,
    stats: {
      ...computeStats(profile, graphPeople, commentEvents),
      shown: graphPeople.length,
    },
    budget,
    cached: false,
    demo: false,
    pinned: true,
    scrapedAt,
    posts: profilePosts,
    engagers,
    audienceHistory: seedAudienceHistory({
      scrapedAt,
      followersCount: profile.followersCount,
      followingCount: profile.followingCount,
    }),
  };
}
