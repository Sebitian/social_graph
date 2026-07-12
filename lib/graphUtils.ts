import type {
  Circle,
  Commentator,
  GraphData,
  GraphLink,
  GraphNode,
  NetworkStats,
  PostComment,
  ProfileData,
} from "./types";
import { deriveFeatures, deriveRelationshipEdge, extractInteractionSignals } from "./labels";

/** How many top connections we surface in the graph. */
export const MAX_NODES = 24;

const DECAY_DAYS = 120;

/** Proximity tiers — distance from you, not friend groups. */
export const PROXIMITY_RINGS: readonly {
  id: number;
  label: string;
  subtitle: string;
  color: string;
}[] = [
  {
    id: 0,
    label: "Most present",
    subtitle: "Recent, consistent interaction",
    color: "#ff6b9d",
  },
  {
    id: 1,
    label: "Regulars",
    subtitle: "Meaningful past engagement",
    color: "#7c6bff",
  },
  {
    id: 2,
    label: "Wider circle",
    subtitle: "Lighter or older interaction",
    color: "#94a3b8",
  },
] as const;

export const CIRCLE_COLORS = PROXIMITY_RINGS.map((r) => r.color);
export const SELF_COLOR = "#fccc63";
export const UNCLUSTERED_COLOR = "#8b93a7";

export const AVATAR_DIAMETER = 40;
export const SELF_NODE_RADIUS = 22;
export const MEMBER_NODE_RADIUS = AVATAR_DIAMETER / 2;
export const MIN_NODE_CENTER_SPACING = AVATAR_DIAMETER + 44;
export const MAX_CLUSTER_LOCAL_OFFSET = 72;
export const MAX_RADIAL_ADJUSTMENT = 52;

const AFFINITY_PAIR_CAP = 20;
const AFFINITY_THRESHOLD = 0.3;
const STRONG_PAIR_THRESHOLD = 0.42;

const CLUSTER_COLORS = [
  "#ff6b9d",
  "#7c6bff",
  "#34d399",
  "#fbbf24",
  "#38bdf8",
  "#fb7185",
] as const;

export interface ProximityRadii {
  mostPresent: number;
  regular: number;
  outer: number;
}

export interface FriendClusterMeta {
  id: number;
  memberIds: string[];
  kind: "strong" | "small";
  label: string;
  subtitle: string;
  color: string;
}

export interface SocialMapLayout {
  positions: Map<string, { x: number; y: number }>;
  proximityRadii: ProximityRadii;
  ringGuides: number[];
  clusterBounds: Map<
    number,
    { cx: number; cy: number; radius: number; label: string; color: string }
  >;
}

/**
 * Responsive ring radii — leave clear air around the self node so spoke
 * arrows/labels do not collapse into a blob at the center.
 */
export function responsiveRingRadii(
  width: number,
  height: number,
  memberCount = 24,
): ProximityRadii {
  const minDim = Math.min(width, height);
  // Inner ring must fit ~6–8 avatars on its circumference without stacking.
  const innerFloor =
    (Math.min(Math.max(memberCount, 8), 12) * MIN_NODE_CENTER_SPACING) /
    (2 * Math.PI);

  const mostPresent = Math.max(minDim * 0.28, innerFloor * 1.2, 150);
  const regular = Math.max(minDim * 0.48, mostPresent + MIN_NODE_CENTER_SPACING * 1.6);
  const outer = Math.max(minDim * 0.7, regular + MIN_NODE_CENTER_SPACING * 1.5);

  return { mostPresent, regular, outer };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function relativeDays(when?: string, timestamp?: string): number | undefined {
  if (timestamp) {
    const ms = Date.parse(timestamp);
    if (!Number.isNaN(ms)) return Math.max(0, (Date.now() - ms) / 86_400_000);
  }
  if (!when) return undefined;
  const clean = when.trim().toLowerCase();
  if (clean === "today" || clean === "recently") return 0;
  const match = clean.match(/^(\d+)\s*(second|minute|hour|day|week|month|year|s|m|h|d|w|mo|y)s?(?:\s+ago)?$/i);
  if (!match) return undefined;
  const n = Number(match[1]);
  const unit = match[2];
  if (unit.startsWith("s") || unit === "m" || unit.startsWith("minute") || unit.startsWith("h")) return 0;
  if (unit.startsWith("d")) return n;
  if (unit.startsWith("w")) return n * 7;
  if (unit === "mo" || unit.startsWith("month")) return n * 30;
  return n * 365;
}

function commentTimeValue(when?: string, timestamp?: string): number {
  if (timestamp) {
    const ms = Date.parse(timestamp);
    if (!Number.isNaN(ms)) return ms;
  }
  const days = relativeDays(when);
  if (days == null) return 0;
  return Date.now() - days * 86_400_000;
}

function decayWeight(when?: string, timestamp?: string): number {
  const days = relativeDays(when, timestamp) ?? 180;
  return Math.exp(-days / DECAY_DAYS);
}

function latestComment(c: Commentator | GraphNode): { when: string; time: number } {
  const history = c.history ?? [];
  const latest = [...history].sort(
    (a, b) => commentTimeValue(b.when, b.timestamp) - commentTimeValue(a.when, a.timestamp),
  )[0];
  return {
    when: latest?.when ?? "unknown",
    time: latest ? commentTimeValue(latest.when, latest.timestamp) : 0,
  };
}

/** Days since this person's most recent comment on your posts (lower = more recent). */
export function daysSinceLatestComment(history: PostComment[]): number {
  if (history.length === 0) return 9999;
  return Math.min(
    ...history.map((c) => relativeDays(c.when, c.timestamp) ?? 9999),
  );
}

type ClosenessRankable = {
  history?: PostComment[];
  presenceScore?: number;
  comments?: number;
};

/**
 * Single ranking for graph distance and the "Most present" sidebar list.
 * Most recent comment wins; then presence score; then total volume.
 */
export function compareByCloseness(a: ClosenessRankable, b: ClosenessRankable): number {
  const daysA = daysSinceLatestComment(a.history ?? []);
  const daysB = daysSinceLatestComment(b.history ?? []);
  if (daysA !== daysB) return daysA - daysB;

  const scoreA = a.presenceScore ?? computePresenceScore(a.history ?? []);
  const scoreB = b.presenceScore ?? computePresenceScore(b.history ?? []);
  if (scoreB !== scoreA) return scoreB - scoreA;

  return (b.comments ?? b.history?.length ?? 0) - (a.comments ?? a.history?.length ?? 0);
}

function countSignals(history: PostComment[], category: string): number {
  return history.filter((c) =>
    extractInteractionSignals(c).categories.includes(category as never),
  ).length;
}

function consistencyScore(history: PostComment[]): number {
  if (history.length === 0) return 0;
  const uniquePosts = new Set(history.map((c) => c.postId ?? c.post)).size;
  const dates = history
    .map((c) => relativeDays(c.when, c.timestamp))
    .filter((d): d is number => d != null);
  const span =
    dates.length >= 2 ? Math.max(30, Math.max(...dates) - Math.min(...dates)) : 30;
  const months = span / 30;
  const recent = history.filter((c) => (relativeDays(c.when, c.timestamp) ?? 9999) <= 90).length;
  const older = history.length - recent;
  return clamp01(
    (uniquePosts / Math.max(history.length, 1)) * 0.45 +
      (recent > 0 && older > 0 ? 0.35 : 0) +
      clamp01(history.length / (months * 3)) * 0.2,
  );
}

/** Score how personal / specific someone's comments feel (0–1). */
export function computePersonalCommentScore(history: PostComment[]): number {
  if (history.length === 0) return 0;

  let total = 0;
  for (const comment of history) {
    const signals = extractInteractionSignals(comment);
    let personal = 0;

    if (signals.namedPeople.length > 0) personal += 0.18;
    if (signals.categories.includes("shared_memory")) personal += 0.22;
    if (signals.categories.includes("inside_joke")) personal += 0.22;
    if (signals.categories.includes("recurring_phrase")) personal += 0.14;
    if (signals.categories.includes("specific_personal_reference")) personal += 0.18;
    if (signals.categories.includes("travel_or_event_reference")) personal += 0.1;
    if (signals.categories.includes("work_or_collaboration_reference")) personal += 0.1;
    if (signals.categories.includes("school_or_university_reference")) personal += 0.1;
    if (signals.categories.includes("support_or_encouragement")) personal += 0.12;
    if (signals.categories.includes("celebration_or_congratulations")) personal += 0.1;
    if (signals.specificity === "highly_personal") personal += 0.16;

    const genericOnly =
      signals.categories.length <= 1 &&
      (signals.categories.includes("generic_praise") || signals.categories.length === 0);
    const emojiOnly =
      comment.text.trim().length <= 4 &&
      /[\u{1F300}-\u{1FAFF}]/u.test(comment.text);
    if (genericOnly || emojiOnly) personal *= 0.15;

    total += clamp01(personal);
  }

  return clamp01(total / history.length);
}

/** Recency-weighted presence score for radial placement (0–1). */
export function computePresenceScore(history: PostComment[]): number {
  if (history.length === 0) return 0;

  const daysSinceLatest = daysSinceLatestComment(history);
  const recencyScore = clamp01(Math.exp(-daysSinceLatest / 45));

  let recentVolume = 0;
  for (const comment of history) {
    const days = relativeDays(comment.when, comment.timestamp) ?? 180;
    if (days <= 90) recentVolume += decayWeight(comment.when, comment.timestamp);
  }
  const recentCommentVolumeScore = clamp01(recentVolume / 4);

  return clamp01(
    0.65 * recencyScore +
      0.2 * recentCommentVolumeScore +
      0.08 * consistencyScore(history) +
      0.04 * clamp01(history.length / 14) +
      0.03 * computePersonalCommentScore(history),
  );
}

function postKey(comment: PostComment): string {
  return (comment.postId ?? comment.post).toLowerCase();
}

function uniquePosts(history: PostComment[]): Set<string> {
  return new Set(history.map(postKey));
}

function coCommentAffinity(a: GraphNode, b: GraphNode): number {
  const postsA = uniquePosts(a.history ?? []);
  const postsB = uniquePosts(b.history ?? []);
  let shared = 0;
  for (const post of postsA) {
    if (postsB.has(post)) shared++;
  }
  if (shared === 0) return 0;
  if (shared === 1) return 0.12;
  const denom = Math.min(postsA.size, postsB.size);
  return clamp01(shared / Math.max(denom, 2));
}

function replyMentionAffinity(a: GraphNode, b: GraphNode): number {
  let hits = 0;
  const bHandle = b.label.toLowerCase();
  const aHandle = a.label.toLowerCase();

  for (const comment of a.history ?? []) {
    if (comment.isReply) hits += 0.15;
    if (comment.mentionedUsers?.some((m) => m.toLowerCase() === b.id)) hits += 0.35;
    if (comment.text.toLowerCase().includes(`@${bHandle}`)) hits += 0.25;
  }
  for (const comment of b.history ?? []) {
    if (comment.isReply) hits += 0.15;
    if (comment.mentionedUsers?.some((m) => m.toLowerCase() === a.id)) hits += 0.35;
    if (comment.text.toLowerCase().includes(`@${aHandle}`)) hits += 0.25;
  }

  return clamp01(hits / 2.5);
}

function sharedContextAffinity(a: GraphNode, b: GraphNode): number {
  const catsA = new Set(
    (a.history ?? []).map((c) => c.captionCategory ?? c.postType ?? "generic"),
  );
  const catsB = new Set(
    (b.history ?? []).map((c) => c.captionCategory ?? c.postType ?? "generic"),
  );
  let overlap = 0;
  for (const cat of catsA) {
    if (catsB.has(cat) && cat !== "generic") overlap++;
  }

  const locA = new Set((a.history ?? []).flatMap((c) => c.signals?.locations ?? []));
  const locB = new Set((b.history ?? []).flatMap((c) => c.signals?.locations ?? []));
  for (const loc of locA) {
    if (locB.has(loc)) overlap += 0.5;
  }

  return clamp01(overlap / 3);
}

function directCommentAffinity(a: GraphNode, b: GraphNode): number {
  const postsA = Math.max(uniquePosts(a.history ?? []).size, 3);
  const postsB = Math.max(uniquePosts(b.history ?? []).size, 3);
  const aOnB = (a.peerComments?.[b.id] ?? 0) / postsB;
  const bOnA = (b.peerComments?.[a.id] ?? 0) / postsA;
  return clamp01((aOnB + bOnA) / 2);
}

export function computePairAffinity(a: GraphNode, b: GraphNode): number {
  return clamp01(
    0.45 * directCommentAffinity(a, b) +
      0.25 * coCommentAffinity(a, b) +
      0.15 * replyMentionAffinity(a, b) +
      0.15 * sharedContextAffinity(a, b),
  );
}

class UnionFind {
  private parent = new Map<string, string>();

  find(id: string): string {
    if (!this.parent.has(id)) this.parent.set(id, id);
    const root = this.parent.get(id)!;
    if (root !== id) this.parent.set(id, this.find(root));
    return this.parent.get(id)!;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

function countSharedPosts(members: GraphNode[]): number {
  const postCounts = new Map<string, number>();
  for (const member of members) {
    for (const post of uniquePosts(member.history ?? [])) {
      postCounts.set(post, (postCounts.get(post) ?? 0) + 1);
    }
  }
  return [...postCounts.values()].filter((n) => n >= 2).length;
}

function dominantSignalCategory(members: GraphNode[]): string | undefined {
  const counts = new Map<string, number>();
  for (const member of members) {
    for (const comment of member.history ?? []) {
      for (const category of comment.signals?.categories ?? []) {
        if (category === "generic_praise") continue;
        counts.set(category, (counts.get(category) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function dominantClusterLabel(members: GraphNode[]): string {
  const counts = new Map<string, number>();
  for (const member of members) {
    for (const comment of member.history ?? []) {
      const cat = comment.captionCategory ?? comment.postType;
      if (!cat || cat === "generic" || cat === "photo" || cat === "unknown") continue;
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0]?.[0];
  switch (top) {
    case "travel":
      return "Travel friends";
    case "work":
      return "Work circle";
    case "school":
      return "School friends";
    case "family":
      return "Family";
    case "event":
      return "Event crew";
  }

  const signal = dominantSignalCategory(members);
  switch (signal) {
    case "work_or_collaboration_reference":
      return "Work & collab";
    case "school_or_university_reference":
      return "School ties";
    case "family_reference":
      return "Family";
    case "travel_or_event_reference":
      return "Events & travel";
    case "celebration_or_congratulations":
      return "Cheer squad";
    case "inside_joke":
    case "shared_memory":
      return "Inside circle";
  }

  const sharedPosts = countSharedPosts(members);
  if (sharedPosts >= 2) return "Same-post regulars";
  if (sharedPosts >= 1 && members.length >= 3) return "Often on the same posts";
  if (members.length >= 3) return "Comment together";
  return "Paired connection";
}

function clusterSubtitle(kind: "strong" | "small", members: GraphNode[]): string {
  const sharedPosts = countSharedPosts(members);
  if (sharedPosts >= 1) {
    return sharedPosts === 1
      ? "Commented on at least one post together"
      : `Overlapped on ${sharedPosts} of your posts`;
  }
  return kind === "strong"
    ? "People who keep showing up near each other"
    : "A visible paired connection";
}

/** Detect friend-group pods from pair affinity (top commenters only). */
export function detectFriendClusters(members: GraphNode[]): FriendClusterMeta[] {
  const capped = [...members]
    .sort(
      (a, b) =>
        (b.presenceScore ?? 0) - (a.presenceScore ?? 0) ||
        b.comments - a.comments,
    )
    .slice(0, AFFINITY_PAIR_CAP);

  const ids = capped.map((m) => m.id);
  const byId = new Map(capped.map((m) => [m.id, m]));
  const pairScores = new Map<string, number>();

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = byId.get(ids[i])!;
      const b = byId.get(ids[j])!;
      const score = computePairAffinity(a, b);
      if (score >= AFFINITY_THRESHOLD) {
        pairScores.set(`${ids[i]}:${ids[j]}`, score);
      }
    }
  }

  const uf = new UnionFind();
  for (const key of pairScores.keys()) {
    const [a, b] = key.split(":");
    uf.union(a, b);
  }

  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const root = uf.find(id);
    const group = groups.get(root) ?? [];
    group.push(id);
    groups.set(root, group);
  }

  const clusters: FriendClusterMeta[] = [];
  let clusterId = 0;

  for (const memberIds of groups.values()) {
    if (memberIds.length < 2) continue;

    let avgAffinity = 0;
    let pairs = 0;
    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        const key = `${memberIds[i]}:${memberIds[j]}`;
        const reverse = `${memberIds[j]}:${memberIds[i]}`;
        const score = pairScores.get(key) ?? pairScores.get(reverse) ?? 0;
        avgAffinity += score;
        pairs++;
      }
    }
    avgAffinity = pairs > 0 ? avgAffinity / pairs : 0;

    const clusterMembers = memberIds
      .map((id) => byId.get(id)!)
      .filter(Boolean);

    // Require real co-presence on posts — affinity alone can invent vague pods.
    if (countSharedPosts(clusterMembers) < 1) continue;

    const kind =
      memberIds.length >= 3
        ? "strong"
        : avgAffinity >= STRONG_PAIR_THRESHOLD
          ? "small"
          : null;
    if (!kind) continue;

    const label = dominantClusterLabel(clusterMembers);

    const id = clusterId;
    clusterId += 1;

    clusters.push({
      id,
      memberIds: memberIds.sort(),
      kind,
      label,
      subtitle: clusterSubtitle(kind, clusterMembers),
      color: CLUSTER_COLORS[id % CLUSTER_COLORS.length],
    });
  }

  return clusters;
}

function proximityTierForRank(rank: number, total: number): number {
  if (total <= 1) return 0;
  const percentile = rank / (total - 1);
  if (percentile <= 0.25) return 0;
  if (percentile <= 0.7) return 1;
  return 2;
}

function preferredRadiusForNode(
  node: GraphNode,
  rank: number,
  total: number,
  radii: ProximityRadii,
): number {
  const tier = proximityTierForRank(rank, total);
  const tierRadius =
    tier === 0 ? radii.mostPresent : tier === 1 ? radii.regular : radii.outer;
  const nextRadius =
    tier === 0
      ? radii.regular
      : tier === 1
        ? radii.outer
        : radii.outer + MAX_RADIAL_ADJUSTMENT;

  const tierStart = tier === 0 ? 0 : tier === 1 ? 0.25 : 0.7;
  const tierEnd = tier === 0 ? 0.25 : tier === 1 ? 0.7 : 1;
  const span = Math.max(tierEnd - tierStart, 0.01);
  const localT = (rank / Math.max(total - 1, 1) - tierStart) / span;
  const scoreBias = ((node.presenceScore ?? 0) - 0.5) * MAX_RADIAL_ADJUSTMENT * 0.45;

  return (
    tierRadius +
    (nextRadius - tierRadius) * clamp01(localT) * 0.48 +
    scoreBias
  );
}

function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function polarToXY(radius: number, angle: number): { x: number; y: number } {
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function resolveCollisions(
  positions: Map<string, { x: number; y: number }>,
  preferredRadii: Map<string, number>,
  iterations = 16,
): void {
  const ids = [...positions.keys()];
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const idA = ids[i];
        const idB = ids[j];
        const a = positions.get(idA)!;
        const b = positions.get(idB)!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const minDist = MIN_NODE_CENTER_SPACING;
        if (dist >= minDist) continue;

        const push = (minDist - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;

        for (const id of [idA, idB]) {
          const pos = positions.get(id)!;
          const preferred = preferredRadii.get(id) ?? Math.hypot(pos.x, pos.y);
          const currentR = Math.hypot(pos.x, pos.y) || 0.001;
          const clampedR = Math.max(
            preferred - MAX_RADIAL_ADJUSTMENT,
            Math.min(preferred + MAX_RADIAL_ADJUSTMENT, currentR),
          );
          const scale = clampedR / currentR;
          pos.x *= scale;
          pos.y *= scale;
        }
      }
    }
  }
}

/** Deterministic social map: radial presence + affinity pods + collision pass. */
export function computeSocialMapLayout(
  members: GraphNode[],
  clusters: FriendClusterMeta[],
  width: number,
  height: number,
): SocialMapLayout {
  const ranked = [...members].sort(compareByCloseness);
  const proximityRadii = responsiveRingRadii(width, height, ranked.length);
  const ringGuides = [
    proximityRadii.mostPresent,
    proximityRadii.regular,
    proximityRadii.outer,
  ];

  const preferredRadii = new Map<string, number>();
  ranked.forEach((node, index) => {
    preferredRadii.set(
      node.id,
      preferredRadiusForNode(node, index, ranked.length, proximityRadii),
    );
  });

  const clusterByMember = new Map<string, number>();
  for (const cluster of clusters) {
    for (const id of cluster.memberIds) clusterByMember.set(id, cluster.id);
  }

  const positions = new Map<string, { x: number; y: number }>();
  const clusterBounds = new Map<
    number,
    { cx: number; cy: number; radius: number; label: string; color: string }
  >();

  const sortedClusters = [...clusters].sort((a, b) => a.id - b.id);
  const clusterCount = sortedClusters.length;
  const sectorSize = (Math.PI * 2) / Math.max(clusterCount + 1, 3);
  const startAngle = -Math.PI / 2;

  sortedClusters.forEach((cluster, clusterIndex) => {
    const clusterMembers = cluster.memberIds
      .map((id) => ranked.find((m) => m.id === id))
      .filter((m): m is GraphNode => !!m);

    if (!clusterMembers.length) return;

    const avgRadius =
      clusterMembers.reduce((sum, m) => sum + (preferredRadii.get(m.id) ?? 0), 0) /
      clusterMembers.length;
    const sectorMid = startAngle + sectorSize * (clusterIndex + 0.5);
    const centroid = polarToXY(avgRadius, sectorMid);

    const localRadius = Math.min(
      MAX_CLUSTER_LOCAL_OFFSET,
      MIN_NODE_CENTER_SPACING * 0.55,
    );

    clusterMembers.forEach((member, memberIndex) => {
      const localAngle =
        clusterMembers.length === 1
          ? 0
          : (memberIndex / clusterMembers.length) * Math.PI * 2;
      const offset = polarToXY(localRadius, localAngle);
      positions.set(member.id, {
        x: centroid.x + offset.x,
        y: centroid.y + offset.y,
      });
    });

    let maxDist = MIN_NODE_CENTER_SPACING;
    for (const member of clusterMembers) {
      const pos = positions.get(member.id)!;
      maxDist = Math.max(maxDist, distance(centroid, pos) + MEMBER_NODE_RADIUS + 8);
    }

    clusterBounds.set(cluster.id, {
      cx: centroid.x,
      cy: centroid.y,
      radius: maxDist,
      label: cluster.label,
      color: cluster.color,
    });
  });

  const unclustered = ranked.filter((m) => !clusterByMember.has(m.id));
  unclustered.forEach((member, index) => {
    const jitter = (stableHash(member.id) - 0.5) * 0.35;
    const angle =
      startAngle +
      ((index + 0.5 + jitter) / Math.max(unclustered.length, 1)) * Math.PI * 2;
    const radius = preferredRadii.get(member.id) ?? proximityRadii.regular;
    positions.set(member.id, polarToXY(radius, angle));
  });

  resolveCollisions(positions, preferredRadii);

  return { positions, proximityRadii, ringGuides, clusterBounds };
}

/** @deprecated Use computeSocialMapLayout — kept for tests importing the old name. */
export function computeProximityLayout(
  members: GraphNode[],
  width = 900,
  height = 900,
  clusters: FriendClusterMeta[] = [],
): SocialMapLayout {
  return computeSocialMapLayout(members, clusters, width, height);
}

function nodeSize(presenceScore: number): number {
  return Math.max(3, Math.min(14, 4 + presenceScore * 10));
}

export function deriveSimpleTags(node: GraphNode): string[] {
  const history = node.history ?? [];
  const f = node.features;
  const tags: string[] = [];
  if (!f) return tags;

  if (f.supportScore >= 0.22) tags.push("Supportive");
  if (f.insideJokeScore >= 0.18 || f.sharedMemoryScore >= 0.18) tags.push("Inside jokes");
  if (countSignals(history, "travel_or_event_reference") >= 2) tags.push("Travel posts");
  if (countSignals(history, "work_or_collaboration_reference") >= 1) tags.push("Work references");
  if (countSignals(history, "school_or_university_reference") >= 1) tags.push("School references");
  if (f.trajectory === "rising" || (node.comments > 0 && f.recentActivityScore >= 0.55)) {
    tags.push("Recent connection");
  }
  if (node.comments >= 8) tags.push("Frequent commenter");
  if (
    node.outboundFromTarget != null &&
    node.outboundFromTarget > 0 &&
    node.features?.reciprocityObserved
  ) {
    tags.push("You comment back");
  }

  return tags.slice(0, 6);
}

export function explainRingPlacement(
  node: GraphNode,
  ring: { id: number; label: string },
): string {
  const parts: string[] = [];
  switch (ring.id) {
    case 0:
      parts.push("among your most present commenters");
      break;
    case 1:
      parts.push("in your regulars tier");
      break;
    default:
      parts.push("in your wider visible circle");
  }
  if (node.features?.mostRecentDaysAgo != null && node.features.mostRecentDaysAgo <= 30) {
    parts.push("with recent activity");
  }
  if (node.clusterId != null && node.clusterId >= 0) {
    parts.push("grouped with people who often appear together");
  }
  return `${ring.label} — ${parts.join(", ")}. Closer to you means more recent and consistent interaction.`;
}

export function strongestTies(
  nodeId: string,
  members: GraphNode[],
  limit = 3,
): { targetId: string; weight: number }[] {
  const source = members.find((m) => m.id === nodeId);
  if (!source) return [];

  return members
    .filter((m) => m.id !== nodeId)
    .map((target) => ({ targetId: target.id, weight: computePairAffinity(source, target) }))
    .filter((tie) => tie.weight >= AFFINITY_THRESHOLD * 0.85)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
}

export function buildGraph(
  profile: ProfileData,
  commentators: Commentator[],
): GraphData {
  const self = profile.username.toLowerCase();
  const members = commentators.filter((c) => c.username.toLowerCase() !== self);

  const memberNodes: GraphNode[] = members.map((c) => {
    const id = c.username.toLowerCase();
    const presenceScore = computePresenceScore(c.history);
    const features =
      c.features ?? deriveFeatures(c.history, { circle: -1 });
    const labels = c.labels;
    const relationshipEdge =
      c.relationshipEdge ??
      deriveRelationshipEdge(self, id, labels ?? [], features);

    return {
      id,
      label: c.username,
      fullName: c.fullName,
      group: "member" as const,
      circle: -1,
      clusterId: -1,
      comments: c.comments,
      val: nodeSize(presenceScore),
      presenceScore,
      peerComments: c.peerComments,
      outboundFromTarget: c.outboundFromTarget,
      profilePicUrl: c.profilePicUrl,
      isVerified: c.isVerified,
      history: c.history,
      labels,
      features,
      relationshipEdge,
    };
  });

  const ranked = [...memberNodes].sort(compareByCloseness);

  ranked.forEach((node, index) => {
    node.circle = proximityTierForRank(index, ranked.length);
    node.layoutRadius = undefined;
  });

  const friendClusters = detectFriendClusters(memberNodes);
  const clusterMemberCounts = new Map<number, number>();
  const clusterCommentTotals = new Map<number, number>();

  for (const cluster of friendClusters) {
    for (const memberId of cluster.memberIds) {
      const node = memberNodes.find((m) => m.id === memberId);
      if (!node) continue;
      node.clusterId = cluster.id;
      clusterMemberCounts.set(cluster.id, (clusterMemberCounts.get(cluster.id) ?? 0) + 1);
      clusterCommentTotals.set(
        cluster.id,
        (clusterCommentTotals.get(cluster.id) ?? 0) + node.comments,
      );
    }
  }

  const proximityCounts = [0, 0, 0];
  const proximityComments = [0, 0, 0];
  for (const node of memberNodes) {
    if (node.circle >= 0 && node.circle <= 2) {
      proximityCounts[node.circle]++;
      proximityComments[node.circle] += node.comments;
    }
  }

  const circles: Circle[] = friendClusters.map((cluster) => ({
    id: cluster.id,
    label: cluster.label,
    subtitle: cluster.subtitle,
    color: cluster.color,
    size: clusterMemberCounts.get(cluster.id) ?? cluster.memberIds.length,
    comments: clusterCommentTotals.get(cluster.id) ?? 0,
    kind: cluster.kind,
  }));

  const nodes: GraphNode[] = [
    {
      id: self,
      label: profile.username,
      group: "self",
      circle: -1,
      clusterId: -1,
      comments: 0,
      val: 24,
      presenceScore: 1,
      profilePicUrl: profile.profilePicUrl || undefined,
      isVerified: profile.isVerified,
    },
    ...memberNodes,
  ];

  const links: GraphLink[] = members.map((c) => ({
    source: self,
    target: c.username.toLowerCase(),
    kind: "comment" as const,
    inbound: c.comments,
    outbound: c.outboundFromTarget,
    reciprocityObserved: c.features?.reciprocityObserved,
  }));

  for (let i = 0; i < memberNodes.length; i++) {
    for (let j = i + 1; j < memberNodes.length; j++) {
      const a = memberNodes[i];
      const b = memberNodes[j];
      const weight = computePairAffinity(a, b);
      if (weight >= AFFINITY_THRESHOLD) {
        links.push({ source: a.id, target: b.id, kind: "friend", weight });
      }
    }
  }

  return { nodes, links, circles };
}

export function computeStats(
  profile: ProfileData,
  commentators: Commentator[],
  scanned: number,
): NetworkStats {
  const graph = buildGraph(profile, commentators);
  const totalComments = commentators.reduce((sum, c) => sum + c.comments, 0);

  const topCommentators = [...commentators]
    .sort(
      (a, b) =>
        b.comments - a.comments ||
        latestComment(b).time - latestComment(a).time,
    )
    .slice(0, MAX_NODES)
    .map((c) => {
      const node = graph.nodes.find((n) => n.id === c.username.toLowerCase());
      return {
        username: c.username,
        comments: c.comments,
        circle: node?.circle ?? 2,
      };
    });

  const recentCommentators = [...commentators]
    .sort(compareByCloseness)
    .slice(0, MAX_NODES)
    .map((commentator) => {
      const node = graph.nodes.find((n) => n.id === commentator.username.toLowerCase());
      const latest = latestComment(commentator);
      return {
        username: commentator.username,
        comments: commentator.comments,
        circle: node?.circle ?? 2,
        latestCommentWhen: latest.when,
        latestCommentTime: latest.time,
      };
    });

  let biggestCircle = { label: "Often on the same posts", size: 0 };
  for (const circle of graph.circles) {
    if (circle.size > biggestCircle.size) {
      biggestCircle = { label: circle.label, size: circle.size };
    }
  }

  return {
    scanned,
    shown: commentators.length,
    circleCount: graph.circles.length,
    totalComments,
    topCommentators,
    recentCommentators,
    biggestCircle,
  };
}

export function compactNumber(n: number): string {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export type { ProfileData };
