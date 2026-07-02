import { parseCommentRecord } from "./apify";
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

/** Shape of a comment row exported from Apify / Instagram scrapers. */
export interface RawScrapedComment {
  id?: string;
  text: string;
  timestamp?: string;
  ownerUsername: string;
  ownerProfilePicUrl?: string;
  postUrl?: string;
}

function postDisplayName(postUrl?: string): string {
  if (!postUrl) return "Instagram post";
  return postUrl.includes("instagram.com") ? "Instagram post" : postUrl;
}

function commentatorsFromRaw(
  handle: string,
  rawComments: RawScrapedComment[],
): Commentator[] {
  const self = handle.replace(/^@/, "").trim().toLowerCase();
  const byUsername = new Map<
    string,
    {
      username: string;
      fullName?: string;
      profilePicUrl?: string;
      history: PostComment[];
    }
  >();

  for (const raw of rawComments) {
    const parsed = parseCommentRecord({
      ownerUsername: raw.ownerUsername,
      ownerProfilePicUrl: raw.ownerProfilePicUrl,
      text: raw.text,
      timestamp: raw.timestamp,
      postUrl: raw.postUrl,
      id: raw.id,
    });
    if (!parsed || parsed.username.toLowerCase() === self) continue;

    const id = parsed.username.toLowerCase();
    const existing = byUsername.get(id) ?? {
      username: parsed.username,
      fullName: parsed.fullName,
      profilePicUrl: parsed.profilePicUrl,
      history: [],
    };

    existing.fullName ??= parsed.fullName;
    existing.profilePicUrl ??= parsed.profilePicUrl;
    existing.history.push({
      authorId: parsed.authorId,
      authorUsername: parsed.username,
      postId: parsed.postId,
      text: parsed.text,
      when: parsed.when,
      timestamp: parsed.timestamp,
      post: postDisplayName(raw.postUrl),
      isReply: parsed.isReply,
      isTopLevel: parsed.isTopLevel,
      ownerReplied: parsed.ownerReplied,
      mentionedUsers: parsed.mentionedUsers,
      postType: parsed.postType,
      captionCategory: parsed.captionCategory,
    });
    byUsername.set(id, existing);
  }

  const commentators = [...byUsername.values()]
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
          self,
          person.username.toLowerCase(),
          labels,
          features,
        ),
      } satisfies Commentator;
    })
    .sort(compareByCloseness)
    .slice(0, MAX_NODES);

  return commentators;
}

export function buildScrapeResultFromRawComments(
  handle: string,
  rawComments: RawScrapedComment[],
  profileOverrides: Partial<ProfileData> = {},
): ScrapeResult {
  const clean = handle.replace(/^@/, "").trim().toLowerCase();
  const commentators = commentatorsFromRaw(clean, rawComments);
  const budget = estimateScrapeBudget({});

  const profile: ProfileData = {
    username: clean,
    fullName: profileOverrides.fullName ?? clean,
    biography: profileOverrides.biography ?? "",
    profilePicUrl: profileOverrides.profilePicUrl ?? "",
    followersCount: profileOverrides.followersCount ?? 0,
    followingCount: profileOverrides.followingCount ?? 0,
    postsCount: profileOverrides.postsCount ?? 0,
    isPrivate: profileOverrides.isPrivate ?? false,
    isVerified: profileOverrides.isVerified ?? false,
    highlightReelCount: profileOverrides.highlightReelCount ?? 0,
  };

  const scanned = rawComments.length;
  return {
    profile,
    graph: buildGraph(profile, commentators),
    stats: computeStats(profile, commentators, scanned),
    budget,
    cached: false,
    demo: false,
    pinned: true,
    scrapedAt: Date.now(),
  };
}
