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
import { estimateScrapeBudget } from "./scrapeBudget";
import type {
  Commentator,
  PostComment,
  PostEngagement,
  ProfileData,
  ProfilePost,
  ScrapeResult,
} from "./types";

/** Raw page row from apify/facebook-pages-scraper. */
export interface RawFacebookPage {
  pageId?: string;
  facebookId?: string;
  title?: string;
  pageName?: string;
  pageUrl?: string;
  facebookUrl?: string;
  intro?: string;
  profilePictureUrl?: string;
  profilePhoto?: string;
  followers?: number;
  followings?: number;
  likes?: number;
  category?: string;
}

/** Nested author on a topComment. */
interface RawFacebookCommentAuthor {
  id?: string;
  name?: string;
  profile_picture_depth_0?: { uri?: string };
  profile_picture_depth_1?: { uri?: string };
}

/** topComments entry from apify/facebook-posts-scraper. */
interface RawFacebookTopComment {
  commentId?: string;
  commentUrl?: string;
  date?: string;
  text?: string;
  profileId?: string;
  profileName?: string;
  profileUrl?: string;
  profilePicture?: string;
  likesCount?: number | string;
  author?: RawFacebookCommentAuthor;
}

/** Raw post row from apify/facebook-posts-scraper. */
export interface RawFacebookPost {
  postId?: string;
  url?: string;
  text?: string;
  time?: string;
  timestamp?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  isVideo?: boolean;
  viewsCount?: number;
  media?: Array<{ thumbnail?: string; thumbnailImage?: string; url?: string }>;
  facebookUrl?: string;
  inputUrl?: string;
  user?: {
    id?: string;
    name?: string;
    profileUrl?: string;
    profilePic?: string;
  };
  topComments?: RawFacebookTopComment[];
}

/** Raw follower/following row from apify/facebook-followers-following-scraper. */
export interface RawFacebookFollow {
  id?: string;
  title?: string;
  url?: string;
  image?: string;
  followType?: "follower" | "following" | string;
  facebookId?: string;
  subtitle_text?: string;
}

export interface FacebookRawInputs {
  page?: RawFacebookPage | null;
  posts: RawFacebookPost[];
  follows?: RawFacebookFollow[];
}

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
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
  if (!clean) return "Facebook post";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function postImageUrl(post: RawFacebookPost): string | undefined {
  const media = post.media?.[0];
  if (typeof media?.thumbnail === "string" && media.thumbnail) return media.thumbnail;
  if (typeof media?.thumbnailImage === "string" && media.thumbnailImage) {
    return media.thumbnailImage;
  }
  if (typeof media?.url === "string" && media.url) return media.url;
  return undefined;
}

function commentPic(comment: RawFacebookTopComment): string | undefined {
  if (comment.profilePicture) return comment.profilePicture;
  const author = comment.author;
  return (
    author?.profile_picture_depth_1?.uri ??
    author?.profile_picture_depth_0?.uri
  );
}

function personUsername(opts: {
  profileId?: string;
  profileUrl?: string;
  name?: string;
}): string | undefined {
  if (opts.profileId) return opts.profileId.toLowerCase();
  if (opts.profileUrl) {
    const m = opts.profileUrl.match(/facebook\.com\/(?:p\/)?([^/?#]+)/i);
    if (m?.[1]) return decodeURIComponent(m[1]).toLowerCase();
  }
  if (opts.name) return slugifyName(opts.name);
  return undefined;
}

type PersonAccumulator = {
  username: string;
  fullName?: string;
  profilePicUrl?: string;
  position?: string;
  history: PostComment[];
  reactionsByType: Record<string, number>;
  reactedPostIds: Set<string>;
  commentedPostIds: Set<string>;
  postEngagement: Record<string, PostEngagement>;
  /** Soft presence from follower/following lists (no comment text). */
  followRelation?: "follower" | "following";
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
    existing.followRelation ??= seed.followRelation;
    return existing;
  }
  const created: PersonAccumulator = {
    username: seed.username,
    fullName: seed.fullName,
    profilePicUrl: seed.profilePicUrl,
    position: seed.position,
    history: [],
    reactionsByType: {},
    reactedPostIds: new Set(),
    commentedPostIds: new Set(),
    postEngagement: {},
    followRelation: seed.followRelation,
  };
  byKey.set(key, created);
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
  page: RawFacebookPage | null | undefined,
  posts: RawFacebookPost[],
): ProfileData {
  const author = posts.find((p) => p.user)?.user;
  const pageUrl =
    page?.pageUrl ||
    page?.facebookUrl ||
    posts.find((p) => p.facebookUrl)?.facebookUrl ||
    posts.find((p) => p.inputUrl)?.inputUrl ||
    author?.profileUrl;
  const slugMatch = pageUrl?.match(
    /facebook\.com\/(?:profile\.php\?id=(\d+)|p\/([^/?#]+)|([^/?#]+))/i,
  );
  const pageSlug = slugMatch?.[1] || slugMatch?.[2] || slugMatch?.[3];
  const username =
    pageSlug && pageSlug.toLowerCase() !== "p"
      ? decodeURIComponent(pageSlug)
      : handle;
  return {
    username,
    fullName: page?.title?.split("|")[0]?.trim() || author?.name || handle,
    biography: page?.intro ?? page?.category ?? "",
    profilePicUrl:
      page?.profilePictureUrl || author?.profilePic || page?.profilePhoto || "",
    followersCount: page?.followers ?? page?.likes ?? 0,
    followingCount: page?.followings ?? 0,
    postsCount: posts.length,
    isPrivate: false,
    isVerified: false,
    highlightReelCount: 0,
    profileUrl: pageUrl,
  };
}

function buildProfilePosts(posts: RawFacebookPost[]): ProfilePost[] {
  const built: ProfilePost[] = [];
  for (const post of posts) {
    if (!post.postId) continue;
    const postedAt =
      post.time ||
      (typeof post.timestamp === "number"
        ? new Date(post.timestamp * (post.timestamp < 1e12 ? 1000 : 1)).toISOString()
        : undefined);
    built.push({
      id: post.postId,
      url: post.url,
      label: postSnippet(post.text),
      postedAt,
      imageUrl: postImageUrl(post),
    });
  }
  return built.sort((a, b) => {
    const ta = a.postedAt ? Date.parse(a.postedAt) : 0;
    const tb = b.postedAt ? Date.parse(b.postedAt) : 0;
    return tb - ta;
  });
}

function peopleFromFacebook(
  handle: string,
  posts: RawFacebookPost[],
  follows: RawFacebookFollow[],
  selfIds: Set<string>,
): Commentator[] {
  const byKey = new Map<string, PersonAccumulator>();
  const totalPostsScraped = posts.length;
  const postMeta = new Map<string, { url?: string; label: string }>();

  for (const post of posts) {
    if (!post.postId) continue;
    postMeta.set(post.postId, {
      url: post.url,
      label: postSnippet(post.text),
    });
  }

  for (const post of posts) {
    const postId = post.postId;
    if (!postId) continue;
    const meta = postMeta.get(postId);

    for (const raw of post.topComments ?? []) {
      const name = raw.profileName || raw.author?.name;
      const profileId = raw.profileId || raw.author?.id;
      if (profileId && selfIds.has(profileId)) continue;

      const username = personUsername({
        profileId,
        profileUrl: raw.profileUrl,
        name,
      });
      if (!username || username === handle) continue;

      const key = profileId ? `id:${profileId}` : `user:${username}`;
      const person = ensurePerson(byKey, key, {
        username,
        fullName: name,
        profilePicUrl: commentPic(raw),
      });

      const text = (raw.text ?? "").trim();
      if (!text) continue;

      const timestamp = raw.date;
      person.commentedPostIds.add(postId);
      ensurePostEngagement(person, postId).commented = true;

      person.history.push({
        authorId: profileId,
        authorUsername: person.username,
        postId,
        text,
        when: relativeWhen(timestamp),
        timestamp,
        post: meta?.label ?? "Facebook post",
        isReply: false,
        isTopLevel: true,
        ownerReplied: false,
        mentionedUsers: [],
        postType: post.isVideo ? "reel" : "unknown",
        captionCategory: "unknown",
      });
    }
  }

  for (const follow of follows) {
    const name = follow.title?.trim();
    if (!name) continue;
    const profileId = follow.id;
    if (profileId && selfIds.has(profileId)) continue;

    const username = personUsername({
      profileId,
      profileUrl: follow.url,
      name,
    });
    if (!username || username === handle) continue;

    const key = profileId ? `id:${profileId}` : `user:${username}`;
    const relation =
      follow.followType === "following" ? "following" : "follower";
    const person = ensurePerson(byKey, key, {
      username,
      fullName: name,
      profilePicUrl: follow.image,
      position:
        relation === "follower"
          ? "Page follower"
          : follow.subtitle_text || "Following",
      followRelation: relation,
    });

    // Soft presence so followers/following without comments still appear.
    if (person.history.length === 0) {
      person.history.push({
        authorUsername: person.username,
        text:
          relation === "follower"
            ? "Follows this Page"
            : "Page follows this account",
        when: "recently",
        post: relation === "follower" ? "Follower" : "Following",
        isReply: false,
        isTopLevel: true,
        postType: "unknown",
        captionCategory: "unknown",
      });
    }
  }

  return [...byKey.values()]
    .map((person) => {
      const enriched = person.history.map((comment) => ({
        ...comment,
        signals: extractInteractionSignals(comment),
      }));
      const labels = deriveLabels(enriched);
      const features = deriveFeatures(enriched);
      const reactionsTotal = Object.values(person.reactionsByType).reduce(
        (sum, n) => sum + n,
        0,
      );
      // Follow-only nodes shouldn't dominate ranking over real commenters.
      const comments = enriched.filter(
        (c) =>
          c.post !== "Follower" &&
          c.post !== "Following" &&
          c.text !== "Follows this Page" &&
          c.text !== "Page follows this account",
      ).length;

      return {
        username: person.username,
        fullName: person.fullName,
        profilePicUrl: person.profilePicUrl,
        position: person.position,
        comments: comments || (person.followRelation ? 0 : enriched.length),
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
        reactionsTotal: reactionsTotal || undefined,
        reactionsByType:
          reactionsTotal > 0 ? { ...person.reactionsByType } : undefined,
        postsReactedTo: person.reactedPostIds.size,
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

/** True when the array looks like facebook-posts-scraper output. */
export function isFacebookPostsDataset(raw: unknown): raw is RawFacebookPost[] {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  const sample = raw.slice(0, 10);
  return sample.some(
    (item) =>
      item &&
      typeof item === "object" &&
      "postId" in item &&
      ("topComments" in item || "facebookUrl" in item || "reactionLikeCount" in item),
  );
}

/** True when the array looks like facebook-pages-scraper output. */
export function isFacebookPagesDataset(raw: unknown): raw is RawFacebookPage[] {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  const first = raw[0];
  return Boolean(
    first &&
      typeof first === "object" &&
      ("pageId" in first || "pageUrl" in first) &&
      ("followers" in first || "likes" in first || "intro" in first),
  );
}

/** True when the array looks like facebook-followers-following-scraper output. */
export function isFacebookFollowsDataset(raw: unknown): raw is RawFacebookFollow[] {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  const first = raw[0];
  return Boolean(
    first &&
      typeof first === "object" &&
      "followType" in first &&
      ("title" in first || "url" in first),
  );
}

/**
 * Build a social ScrapeResult from Facebook page + posts (+ optional follows).
 * Uses topComments and follower/following lists as the people graph.
 */
export function buildScrapeResultFromFacebookRaw(
  handle: string,
  inputs: FacebookRawInputs,
): ScrapeResult {
  const clean = handle.replace(/^@/, "").trim().toLowerCase();
  const posts = inputs.posts.filter((p) => Boolean(p.postId));
  if (posts.length === 0) {
    throw new Error("Facebook dataset has no posts — cannot build profile snapshot");
  }

  const page = inputs.page ?? null;
  const selfIds = new Set<string>();
  if (page?.pageId) selfIds.add(page.pageId);
  if (page?.facebookId) selfIds.add(page.facebookId);
  for (const post of posts) {
    if (post.user?.id) selfIds.add(post.user.id);
  }

  const profile = buildProfile(clean, page, posts);
  const profilePosts = buildProfilePosts(posts);
  const allEngagers = peopleFromFacebook(
    clean,
    posts,
    inputs.follows ?? [],
    selfIds,
  );
  const graphPeople = allEngagers.slice(0, MAX_NODES);
  const budget = estimateScrapeBudget({});
  const graph = buildGraph(profile, graphPeople);
  const engagers = buildMemberNodes(profile, allEngagers);
  const selfNode = graph.nodes.find((node) => node.group === "self");
  if (selfNode && profile.fullName) {
    selfNode.fullName = profile.fullName;
  }

  const commentEvents = allEngagers.reduce(
    (sum, p) =>
      sum +
      p.history.filter(
        (c) => c.post !== "Follower" && c.post !== "Following",
      ).length,
    0,
  );

  return {
    platform: "facebook",
    profile,
    graph,
    stats: {
      ...computeStats(profile, allEngagers, commentEvents),
      shown: graphPeople.length,
    },
    budget,
    cached: false,
    demo: false,
    pinned: true,
    scrapedAt: Date.now(),
    posts: profilePosts,
    engagers,
  };
}
