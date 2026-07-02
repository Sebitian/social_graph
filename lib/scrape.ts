import { isApifyConfigured, scrapeNetwork } from "./apify";
import { buildGraph, computeStats, MAX_NODES } from "./graphUtils";
import { getCached, setCached } from "./cache";
import { buildMockCommentators, buildMockProfile } from "./mock";
import type { ScrapeResult } from "./types";
import type { ScrapeBudget } from "./scrapeBudget";
import { estimateScrapeBudget } from "./scrapeBudget";

/** Full pipeline: cache -> Apify scrapers -> graph + stats -> cache. */
export async function getNetwork(
  rawHandle: string,
  {
    force = false,
    budget: inputBudget = {},
  }: { force?: boolean; budget?: Partial<ScrapeBudget> } = {},
): Promise<ScrapeResult> {
  const handle = rawHandle.replace(/^@/, "").trim().toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(handle)) {
    throw new Error("Invalid Instagram handle");
  }

  const budget = estimateScrapeBudget(inputBudget);

  if (!force) {
    const cached = await getCached(handle, budget);
    if (cached && !(cached.demo && isApifyConfigured())) {
      return { ...cached, budget: cached.budget ?? budget, cached: true };
    }
  }

  const net = isApifyConfigured()
    ? await scrapeNetwork(handle, budget)
    : await mockNetwork(handle, budget);

  const result: ScrapeResult = {
    profile: net.profile,
    graph: buildGraph(net.profile, net.commentators),
    stats: computeStats(net.profile, net.commentators, net.scanned),
    budget,
    cached: false,
    demo: !isApifyConfigured(),
    scrapedAt: Date.now(),
  };

  await setCached(handle, budget, result);
  return result;
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
