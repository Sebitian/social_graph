import {
  buildGraph,
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
import type { Commentator, PostComment, ProfileData, ScrapeResult } from "./types";

interface LinkedInPicture {
  url?: string;
}

interface LinkedInActor {
  id?: string | null;
  type?: string;
  name?: string;
  linkedinUrl?: string;
  position?: string;
  pictureUrl?: string;
  picture?: LinkedInPicture;
  avatar?: LinkedInPicture;
  publicIdentifier?: string | null;
  universalName?: string | null;
  info?: string;
  author?: boolean;
}

interface LinkedInPostedAt {
  timestamp?: number;
  date?: string;
  postedAgoShort?: string;
  postedAgoText?: string;
}

interface LinkedInPostItem {
  type: "post";
  id?: string;
  linkedinUrl?: string;
  content?: string;
  commentary?: string;
  author?: LinkedInActor;
  postedAt?: LinkedInPostedAt;
}

interface LinkedInReplyItem {
  actor?: LinkedInActor;
}

interface LinkedInCommentItem {
  type: "comment";
  id?: string;
  linkedinUrl?: string;
  commentary?: string;
  createdAt?: string;
  createdAtTimestamp?: number;
  actor?: LinkedInActor;
  postId?: string;
  replies?: LinkedInReplyItem[];
}

export type LinkedInRawItem =
  | LinkedInPostItem
  | LinkedInCommentItem
  | { type?: string };

function isPost(item: LinkedInRawItem): item is LinkedInPostItem {
  return item.type === "post";
}

function isComment(item: LinkedInRawItem): item is LinkedInCommentItem {
  return item.type === "comment";
}

/** True when the array looks like HarvestAPI LinkedIn profile-posts output. */
export function isLinkedInRawDataset(raw: unknown): raw is LinkedInRawItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  const sample = raw.slice(0, 20);
  return sample.some(
    (item) =>
      item &&
      typeof item === "object" &&
      "type" in item &&
      (item.type === "post" || item.type === "comment" || item.type === "reaction"),
  );
}

function pictureUrlFromActor(actor?: LinkedInActor): string | undefined {
  if (!actor) return undefined;
  if (typeof actor.pictureUrl === "string" && actor.pictureUrl) return actor.pictureUrl;
  if (actor.picture?.url) return actor.picture.url;
  if (actor.avatar?.url) return actor.avatar.url;
  return undefined;
}

function slugFromLinkedInUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const profile = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  if (profile?.[1]) return decodeURIComponent(profile[1]).toLowerCase();
  const company = url.match(/linkedin\.com\/company\/([^/?#]+)/i);
  if (company?.[1]) return `company-${decodeURIComponent(company[1]).toLowerCase()}`;
  return undefined;
}

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function actorUsername(actor?: LinkedInActor): string | undefined {
  if (!actor) return undefined;
  if (actor.publicIdentifier) return actor.publicIdentifier.toLowerCase();
  if (actor.universalName) {
    const base = actor.universalName.toLowerCase();
    return actor.type === "company" ? `company-${base}` : base;
  }
  const fromUrl = slugFromLinkedInUrl(actor.linkedinUrl);
  if (fromUrl) return fromUrl;
  if (actor.id) return actor.id.toLowerCase();
  if (actor.name) return slugifyName(actor.name);
  return undefined;
}

function isoTimestamp(createdAt?: string, createdAtTimestamp?: number): string | undefined {
  if (createdAt && !Number.isNaN(Date.parse(createdAt))) return createdAt;
  if (typeof createdAtTimestamp === "number" && Number.isFinite(createdAtTimestamp)) {
    return new Date(createdAtTimestamp).toISOString();
  }
  return undefined;
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
  if (!clean) return "LinkedIn post";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function isSelfActor(
  actor: LinkedInActor | undefined,
  selfIds: Set<string>,
  selfSlugs: Set<string>,
): boolean {
  if (!actor) return false;
  if (actor.author === true) return true;
  if (actor.id && selfIds.has(actor.id)) return true;
  const username = actorUsername(actor);
  if (username && selfSlugs.has(username)) return true;
  return false;
}

function buildProfile(
  handle: string,
  posts: LinkedInPostItem[],
): ProfileData {
  const author = posts.find((p) => p.author)?.author;
  return {
    username: handle,
    fullName: author?.name ?? handle,
    biography: author?.info ?? author?.position ?? "",
    profilePicUrl: pictureUrlFromActor(author) ?? "",
    followersCount: 0,
    followingCount: 0,
    postsCount: posts.length,
    isPrivate: false,
    isVerified: false,
    highlightReelCount: 0,
  };
}

function commentatorsFromLinkedIn(
  handle: string,
  posts: LinkedInPostItem[],
  comments: LinkedInCommentItem[],
): Commentator[] {
  const selfSlugs = new Set<string>([handle.toLowerCase()]);
  const selfIds = new Set<string>();

  for (const post of posts) {
    const author = post.author;
    if (!author) continue;
    if (author.id) selfIds.add(author.id);
    const slug = actorUsername(author);
    if (slug) selfSlugs.add(slug);
  }

  const postMeta = new Map<
    string,
    { url?: string; label: string }
  >();
  for (const post of posts) {
    const id = post.id;
    if (!id) continue;
    postMeta.set(id, {
      url: post.linkedinUrl,
      label: postSnippet(post.content ?? post.commentary),
    });
  }

  const byUsername = new Map<
    string,
    {
      username: string;
      fullName?: string;
      profilePicUrl?: string;
      history: PostComment[];
    }
  >();

  for (const raw of comments) {
    const actor = raw.actor;
    if (isSelfActor(actor, selfIds, selfSlugs)) continue;

    const username = actorUsername(actor);
    if (!username) continue;

    const text = (raw.commentary ?? "").trim();
    if (!text) continue;

    const timestamp = isoTimestamp(raw.createdAt, raw.createdAtTimestamp);
    const meta = raw.postId ? postMeta.get(raw.postId) : undefined;
    const ownerReplied = (raw.replies ?? []).some((reply) =>
      isSelfActor(reply.actor, selfIds, selfSlugs),
    );

    const existing = byUsername.get(username) ?? {
      username,
      fullName: actor?.name,
      profilePicUrl: pictureUrlFromActor(actor),
      history: [],
    };

    existing.fullName ??= actor?.name;
    existing.profilePicUrl ??= pictureUrlFromActor(actor);
    existing.history.push({
      authorId: actor?.id ?? undefined,
      authorUsername: username,
      postId: meta?.url ?? raw.postId ?? raw.linkedinUrl,
      text,
      when: relativeWhen(timestamp),
      timestamp,
      post: meta?.label ?? "LinkedIn post",
      isReply: false,
      isTopLevel: true,
      ownerReplied,
      mentionedUsers: [],
      postType: "unknown",
      captionCategory: "unknown",
    });
    byUsername.set(username, existing);
  }

  return [...byUsername.values()]
    .map((person) => {
      const enriched = person.history.map((comment) => ({
        ...comment,
        signals: extractInteractionSignals(comment),
      }));
      const labels = deriveLabels(enriched);
      const features = deriveFeatures(enriched);
      return {
        username: person.username,
        fullName: person.fullName,
        profilePicUrl: person.profilePicUrl,
        comments: enriched.length,
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
      } satisfies Commentator;
    })
    .sort(compareByCloseness)
    .slice(0, MAX_NODES);
}

export function buildScrapeResultFromLinkedInRaw(
  handle: string,
  raw: LinkedInRawItem[],
): ScrapeResult {
  const clean = handle.replace(/^@/, "").trim().toLowerCase();
  const posts = raw.filter(isPost);
  const comments = raw.filter(isComment);

  if (posts.length === 0) {
    throw new Error("LinkedIn dataset has no posts — cannot build profile snapshot");
  }

  const profile = buildProfile(clean, posts);
  const commentators = commentatorsFromLinkedIn(clean, posts, comments);
  const budget = estimateScrapeBudget({});
  const graph = buildGraph(profile, commentators);
  const selfNode = graph.nodes.find((node) => node.group === "self");
  if (selfNode && profile.fullName) {
    selfNode.fullName = profile.fullName;
  }

  return {
    profile,
    graph,
    stats: computeStats(profile, commentators, comments.length),
    budget,
    cached: false,
    demo: false,
    pinned: true,
    scrapedAt: Date.now(),
  };
}
