// Shared domain types for the Instagram interaction graph.
import type { ScrapeBudgetEstimate } from "./scrapeBudget";

export interface ProfileData {
  username: string;
  fullName: string;
  biography: string;
  profilePicUrl: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isPrivate: boolean;
  isVerified: boolean;
  highlightReelCount: number;
}

export interface ConnectionUser {
  username: string;
  fullName?: string;
  profilePicUrl?: string;
  followersCount?: number;
  isVerified?: boolean;
}

export type RelationshipContext =
  | "family"
  | "close_connection"
  | "past_connection"
  | "work_connection"
  | "collaborator"
  | "school_or_university"
  | "local_community"
  | "creator_or_industry_peer"
  | "community_member"
  | "acquaintance"
  | "unknown"
  | "private";

export type InteractionTag =
  | "consistent_supporter"
  | "quiet_supporter"
  | "inside_joke_connection"
  | "celebration_connection"
  | "event_connection"
  | "practical_helper"
  | "creative_collaborator"
  | "reciprocal_engager"
  | "rising_connection"
  | "fading_public_interaction"
  | "bridge_person"
  | "cluster_anchor"
  | "frequent_commenter"
  | "occasional_engager"
  | "low_context_connection";

export type InferenceSource =
  | "ai_inference"
  | "user_confirmed"
  | "user_edited"
  | "other_person_edited";

export type LabelVisibility = "private" | "shared" | "hidden";

export type InteractionSignalCategory =
  | "generic_praise"
  | "specific_personal_reference"
  | "shared_memory"
  | "inside_joke"
  | "support_or_encouragement"
  | "celebration_or_congratulations"
  | "humor_or_banter"
  | "planning_or_future_reference"
  | "work_or_collaboration_reference"
  | "school_or_university_reference"
  | "family_reference"
  | "travel_or_event_reference"
  | "group_reference"
  | "recurring_phrase"
  | "practical_help"
  | "creative_feedback"
  | "reciprocal_conversation";

export type SpecificityLevel = "generic" | "contextual" | "highly_personal";

export type InteractionTone =
  | "warm"
  | "supportive"
  | "playful"
  | "celebratory"
  | "practical"
  | "professional"
  | "neutral";

export type InteractionTrajectory =
  | "rising"
  | "stable"
  | "declining"
  | "intermittent";

export type PostType =
  | "photo"
  | "carousel"
  | "reel"
  | "milestone"
  | "travel"
  | "work"
  | "birthday"
  | "event"
  | "unknown";

export interface EvidenceItem {
  label: string;
  detail?: string;
  weight?: number;
}

export interface InteractionSignals {
  categories: InteractionSignalCategory[];
  namedPeople: string[];
  locations: string[];
  events: string[];
  organizations: string[];
  recurringPhrases: string[];
  specificity: SpecificityLevel;
  tone: InteractionTone[];
  hasSharedExperience: boolean;
  referencesOngoingRelationship: boolean;
}

/** A single comment a person left on one of your posts. */
export interface PostComment {
  authorId?: string;
  authorUsername?: string;
  postId?: string;
  text: string;
  /** Relative time, e.g. "3w", "2mo". */
  when: string;
  timestamp?: string;
  /** Short label for the post it was left on, e.g. "Sunset in Lisbon". */
  post: string;
  isReply?: boolean;
  isTopLevel?: boolean;
  ownerReplied?: boolean;
  mentionedUsers?: string[];
  postType?: PostType;
  captionCategory?: string;
  signals?: InteractionSignals;
}

/** A derived relationship context or observable interaction-role tag. */
export interface PersonLabel {
  id: string;
  label: string;
  emoji?: string;
  color: string;
  /** Short human explanation of why this label was assigned. */
  reason: string;
  /** Relationship contexts are "primary"; interaction roles are secondary tags. */
  kind: "primary" | "tag";
  context?: RelationshipContext;
  tag?: InteractionTag;
  confidence: number;
  source: InferenceSource;
  visibility: LabelVisibility;
  evidence: EvidenceItem[];
  lastUpdatedAt: string;
  needsConfirmation: boolean;
}

export interface RelationshipFeatures {
  totalComments: number;
  /** Recency-weighted comment volume; recent comments count more than old ones. */
  recencyWeightedComments: number;
  /** Overall current-closeness signal used for ranking and graph distance. */
  relationshipStrengthScore: number;
  uniquePostsCommentedOn: number;
  commentsPerMonth: number;
  recentActivityScore: number;
  historicalActivityScore: number;
  interactionConsistencyScore: number;
  commentSpecificityScore: number;
  sharedMemoryScore: number;
  insideJokeScore: number;
  supportScore: number;
  workCollaborationScore: number;
  familySchoolCommunityEvidenceScore: number;
  reciprocityScore: number;
  /** Comments the searched account left on this person's posts (reciprocity pass). */
  outboundCommentsFromTarget?: number;
  /** True when a reciprocity scrape ran for this person (public profile). */
  reciprocityObserved?: boolean;
  trajectory: InteractionTrajectory;
  firstInteractionDate?: string;
  mostRecentInteractionDate?: string;
  mostRecentDaysAgo?: number;
  strongestTopicsEvents: string[];
  clusterMembership?: number;
  bridgeScore: number;
  anchorScore: number;
}

export interface RelationshipEdge {
  fromUserId: string;
  toUserId: string;
  inferredContext?: RelationshipContext;
  interactionTags: InteractionTag[];
  confidence: number;
  evidence: EvidenceItem[];
  trajectory: InteractionTrajectory;
  source: InferenceSource;
  visibility: LabelVisibility;
  needsConfirmation: boolean;
  lastUpdatedAt: string;
}

export interface UserRelationshipEdit {
  edgeKey: string;
  labelId: string;
  label?: string;
  context?: RelationshipContext | string;
  tag?: InteractionTag | string;
  source: Extract<InferenceSource, "user_confirmed" | "user_edited" | "other_person_edited">;
  visibility: LabelVisibility;
  updatedAt: string;
}

/**
 * A visible connection attached to an interaction cluster.
 * `comments` is lifetime public volume; features carry current-strength signals.
 */
export interface Commentator {
  username: string;
  fullName?: string;
  profilePicUrl?: string;
  followersCount?: number;
  isVerified?: boolean;
  comments: number;
  circle: number;
  /** Comments this person left on other visible commenters' posts (top commenters only). */
  peerComments?: Record<string, number>;
  /** Comments the searched account left on this person's public posts. */
  outboundFromTarget?: number;
  /** Every comment this person left on your posts (demo data when not scraped). */
  history: PostComment[];
  /** Archetype + tags derived from their comments (primary first). */
  labels: PersonLabel[];
  features?: RelationshipFeatures;
  relationshipEdge?: RelationshipEdge;
}

export interface GraphNode {
  id: string;
  label: string;
  fullName?: string;
  /** "self" = the searched account, "member" = a top commentator */
  group: "self" | "member";
  /** Proximity tier: 0 = most present, 1 = regulars, 2 = wider circle. */
  circle: number;
  /** Friend-group cluster id; -1 = independent / unclustered. */
  clusterId?: number;
  /** Engagement (comments) on the searched account's posts; 0 for self. */
  comments: number;
  val: number;
  profilePicUrl?: string;
  isVerified?: boolean;
  /** Recency-weighted presence score for ring ranking (0–1). */
  presenceScore?: number;
  /** Preferred radial distance from center (px). */
  layoutRadius?: number;
  /** Comments left on other visible commenters' public posts (for pair affinity). */
  peerComments?: Record<string, number>;
  /** Comments the searched account left on this person's public posts. */
  outboundFromTarget?: number;
  /** Comment history this person left on your posts. */
  history?: PostComment[];
  /** Archetype + tags derived from their comments (primary first). */
  labels?: PersonLabel[];
  features?: RelationshipFeatures;
  relationshipEdge?: RelationshipEdge;
}

export interface GraphLink {
  source: string;
  target: string;
  /** "comment" = self ↔ member, "friend" = pair affinity within a group */
  kind: "comment" | "friend";
  /** Pair affinity weight 0–1 for friend links. */
  weight?: number;
  /** Comments member left on your posts (them → you). */
  inbound?: number;
  /** Comments you left on member's posts (you → them). */
  outbound?: number;
  /** True when a reciprocity scrape covered this person's posts. */
  reciprocityObserved?: boolean;
}

/** An interaction cluster: commenters who visibly overlap on posts / themes. */
export interface Circle {
  id: number;
  label: string;
  /** Short human-readable description shown under the cluster title. */
  subtitle?: string;
  color: string;
  size: number;
  comments: number;
  /** strong = 3+ people, small = pair */
  kind?: "strong" | "small";
  /** Extra members not rendered individually (future collapse). */
  collapsedCount?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  circles: Circle[];
}

export interface NetworkStats {
  /** How many comments we scanned to find visible connections. */
  scanned: number;
  /** How many connections are shown in the graph. */
  shown: number;
  circleCount: number;
  totalComments: number;
  topCommentators: {
    username: string;
    comments: number;
    circle: number;
  }[];
  recentCommentators: {
    username: string;
    comments: number;
    circle: number;
    latestCommentWhen: string;
    latestCommentTime?: number;
  }[];
  biggestCircle: { label: string; size: number };
}

export interface ScrapeResult {
  profile: ProfileData;
  graph: GraphData;
  stats: NetworkStats;
  budget: ScrapeBudgetEstimate;
  cached: boolean;
  demo: boolean;
  pinned?: boolean;
  scrapedAt: number;
}
