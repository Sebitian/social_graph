import type {
  EvidenceItem,
  InteractionSignalCategory,
  InteractionSignals,
  InteractionTag,
  InteractionTone,
  InteractionTrajectory,
  PersonLabel,
  PostComment,
  RelationshipContext,
  RelationshipEdge,
  RelationshipFeatures,
} from "./types";

const NOW = () => new Date().toISOString();

const CATEGORY_MATCHERS: {
  category: InteractionSignalCategory;
  re: RegExp;
}[] = [
  { category: "generic_praise", re: /(nice|amazing|love this|so good|great shot|incredible|beautiful|stunning|iconic|goals|🔥|👏|🙌|✨)/i },
  { category: "specific_personal_reference", re: /(you always|your style|your work|your laugh|your family|your team|this is so you|classic you|only you)/i },
  { category: "shared_memory", re: /(remember when|throwback|back in|old days|that trip|our old|dorm|roommate|reunion|same place as|like last time)/i },
  { category: "inside_joke", re: /(inside joke|classic us|not again|our bit|same joke|iykyk|you know why|never beating|still laughing|😂)/i },
  { category: "support_or_encouragement", re: /(proud|rooting for|you deserve|happy for you|keep going|congrats|congratulations|love to see|inspiring)/i },
  { category: "celebration_or_congratulations", re: /(happy birthday|hbd|birthday|congrats|graduation|graduated|promotion|anniversary|milestone|celebrate|🎉)/i },
  { category: "humor_or_banter", re: /(lol|lmao|haha|delete this|who let you|calm down|show off|couldn'?t be me|joking|😂|🤣)/i },
  { category: "planning_or_future_reference", re: /(let'?s|we should|we have to|we need to|come visit|see you soon|next time|pull up|link up|grab dinner|save me)/i },
  { category: "work_or_collaboration_reference", re: /(work|project|client|shoot|studio|campaign|launch|collab|collaboration|edit|design|set|industry|portfolio|creative)/i },
  { category: "school_or_university_reference", re: /(school|university|college|campus|class|lecture|professor|student|alumni|graduation|dorm|semester)/i },
  { category: "family_reference", re: /(\bcuz\b|cousin|\bfam\b|family|auntie|uncle|nephew|niece|sis|bro|grandma|grandpa|nana|mom|dad)/i },
  { category: "travel_or_event_reference", re: /(trip|travel|flight|airport|hotel|beach|festival|concert|wedding|party|dinner|weekend|lisbon|paris|nyc|la\b)/i },
  { category: "group_reference", re: /(crew|team|group|everyone|the girls|the boys|squad|community|club|collective)/i },
  { category: "practical_help", re: /(send me|i sent|dm me|call me|need help|i got you|can help|recipe|location|what camera|how did you|link\?)/i },
  { category: "creative_feedback", re: /(composition|lighting|color|edit|shot|camera|lens|design|mix|sound|styling|frame|angle)/i },
];

const TONE_MATCHERS: { tone: InteractionTone; re: RegExp }[] = [
  { tone: "supportive", re: /(proud|rooting|deserve|keep going|inspiring|love to see|happy for you)/i },
  { tone: "celebratory", re: /(congrats|congratulations|happy birthday|hbd|graduation|promotion|🎉)/i },
  { tone: "playful", re: /(lol|lmao|haha|joking|banter|😂|🤣|show off|who let you)/i },
  { tone: "practical", re: /(send|dm|call|help|recipe|location|link|how did you)/i },
  { tone: "professional", re: /(project|client|campaign|studio|launch|portfolio|collab|industry)/i },
  { tone: "warm", re: /(love this|miss you|so good|beautiful|amazing|💕|❤️)/i },
];

const STOPWORDS = new Set([
  "this",
  "that",
  "with",
  "from",
  "your",
  "you",
  "are",
  "the",
  "and",
  "for",
  "lol",
  "haha",
]);

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function score(count: number, total: number, multiplier = 1): number {
  if (total === 0) return 0;
  return clamp((count / total) * multiplier);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
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

function decayedWeight(comment: PostComment): number {
  const days = relativeDays(comment.when, comment.timestamp) ?? 30;
  return Math.exp(-days / 180);
}

function dateFromComment(comment: PostComment): string | undefined {
  if (comment.timestamp && !Number.isNaN(Date.parse(comment.timestamp))) {
    return new Date(comment.timestamp).toISOString();
  }
  const days = relativeDays(comment.when);
  if (days == null) return undefined;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function extractMentions(text: string): string[] {
  return unique([...text.matchAll(/@([a-z0-9._]{1,30})/gi)].map((m) => m[1].toLowerCase()));
}

function extractCapitalizedPhrases(text: string): string[] {
  return unique(
    [...text.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g)]
      .map((m) => m[1].trim())
      .filter((v) => !STOPWORDS.has(v.toLowerCase())),
  ).slice(0, 5);
}

function inferSpecificity(text: string, categories: InteractionSignalCategory[]): "generic" | "contextual" | "highly_personal" {
  const personal = new Set([
    "specific_personal_reference",
    "shared_memory",
    "inside_joke",
    "family_reference",
    "planning_or_future_reference",
  ]);
  if (categories.some((c) => personal.has(c)) || extractMentions(text).length > 0) {
    return "highly_personal";
  }
  if (categories.some((c) => c !== "generic_praise") || text.length > 36) {
    return "contextual";
  }
  return "generic";
}

function inferRecurringPhrases(text: string): string[] {
  const phrases = [
    "iykyk",
    "classic us",
    "classic you",
    "not again",
    "same joke",
    "you ate",
    "love to see it",
  ];
  const lower = text.toLowerCase();
  return phrases.filter((p) => lower.includes(p));
}

export function extractInteractionSignals(comment: PostComment): InteractionSignals {
  if (comment.signals) return comment.signals;
  const text = comment.text;
  const categories = unique(
    CATEGORY_MATCHERS
      .filter((m) => m.re.test(text))
      .map((m) => m.category)
      .concat(comment.mentionedUsers?.length ? ["group_reference"] : [])
      .concat(inferRecurringPhrases(text).length ? ["recurring_phrase"] : []),
  );
  const tone = unique(TONE_MATCHERS.filter((m) => m.re.test(text)).map((m) => m.tone));
  const specificity = inferSpecificity(text, categories);
  const hasSharedExperience =
    categories.includes("shared_memory") ||
    categories.includes("inside_joke") ||
    /\b(we|our|us)\b/i.test(text);

  return {
    categories,
    namedPeople: unique([...extractMentions(text), ...(comment.mentionedUsers ?? [])]),
    locations: extractCapitalizedPhrases(text).filter((p) => /(Lisbon|Paris|London|NYC|LA|Chicago|Miami|Tokyo|Austin)/i.test(p)),
    events: extractCapitalizedPhrases(text).filter((p) => /(Birthday|Graduation|Concert|Festival|Wedding|Reunion)/i.test(p)),
    organizations: extractCapitalizedPhrases(text).filter((p) => /(University|College|Studio|Team|Club|Collective|School)/i.test(p)),
    recurringPhrases: inferRecurringPhrases(text),
    specificity,
    tone: tone.length ? tone : ["neutral"],
    hasSharedExperience,
    referencesOngoingRelationship:
      hasSharedExperience ||
      categories.includes("planning_or_future_reference") ||
      categories.includes("family_reference") ||
      /\b(always|again|next time|soon|still)\b/i.test(text),
  };
}

function countSignals(history: PostComment[], category: InteractionSignalCategory): number {
  return history.filter((c) => extractInteractionSignals(c).categories.includes(category)).length;
}

function weightedSignalScore(history: PostComment[], categories: InteractionSignalCategory[]): number {
  const total = history.reduce((sum, c) => sum + decayedWeight(c), 0);
  if (total === 0) return 0;
  const hit = history.reduce((sum, c) => {
    const signals = extractInteractionSignals(c);
    return sum + (signals.categories.some((cat) => categories.includes(cat)) ? decayedWeight(c) : 0);
  }, 0);
  return clamp(hit / total);
}

function computeTrajectory(history: PostComment[]): InteractionTrajectory {
  if (history.length < 3) return "intermittent";
  const recent = history.filter((c) => (relativeDays(c.when, c.timestamp) ?? 9999) <= 90).length;
  const historical = history.filter((c) => (relativeDays(c.when, c.timestamp) ?? 0) > 90).length;
  const recentRatio = recent / history.length;
  if (recentRatio >= 0.62 && recent >= 3) return "rising";
  if (historical >= 4 && recentRatio <= 0.18) return "declining";
  if (recent > 0 && historical > 0) return "stable";
  return "intermittent";
}

function commentsPerMonth(history: PostComment[]): number {
  const dates = history.map(dateFromComment).filter(Boolean).map((d) => Date.parse(d!));
  if (dates.length < 2) return history.length;
  const spanDays = Math.max(30, (Math.max(...dates) - Math.min(...dates)) / 86_400_000);
  return history.length / (spanDays / 30);
}

function relationshipStrength(history: PostComment[], specificityScore: number): number {
  if (history.length === 0) return 0;
  const weightedComments = history.reduce((sum, c) => sum + decayedWeight(c), 0);
  const recent = history.filter((c) => (relativeDays(c.when, c.timestamp) ?? 9999) <= 90).length;
  const recentShare = recent / history.length;
  const weightedVolumeScore = clamp(weightedComments / 8);
  const consistencyScore = clamp(new Set(history.map((c) => c.postId ?? c.post)).size / 5);

  return clamp(
    weightedVolumeScore * 0.48 +
      recentShare * 0.28 +
      specificityScore * 0.16 +
      consistencyScore * 0.08,
  );
}

function topTopics(history: PostComment[]): string[] {
  const counts = new Map<string, number>();
  for (const c of history) {
    const signals = extractInteractionSignals(c);
    for (const value of [
      c.captionCategory,
      c.postType && c.postType !== "unknown" ? c.postType : undefined,
      ...signals.events,
      ...signals.organizations,
      ...signals.locations,
    ]) {
      if (!value) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);
}

export function deriveFeatures(
  history: PostComment[],
  options: {
    circle?: number;
    circleSize?: number;
    outboundFromTarget?: number;
    reciprocityObserved?: boolean;
    reciprocityPostsCap?: number;
  } = {},
): RelationshipFeatures {
  const total = history.length;
  const specificityPoints = history.reduce((sum, c) => {
    const level = extractInteractionSignals(c).specificity;
    return sum + (level === "highly_personal" ? 1 : level === "contextual" ? 0.55 : 0.15);
  }, 0);
  const dates = history.map(dateFromComment).filter(Boolean) as string[];
  const recent = history.filter((c) => (relativeDays(c.when, c.timestamp) ?? 9999) <= 90).length;
  const old = history.filter((c) => (relativeDays(c.when, c.timestamp) ?? 0) > 180).length;
  const ownerReplies = history.filter((c) => c.ownerReplied).length;
  const uniquePosts = new Set(history.map((c) => c.postId ?? c.post)).size;
  const commentSpecificityScore = total ? clamp(specificityPoints / total) : 0;
  const recencyWeightedComments = history.reduce((sum, c) => sum + decayedWeight(c), 0);
  const mostRecentDaysAgo = Math.min(
    ...history.map((c) => relativeDays(c.when, c.timestamp) ?? Number.POSITIVE_INFINITY),
  );
  const inboundReplyRate = total ? clamp(ownerReplies / total) : 0;
  const outboundCount = options.outboundFromTarget;
  const reciprocityObserved = options.reciprocityObserved === true;
  const outboundCap = Math.max(3, options.reciprocityPostsCap ?? 4);
  const outboundRate =
    reciprocityObserved && outboundCount != null
      ? clamp(outboundCount / outboundCap)
      : undefined;
  const reciprocityScore =
    outboundRate != null
      ? clamp(inboundReplyRate * 0.35 + outboundRate * 0.65)
      : inboundReplyRate;

  return {
    totalComments: total,
    recencyWeightedComments: Number(recencyWeightedComments.toFixed(2)),
    relationshipStrengthScore: Number(
      relationshipStrength(history, commentSpecificityScore).toFixed(3),
    ),
    uniquePostsCommentedOn: uniquePosts,
    commentsPerMonth: Number(commentsPerMonth(history).toFixed(2)),
    recentActivityScore: score(recent, total, 1.2),
    historicalActivityScore: score(old, total, 1.2),
    interactionConsistencyScore: total >= 10 && recent > 0 && old > 0 ? 0.9 : clamp(uniquePosts / Math.max(total, 1)),
    commentSpecificityScore,
    sharedMemoryScore: weightedSignalScore(history, ["shared_memory"]),
    insideJokeScore: weightedSignalScore(history, ["inside_joke", "recurring_phrase"]),
    supportScore: weightedSignalScore(history, ["support_or_encouragement", "celebration_or_congratulations"]),
    workCollaborationScore: weightedSignalScore(history, ["work_or_collaboration_reference", "creative_feedback"]),
    familySchoolCommunityEvidenceScore: weightedSignalScore(history, [
      "family_reference",
      "school_or_university_reference",
      "group_reference",
      "travel_or_event_reference",
    ]),
    reciprocityScore: Number(reciprocityScore.toFixed(3)),
    outboundCommentsFromTarget:
      outboundCount != null && reciprocityObserved ? outboundCount : undefined,
    reciprocityObserved: reciprocityObserved || undefined,
    trajectory: computeTrajectory(history),
    firstInteractionDate: dates.sort()[0],
    mostRecentInteractionDate: dates.sort().at(-1),
    mostRecentDaysAgo: Number.isFinite(mostRecentDaysAgo)
      ? Math.round(mostRecentDaysAgo)
      : undefined,
    strongestTopicsEvents: topTopics(history),
    clusterMembership: options.circle,
    bridgeScore: history.filter((c) => extractInteractionSignals(c).categories.includes("group_reference")).length >= 2 ? 0.55 : 0.15,
    anchorScore: clamp(total / 20 + (options.circleSize ?? 1) / 20),
  };
}

function evidence(label: string, detail?: string, weight?: number): EvidenceItem {
  return { label, detail, weight };
}

function contextLabel(context: RelationshipContext): string {
  const labels: Record<RelationshipContext, string> = {
    family: "Likely family context",
    close_connection: "Likely close connection",
    past_connection: "Possible past connection",
    work_connection: "Appears to be part of your work circle",
    collaborator: "Possible collaborator",
    school_or_university: "Appears connected through school",
    local_community: "Appears connected through local community",
    creator_or_industry_peer: "Appears to be an industry peer",
    community_member: "Appears in your community",
    acquaintance: "Light public interaction",
    unknown: "Context unclear",
    private: "Private label",
  };
  return labels[context];
}

function tagLabel(tag: InteractionTag): string {
  const labels: Record<InteractionTag, string> = {
    consistent_supporter: "Consistent supporter",
    quiet_supporter: "Quiet supporter",
    inside_joke_connection: "Inside-joke connection",
    celebration_connection: "Celebration connection",
    event_connection: "Event connection",
    practical_helper: "Practical helper",
    creative_collaborator: "Creative collaborator",
    reciprocal_engager: "Reciprocal engager",
    rising_connection: "Rising public interaction",
    fading_public_interaction: "Fading public interaction",
    bridge_person: "Bridge person",
    cluster_anchor: "Cluster anchor",
    frequent_commenter: "Frequent commenter",
    occasional_engager: "Occasional engager",
    low_context_connection: "Low-context connection",
  };
  return labels[tag];
}

function makeContextLabel(
  context: RelationshipContext,
  confidence: number,
  reason: string,
  items: EvidenceItem[],
): PersonLabel {
  return {
    id: context,
    label: contextLabel(context),
    color: context === "unknown" ? "#9aa0a6" : "#2bbbad",
    reason,
    kind: "primary",
    context,
    confidence,
    source: "ai_inference",
    visibility: "private",
    evidence: items,
    lastUpdatedAt: NOW(),
    needsConfirmation: true,
  };
}

function makeTagLabel(
  tag: InteractionTag,
  confidence: number,
  reason: string,
  items: EvidenceItem[],
): PersonLabel {
  return {
    id: tag,
    label: tagLabel(tag),
    color: "#4c68d7",
    reason,
    kind: "tag",
    tag,
    confidence,
    source: "ai_inference",
    visibility: "private",
    evidence: items,
    lastUpdatedAt: NOW(),
    needsConfirmation: true,
  };
}

function estimatedContextConfidence(
  f: RelationshipFeatures,
  signalCount = 0,
  { min = 0.18, max = 0.72 }: { min?: number; max?: number } = {},
): number {
  const total = Math.max(f.totalComments, 1);
  const volumeScore = clamp(Math.log1p(total) / Math.log1p(20));
  const signalDensity = clamp(signalCount / total);
  const signalVolume = clamp(signalCount / 3);
  const consistencyScore = f.interactionConsistencyScore * volumeScore;

  const value =
    0.16 +
    volumeScore * 0.16 +
    f.relationshipStrengthScore * 0.22 +
    f.recentActivityScore * 0.14 +
    f.commentSpecificityScore * 0.16 +
    consistencyScore * 0.1 +
    f.reciprocityScore * 0.08 +
    signalDensity * 0.08 +
    signalVolume * 0.1;

  return Number(Math.max(min, Math.min(max, value)).toFixed(2));
}

function primaryContext(history: PostComment[], f: RelationshipFeatures): PersonLabel {
  const total = f.totalComments;
  const family = countSignals(history, "family_reference");
  const work = countSignals(history, "work_or_collaboration_reference");
  const creative = countSignals(history, "creative_feedback");
  const school = countSignals(history, "school_or_university_reference");
  const group = countSignals(history, "group_reference");
  const event = countSignals(history, "travel_or_event_reference");
  const support = countSignals(history, "support_or_encouragement") + countSignals(history, "celebration_or_congratulations");
  const shared = countSignals(history, "shared_memory") + countSignals(history, "inside_joke");

  if (family >= 2) {
    return makeContextLabel("family", clamp(0.55 + family / total), "Based on repeated public family references.", [
      evidence(`${family} comments included family-language signals`),
    ]);
  }
  if (work >= 2) {
    return makeContextLabel("work_connection", clamp(0.5 + work / total), "Based on repeated work, project, or industry references.", [
      evidence(`${work} comments referenced work, projects, or creative output`),
    ]);
  }
  if (school >= 2) {
    return makeContextLabel("school_or_university", clamp(0.5 + school / total), "Based on repeated school or university references.", [
      evidence(`${school} comments referenced school, campus, classes, or graduation`),
    ]);
  }
  if (
    total >= 12 &&
    f.commentSpecificityScore >= 0.55 &&
    f.reciprocityScore >= 0.35 &&
    shared >= 3 &&
    f.interactionConsistencyScore >= 0.6
  ) {
    return makeContextLabel("close_connection", 0.7, "Sustained, specific, reciprocal public interaction across time.", [
      evidence(`Commented on ${f.uniquePostsCommentedOn} posts`),
      evidence(`${shared} comments referenced shared memories, recurring jokes, or personal context`),
      evidence(`Owner replied to ${Math.round(f.reciprocityScore * total)} of ${total} comments`),
    ]);
  }
  if (
    total >= 3 &&
    f.relationshipStrengthScore >= 0.42 &&
    f.recentActivityScore >= 0.45 &&
    f.commentSpecificityScore >= 0.45
  ) {
    return makeContextLabel("close_connection", 0.56, "Recent, specific public interaction suggests current closeness.", [
      evidence(`${Math.round(f.relationshipStrengthScore * 100)}% current relationship signal`),
      evidence(
        f.mostRecentDaysAgo == null
          ? "Most recent visible comment appears recent"
          : `Most recent visible comment was ${f.mostRecentDaysAgo} days ago`,
      ),
    ]);
  }
  if (f.trajectory === "declining" && total >= 8 && f.historicalActivityScore >= 0.55) {
    return makeContextLabel("past_connection", 0.38, "Historical public interaction appears to have declined; this is a low-confidence suggestion.", [
      evidence("Previously sustained public interaction"),
      evidence("Recent public interaction is much lower"),
    ]);
  }
  if (group >= 2) {
    return makeContextLabel("community_member", clamp(0.42 + group / total), "Based on repeated group or community references.", [
      evidence(`${group} comments referenced a group, crew, team, or community`),
    ]);
  }
  if (family >= 1) {
    return makeContextLabel("family", estimatedContextConfidence(f, family, { min: 0.34, max: 0.58 }), "Assumed from visible family-language in their comments.", [
      evidence(`${family} comment${family === 1 ? "" : "s"} included family-language signals`),
      evidence("Low-confidence assumption from public comments only"),
    ]);
  }
  if (work + creative >= 1) {
    return makeContextLabel("work_connection", estimatedContextConfidence(f, work + creative, { min: 0.32, max: 0.56 }), "Assumed from visible work, project, or creative references.", [
      evidence(`${work + creative} comment${work + creative === 1 ? "" : "s"} referenced work, projects, or creative output`),
      evidence("Low-confidence assumption from public comments only"),
    ]);
  }
  if (school >= 1) {
    return makeContextLabel("school_or_university", estimatedContextConfidence(f, school, { min: 0.32, max: 0.56 }), "Assumed from visible school or university references.", [
      evidence(`${school} comment${school === 1 ? "" : "s"} referenced school, campus, classes, or graduation`),
      evidence("Low-confidence assumption from public comments only"),
    ]);
  }
  if (group + event >= 1) {
    return makeContextLabel("community_member", estimatedContextConfidence(f, group + event, { min: 0.3, max: 0.54 }), "Assumed from visible group, event, travel, or community references.", [
      evidence(`${group + event} comment${group + event === 1 ? "" : "s"} referenced a group, event, trip, or shared public setting`),
      evidence("Low-confidence assumption from public comments only"),
    ]);
  }
  if (shared >= 1 || support >= 1) {
    return makeContextLabel("acquaintance", estimatedContextConfidence(f, shared + support, { min: 0.28, max: 0.52 }), "Assumed light social connection from supportive or personal public interaction.", [
      evidence(`${shared + support} comment${shared + support === 1 ? "" : "s"} carried supportive, celebratory, shared-memory, or joke signals`),
      evidence("Low-confidence assumption from public comments only"),
    ]);
  }
  if (total >= 1) {
    return makeContextLabel("acquaintance", estimatedContextConfidence(f, 0, { min: 0.18, max: 0.46 }), "Assumed light public interaction from visible comments.", [
      evidence(`${total} public comments found`),
      evidence("No stronger public relationship cue was visible"),
    ]);
  }
  return makeContextLabel("unknown", 0.25, "Not enough public interaction to infer a relationship context.", [
    evidence("Limited public-comment evidence"),
  ]);
}

function tagLabels(history: PostComment[], f: RelationshipFeatures): PersonLabel[] {
  const total = f.totalComments;
  const tags: PersonLabel[] = [];
  const supportive = countSignals(history, "support_or_encouragement") + countSignals(history, "celebration_or_congratulations");
  const inside = countSignals(history, "inside_joke") + countSignals(history, "shared_memory");
  const events = countSignals(history, "travel_or_event_reference") + countSignals(history, "group_reference");
  const practical = countSignals(history, "practical_help");
  const creative = countSignals(history, "creative_feedback") + countSignals(history, "work_or_collaboration_reference");

  if (total >= 10 && f.supportScore >= 0.35) {
    tags.push(makeTagLabel("consistent_supporter", clamp(0.55 + f.supportScore / 2), "Frequent interaction over time with supportive or celebratory comments.", [
      evidence(`${supportive} supportive or celebratory comments`),
      evidence(`Interaction consistency score ${Math.round(f.interactionConsistencyScore * 100)}%`),
    ]));
  }
  if (inside >= 2 || f.insideJokeScore >= 0.25) {
    tags.push(makeTagLabel("inside_joke_connection", clamp(0.5 + f.insideJokeScore), "Repeated recurring phrases, shared memories, or highly personal references.", [
      evidence(`${inside} comments referenced shared memories or inside jokes`),
    ]));
  }
  if (supportive >= 2) {
    tags.push(makeTagLabel("celebration_connection", clamp(0.45 + supportive / total), "Often appears around milestones, encouragement, or celebration.", [
      evidence(`${supportive} comments were supportive or celebratory`),
    ]));
  }
  if (events >= 2) {
    tags.push(makeTagLabel("event_connection", clamp(0.45 + events / total), "Comments repeatedly reference trips, events, groups, or shared public moments.", [
      evidence(`${events} event, travel, or group-reference comments`),
    ]));
  }
  if (practical >= 2) {
    tags.push(makeTagLabel("practical_helper", clamp(0.45 + practical / total), "Comments include practical offers, questions, or coordination.", [
      evidence(`${practical} practical-help or planning comments`),
    ]));
  }
  if (creative >= 2) {
    tags.push(makeTagLabel("creative_collaborator", clamp(0.45 + creative / total), "Comments reference creative work, feedback, projects, or collaboration.", [
      evidence(`${creative} creative, work, or collaboration comments`),
    ]));
  }
  if (f.reciprocityScore >= 0.3) {
    const outbound = f.outboundCommentsFromTarget;
    const reciprocalReason =
      f.reciprocityObserved && outbound != null && outbound > 0
        ? `You commented on ${outbound} of their visible posts; they comment on yours too.`
        : "The profile owner replies to this person relatively often.";
    tags.push(makeTagLabel("reciprocal_engager", clamp(0.45 + f.reciprocityScore), reciprocalReason, [
      f.reciprocityObserved && outbound != null
        ? evidence(`You left ${outbound} visible comment${outbound === 1 ? "" : "s"} on their posts`)
        : evidence(`Owner reply rate ${Math.round(f.reciprocityScore * 100)}%`),
    ]));
  }
  if (f.trajectory === "rising") {
    tags.push(makeTagLabel("rising_connection", 0.58, "Interaction frequency and recency are increasing in the last 60-90 days.", [
      evidence("Recent comments make up most of the visible interaction"),
    ]));
  }
  if (f.trajectory === "declining") {
    tags.push(makeTagLabel("fading_public_interaction", 0.35, "Previously high public interaction appears lower recently; this is intentionally low confidence.", [
      evidence("Historical public interaction is stronger than recent interaction"),
    ]));
  }
  if (f.bridgeScore >= 0.5) {
    tags.push(makeTagLabel("bridge_person", 0.45, "This person references or tags people across more than one visible group.", [
      evidence("Group or mention signals appear in multiple comments"),
    ]));
  }
  if (f.anchorScore >= 0.65) {
    tags.push(makeTagLabel("cluster_anchor", 0.5, "This person is central in one visible interaction cluster.", [
      evidence(`${total} comments within this cluster`),
    ]));
  }
  if (total >= 12) {
    tags.push(makeTagLabel("frequent_commenter", clamp(total / 30), "Comments frequently on visible posts.", [
      evidence(`${total} public comments found`),
    ]));
  } else if (total >= 4) {
    tags.push(makeTagLabel("occasional_engager", 0.45, "Appears sometimes in public comments.", [
      evidence(`${total} public comments found`),
    ]));
  }
  if (f.commentSpecificityScore < 0.3) {
    tags.push(makeTagLabel("low_context_connection", 0.5, "Comments are mostly generic or emoji-based, so relationship context is unclear.", [
      evidence("Low comment-specificity score"),
    ]));
  }

  return tags;
}

export function deriveRelationshipEdge(
  fromUserId: string,
  toUserId: string,
  labels: PersonLabel[],
  features: RelationshipFeatures,
): RelationshipEdge {
  const primary = labels.find((l) => l.kind === "primary");
  const tags = labels.flatMap((l) => (l.tag ? [l.tag] : []));
  return {
    fromUserId,
    toUserId,
    inferredContext: primary?.context,
    interactionTags: tags,
    confidence: primary?.confidence ?? 0,
    evidence: primary?.evidence ?? [],
    trajectory: features.trajectory,
    source: "ai_inference",
    visibility: "private",
    needsConfirmation: true,
    lastUpdatedAt: NOW(),
  };
}

/**
 * Derive a cautious relationship context + observable interaction-role tags
 * from public comments. These labels are suggestions, not facts.
 */
export function deriveLabels(
  history: PostComment[],
  options: {
    circle?: number;
    circleSize?: number;
    outboundFromTarget?: number;
    reciprocityObserved?: boolean;
    reciprocityPostsCap?: number;
  } = {},
): PersonLabel[] {
  if (history.length === 0) return [];
  const enriched = history.map((comment) => ({
    ...comment,
    signals: extractInteractionSignals(comment),
  }));
  const features = deriveFeatures(enriched, options);
  return [primaryContext(enriched, features), ...tagLabels(enriched, features)];
}
