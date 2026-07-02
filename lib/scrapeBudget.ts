export interface ScrapeBudget {
  postLimit: number;
  commentsPerPost: number;
  reciprocityEnabled: boolean;
  reciprocityFriends: number;
  reciprocityPostsPerFriend: number;
}

type ScrapeBudgetInput = {
  postLimit?: number | string | null;
  commentsPerPost?: number | string | null;
  reciprocityEnabled?: boolean | string | null;
  reciprocityFriends?: number | string | null;
  reciprocityPostsPerFriend?: number | string | null;
};

export interface ScrapeBudgetEstimate extends ScrapeBudget {
  maxComments: number;
  maxReciprocityComments: number;
  estimatedCostUsd: number;
  withinFreeTier: boolean;
  needsPaymentPrompt: boolean;
}

export interface ScrapeBudgetLimits {
  freePosts: number;
  freeCommentsPerPost: number;
  maxPosts: number;
  maxCommentsPerPost: number;
  freeReciprocityFriends: number;
  freeReciprocityPostsPerFriend: number;
  maxReciprocityFriends: number;
  maxReciprocityPostsPerFriend: number;
  commentEventCostUsd: number;
  profileFreeLimit: number;
}

function readNumber(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const SCRAPE_BUDGET_LIMITS: ScrapeBudgetLimits = {
  freePosts: readNumber(process.env.NEXT_PUBLIC_FREE_POST_LIMIT, 10),
  freeCommentsPerPost: readNumber(
    process.env.NEXT_PUBLIC_FREE_COMMENTS_PER_POST,
    10,
  ),
  maxPosts: readNumber(process.env.NEXT_PUBLIC_MAX_POST_LIMIT, 50),
  maxCommentsPerPost: readNumber(
    process.env.NEXT_PUBLIC_MAX_COMMENTS_PER_POST,
    100,
  ),
  freeReciprocityFriends: readNumber(
    process.env.NEXT_PUBLIC_FREE_RECIPROCITY_FRIENDS,
    4,
  ),
  freeReciprocityPostsPerFriend: readNumber(
    process.env.NEXT_PUBLIC_FREE_RECIPROCITY_POSTS_PER_FRIEND,
    3,
  ),
  maxReciprocityFriends: readNumber(
    process.env.NEXT_PUBLIC_MAX_RECIPROCITY_FRIENDS,
    12,
  ),
  maxReciprocityPostsPerFriend: readNumber(
    process.env.NEXT_PUBLIC_MAX_RECIPROCITY_POSTS_PER_FRIEND,
    8,
  ),
  commentEventCostUsd: readNumber(
    process.env.NEXT_PUBLIC_APIFY_COMMENT_EVENT_COST_USD,
    0.0026,
  ),
  profileFreeLimit: readNumber(process.env.NEXT_PUBLIC_FREE_PROFILE_LOOKUPS, 2),
};

export const DEFAULT_SCRAPE_BUDGET: ScrapeBudget = {
  postLimit: SCRAPE_BUDGET_LIMITS.freePosts,
  commentsPerPost: SCRAPE_BUDGET_LIMITS.freeCommentsPerPost,
  reciprocityEnabled: true,
  reciprocityFriends: SCRAPE_BUDGET_LIMITS.freeReciprocityFriends,
  reciprocityPostsPerFriend: SCRAPE_BUDGET_LIMITS.freeReciprocityPostsPerFriend,
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return fallback;
}

export function normalizeScrapeBudget(
  input: ScrapeBudgetInput = {},
): ScrapeBudget {
  return {
    postLimit: clampInt(
      input.postLimit,
      1,
      SCRAPE_BUDGET_LIMITS.maxPosts,
      DEFAULT_SCRAPE_BUDGET.postLimit,
    ),
    commentsPerPost: clampInt(
      input.commentsPerPost,
      1,
      SCRAPE_BUDGET_LIMITS.maxCommentsPerPost,
      DEFAULT_SCRAPE_BUDGET.commentsPerPost,
    ),
    reciprocityEnabled: parseBoolean(
      input.reciprocityEnabled,
      DEFAULT_SCRAPE_BUDGET.reciprocityEnabled,
    ),
    reciprocityFriends: clampInt(
      input.reciprocityFriends,
      0,
      SCRAPE_BUDGET_LIMITS.maxReciprocityFriends,
      DEFAULT_SCRAPE_BUDGET.reciprocityFriends,
    ),
    reciprocityPostsPerFriend: clampInt(
      input.reciprocityPostsPerFriend,
      0,
      SCRAPE_BUDGET_LIMITS.maxReciprocityPostsPerFriend,
      DEFAULT_SCRAPE_BUDGET.reciprocityPostsPerFriend,
    ),
  };
}

export function parseScrapeBudgetParams(params: URLSearchParams): ScrapeBudget {
  return normalizeScrapeBudget({
    postLimit: params.get("posts") ?? params.get("postLimit") ?? undefined,
    commentsPerPost:
      params.get("comments") ?? params.get("commentsPerPost") ?? undefined,
    reciprocityEnabled: params.get("reciprocity") ?? undefined,
    reciprocityFriends: params.get("reciprocityFriends") ?? undefined,
    reciprocityPostsPerFriend:
      params.get("reciprocityPosts") ??
      params.get("reciprocityPostsPerFriend") ??
      undefined,
  });
}

export function estimateScrapeBudget(
  input: ScrapeBudgetInput = {},
): ScrapeBudgetEstimate {
  const budget = normalizeScrapeBudget(input);
  const primaryComments = budget.postLimit * budget.commentsPerPost;
  const maxReciprocityComments = budget.reciprocityEnabled
    ? budget.reciprocityFriends *
      budget.reciprocityPostsPerFriend *
      budget.commentsPerPost
    : 0;
  const maxComments = primaryComments + maxReciprocityComments;
  const primaryWithinFree =
    budget.postLimit <= SCRAPE_BUDGET_LIMITS.freePosts &&
    budget.commentsPerPost <= SCRAPE_BUDGET_LIMITS.freeCommentsPerPost;
  const reciprocityWithinFree =
    !budget.reciprocityEnabled ||
    (budget.reciprocityFriends <= SCRAPE_BUDGET_LIMITS.freeReciprocityFriends &&
      budget.reciprocityPostsPerFriend <=
        SCRAPE_BUDGET_LIMITS.freeReciprocityPostsPerFriend);
  const withinFreeTier = primaryWithinFree && reciprocityWithinFree;

  const rawCost = maxComments * SCRAPE_BUDGET_LIMITS.commentEventCostUsd;

  return {
    ...budget,
    maxComments,
    maxReciprocityComments,
    estimatedCostUsd: withinFreeTier ? 0 : Number(rawCost.toFixed(2)),
    withinFreeTier,
    needsPaymentPrompt: !withinFreeTier,
  };
}

export function budgetCacheSuffix(budget: ScrapeBudget): string {
  const base = `p${budget.postLimit}:c${budget.commentsPerPost}`;
  if (!budget.reciprocityEnabled) return `${base}:r0`;
  return `${base}:r1:f${budget.reciprocityFriends}:fp${budget.reciprocityPostsPerFriend}`;
}

export function budgetToQuery(input: ScrapeBudgetInput = {}): string {
  const budget = normalizeScrapeBudget(input);
  const parts = [
    `posts=${budget.postLimit}`,
    `comments=${budget.commentsPerPost}`,
    `reciprocity=${budget.reciprocityEnabled ? "1" : "0"}`,
    `reciprocityFriends=${budget.reciprocityFriends}`,
    `reciprocityPosts=${budget.reciprocityPostsPerFriend}`,
  ];
  return parts.join("&");
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
