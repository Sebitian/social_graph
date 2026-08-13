import { tool } from "ai";
import { z } from "zod";
import {
  computeCompanyAnalytics,
  computeSocialAnalytics,
  parseEventMs,
  type AnalyticsRangeId,
} from "@/lib/analytics";
import type { CompanyEmployee, CompanyResult } from "@/lib/companyTypes";
import { compareByCloseness, engagementVolume } from "@/lib/graphUtils";
import type { GraphNode, PostComment, ProfilePost, ScrapeResult } from "@/lib/types";
import type { ChatBundle } from "./loadContext";
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
    },
    graphShown: data.stats.shown,
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
    })),
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

export function createChatTools(bundle: ChatBundle) {
  const socialEnum = ["linkedin", "instagram", "facebook"] as const;
  const sourceField = z
    .enum(socialEnum)
    .optional()
    .describe(
      "Which person-graph snapshot to query. Defaults to LinkedIn if loaded, else Instagram/Facebook.",
    );

  return {
    list_sources: tool({
      description:
        "List the snapshots Chat can query (LinkedIn person graph, Instagram, Facebook, company roster).",
      inputSchema: z.object({}),
      execute: async () => ({ sources: bundle.sources }),
    }),
    get_overview: tool({
      description:
        "Person-graph totals and top engagers. Use for questions like who is the top engager or how many comments.",
      inputSchema: z.object({
        source: sourceField,
        range: z
          .enum(ANALYTICS_RANGES)
          .optional()
          .describe("Time window. Defaults to all available data."),
      }),
      execute: async ({ source, range }) => {
        const picked = pickSocial(bundle, source);
        if ("error" in picked) return picked;
        return {
          source: picked.source,
          ...queryOverview(picked.data, range ?? "all"),
        };
      },
    }),
    list_posts: tool({
      description:
        "List recent posts in a person-graph snapshot, newest first.",
      inputSchema: z.object({
        source: sourceField,
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_POSTS)
          .optional()
          .describe("How many posts to return. Default 10."),
      }),
      execute: async ({ source, limit }) => {
        const picked = pickSocial(bundle, source);
        if ("error" in picked) return picked;
        return { source: picked.source, ...queryPosts(picked.data, limit ?? 10) };
      },
    }),
    find_person: tool({
      description:
        "Look up a commenter/engager by username or name in the person-graph snapshots (not the company roster).",
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .describe("Username, @handle, or full name to search for."),
        source: sourceField,
      }),
      execute: async ({ query, source }) => {
        const targets: { source: ChatSocialPlatform; data: ScrapeResult }[] = [];
        if (source) {
          const picked = pickSocial(bundle, source);
          if ("error" in picked) return picked;
          targets.push(picked);
        } else {
          for (const id of socialEnum) {
            const data = bundle.social[id];
            if (data) targets.push({ source: id, data });
          }
        }
        const matches = [];
        for (const picked of targets) {
          const found = queryFindPerson(picked.data, query);
          matches.push(
            ...found.matches.map((person) => ({
              source: picked.source,
              ...person,
            })),
          );
        }
        return { query, matches: matches.slice(0, MAX_PEOPLE) };
      },
    }),
    get_comments: tool({
      description:
        "Fetch comments from a person-graph snapshot. Filter by person and/or post.",
      inputSchema: z.object({
        source: sourceField,
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
        const picked = pickSocial(bundle, input.source);
        if ("error" in picked) return picked;
        return {
          source: picked.source,
          ...queryComments(picked.data, input),
        };
      },
    }),
    get_company_overview: tool({
      description:
        "LinkedIn company roster summary: name, headcount, leadership, top employees. Use for Formation Bio / company questions.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!bundle.company) {
          return {
            error: "No company snapshot is loaded.",
            available: bundle.sources.map((s) => s.id),
          };
        }
        return queryCompanyOverview(bundle.company);
      },
    }),
    find_employee: tool({
      description:
        "Look up someone on the LinkedIn company roster by name, title, or role (CEO, founder, etc.). Use this for Formation Bio people — not commenters on the person graph.",
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .describe("Employee name, @handle, or role such as CEO / founder."),
      }),
      execute: async ({ query }) => {
        if (!bundle.company) {
          return {
            error: "No company snapshot is loaded.",
            available: bundle.sources.map((s) => s.id),
          };
        }
        return queryFindEmployee(bundle.company, query);
      },
    }),
  };
}

export function chatSystemPrompt(bundle: ChatBundle): string {
  const catalog = bundle.sources
    .map(
      (source) =>
        `- ${source.label}: ${source.title}${source.subtitle ? ` (${source.subtitle})` : ""}`,
    )
    .join("\n");
  return [
    "You are Netgraph Chat, an assistant for social and company snapshots.",
    "Loaded sources:",
    catalog || "- none",
    "Use list_sources, get_overview, find_person, and get_comments for person-graph engagement (comments/reactions).",
    "Use get_company_overview and find_employee for the LinkedIn company roster (employees, CEO, titles).",
    "Company people are not commenters. If a name is not in the person graph, try the company roster before saying they are missing.",
    "Cite people as @handles when they are social accounts, and by full name + title for employees.",
    "Only state facts tools return. Do not invent names, comments, or titles.",
    "Answers come from frozen snapshots, not live scraping. TikTok and Spotify are not in Chat yet.",
  ].join("\n");
}
