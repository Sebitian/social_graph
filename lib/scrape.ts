import { buildGraph, computeStats, MAX_NODES } from "./graphUtils";
import { getCached, setCached } from "./cache";
import {
  buildMockCommentators,
  buildMockLinkedInResult,
  buildMockProfile,
  buildMockSpotifyTasteResult,
} from "./mock";
import type { ScrapeResult } from "./types";
import type { ScrapeBudget } from "./scrapeBudget";
import { estimateScrapeBudget } from "./scrapeBudget";
import type { SpotifyTasteResult } from "./spotifyTypes";

export type SearchPlatform = "instagram" | "linkedin";

/** Search is demo-only: no live Apify calls. */
export async function getNetwork(
  rawHandle: string,
  {
    platform = "instagram",
    force = false,
    budget: inputBudget = {},
  }: {
    platform?: SearchPlatform;
    force?: boolean;
    budget?: Partial<ScrapeBudget>;
  } = {},
): Promise<ScrapeResult> {
  const handle = rawHandle.replace(/^@/, "").trim().toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(handle)) {
    throw new Error("Invalid handle");
  }

  const budget = estimateScrapeBudget(inputBudget);

  if (platform === "linkedin") {
    return buildMockLinkedInResult(handle, budget);
  }

  if (!force) {
    const cached = await getCached(handle, budget);
    if (cached) {
      return { ...cached, budget: cached.budget ?? budget, cached: true };
    }
  }

  const net = await mockNetwork(handle, budget);

  const result: ScrapeResult = {
    profile: net.profile,
    graph: buildGraph(net.profile, net.commentators),
    stats: computeStats(net.profile, net.commentators, net.scanned),
    budget,
    cached: false,
    demo: true,
    scrapedAt: Date.now(),
  };

  await setCached(handle, budget, result);
  return result;
}

/** Spotify taste map is always demo-only in this build. */
export async function getSpotifyTaste(rawHandle: string): Promise<SpotifyTasteResult> {
  const handle = rawHandle.replace(/^@/, "").trim().toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(handle)) {
    throw new Error("Invalid handle");
  }
  return buildMockSpotifyTasteResult(handle);
}

async function mockNetwork(
  handle: string,
  budget: ReturnType<typeof estimateScrapeBudget>,
) {
  const profile = buildMockProfile(handle);
  const commentators = buildMockCommentators(handle, MAX_NODES, {
    reciprocityEnabled: budget.reciprocityEnabled,
    reciprocityFriends: budget.reciprocityFriends,
    reciprocityPostsPerFriend: budget.reciprocityPostsPerFriend,
  });
  const primaryScanned = budget.postLimit * budget.commentsPerPost;
  const reciprocityScanned = budget.reciprocityEnabled
    ? budget.reciprocityFriends *
      budget.reciprocityPostsPerFriend *
      budget.commentsPerPost
    : 0;
  return {
    profile,
    commentators,
    scanned: primaryScanned + reciprocityScanned,
  };
}
