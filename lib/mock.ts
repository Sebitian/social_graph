import type { Commentator, PostComment, ProfileData, ScrapeResult } from "./types";
import { deriveFeatures, deriveLabels, deriveRelationshipEdge, extractInteractionSignals } from "./labels";
import { buildGraph, buildMemberNodes, compareByCloseness, computeStats, MAX_NODES } from "./graphUtils";
import { estimateScrapeBudget } from "./scrapeBudget";

function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = [
  "alex", "sam", "jordan", "taylor", "casey", "riley", "morgan", "jamie",
  "drew", "quinn", "avery", "parker", "reese", "rowan", "skyler", "blake",
  "noah", "mia", "liam", "emma", "olivia", "ava", "ethan", "sofia",
];
const LAST = [
  "rivera", "kim", "patel", "nguyen", "garcia", "lee", "chen", "smith",
  "lopez", "wong", "diaz", "ali", "khan", "ross", "vega", "stone",
];
const SUFFIX = ["", "_", ".official", "x", "_jpg", "23", "_films", "studio"];

const WHENS = ["2d", "5d", "1w", "2w", "3w", "1mo", "2mo", "3mo", "5mo", "8mo", "1y"];
const WHENS_OLD = ["5mo", "8mo", "1y", "1y"];

const CATS: Record<string, string[]> = {
  personal: [
    "classic you, love this", "this is so you", "miss our coffee walks",
    "same joke every time 😂", "remember when we did this", "you always find the best spots",
  ],
  family: [
    "love this cuz!!", "happy bday cousin 🎉", "auntie is so proud",
    "proud of you sis", "tell nana i said hi",
  ],
  tease: [
    "lol who let you post this", "delete this 😂", "ok show off",
    "humble much?", "couldn't be me",
  ],
  nostalgia: [
    "miss living with you", "our old apartment vibes", "dorm days >>>",
    "remember when we did this", "roommate reunion soon?",
  ],
  work: [
    "this campaign came out great", "studio day paid off", "client is going to love this",
    "your edit is so clean", "let's collab on the next one",
  ],
  school: [
    "campus days energy", "professor would love this", "same class nostalgia",
    "graduation crew forever", "student group reunion soon?",
  ],
  plans: [
    "we have to go here", "let's grab dinner soon", "coming to visit you",
    "save me a spot", "link up this week",
  ],
  hype: [
    "best one yet 🔥", "this came out so well", "iconic", "you ate this up",
    "goals fr", "killed it", "snapped 🔥",
  ],
  wholesome: [
    "so proud of you!!", "you deserve all of it", "rooting for you always",
    "love to see it", "happy for you 🥹",
  ],
  question: [
    "where is this??", "how'd you shoot this?", "what camera do you use?",
    "what's the location?", "drop the recipe?",
  ],
  emoji: ["🔥", "👏", "🙌", "✨", "😮", "💯", "👀", "😂"],
  generic: [
    "this is so good", "love this", "amazing", "great shot", "nice!",
    "so good", "beautiful", "wow",
  ],
};

interface World {
  posts: { title: string; type: PostComment["postType"]; category: string }[];
  weights: Record<string, number>;
  timing: "steady" | "rising" | "fading" | "mixed";
  commentRange: [number, number];
}

const WORLDS: World[] = [
  {
    posts: [
      { title: "Sunset in Lisbon", type: "travel", category: "travel" },
      { title: "Beach reset", type: "travel", category: "travel" },
      { title: "Lake weekend", type: "travel", category: "travel" },
      { title: "Golden hour", type: "photo", category: "travel" },
    ],
    weights: { personal: 4, plans: 3, hype: 2, wholesome: 2, generic: 1 },
    timing: "steady",
    commentRange: [10, 18],
  },
  {
    posts: [
      { title: "Studio session", type: "work", category: "work" },
      { title: "Rooftop nights", type: "event", category: "work" },
      { title: "City lights", type: "photo", category: "work" },
    ],
    weights: { work: 5, question: 2, hype: 2, generic: 1 },
    timing: "steady",
    commentRange: [8, 15],
  },
  {
    posts: [
      { title: "Trail day", type: "photo", category: "school" },
      { title: "Dinner w/ the crew", type: "event", category: "school" },
      { title: "Concert night", type: "event", category: "school" },
    ],
    weights: { school: 4, nostalgia: 3, plans: 2, tease: 2, generic: 1 },
    timing: "steady",
    commentRange: [9, 16],
  },
  {
    posts: [
      { title: "Birthday dump", type: "birthday", category: "family" },
      { title: "Home cooked", type: "photo", category: "family" },
      { title: "Sunday coffee", type: "photo", category: "family" },
    ],
    weights: { family: 5, wholesome: 3, personal: 2, generic: 1 },
    timing: "steady",
    commentRange: [7, 14],
  },
  {
    posts: [
      { title: "Morning run", type: "photo", category: "generic" },
      { title: "New haircut", type: "photo", category: "generic" },
    ],
    weights: { hype: 4, emoji: 3, generic: 4 },
    timing: "rising",
    commentRange: [4, 9],
  },
  {
    posts: [
      { title: "Morning run", type: "photo", category: "generic" },
      { title: "City lights", type: "photo", category: "generic" },
    ],
    weights: { generic: 5, emoji: 3, question: 1 },
    timing: "mixed",
    commentRange: [2, 5],
  },
];

export function buildMockProfile(handle: string): ProfileData {
  const rand = seeded(handle);
  const followers = 400 + Math.floor(rand() * 50000);
  const following = 150 + Math.floor(rand() * 1200);
  return {
    username: handle.replace(/^@/, "").toLowerCase(),
    fullName: handle
      .replace(/[^a-z0-9]/gi, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    biography: "📍 somewhere good · this is demo data · add APIFY_TOKEN for real scraping",
    profilePicUrl: "",
    followersCount: followers,
    followingCount: following,
    postsCount: 12 + Math.floor(rand() * 800),
    isPrivate: false,
    isVerified: rand() > 0.7,
    highlightReelCount: Math.floor(rand() * 8),
  };
}

function weightedPick(rand: () => number, weights: Record<string, number>): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[0][0];
}

function pickWhen(
  rand: () => number,
  timing: World["timing"],
  index: number,
  total: number,
): string {
  const r = rand();
  if (timing === "rising") {
    return index < Math.ceil(total * 0.75)
      ? WHENS[Math.floor(r * r * 5)]
      : WHENS_OLD[Math.floor(r * WHENS_OLD.length)];
  }
  if (timing === "fading") {
    return index < Math.ceil(total * 0.3)
      ? WHENS[Math.floor(r * 4)]
      : WHENS_OLD[Math.floor(r * WHENS_OLD.length)];
  }
  return WHENS[Math.floor(r * WHENS.length)];
}

export interface MockReciprocityOptions {
  reciprocityEnabled?: boolean;
  reciprocityFriends?: number;
  reciprocityPostsPerFriend?: number;
}

/**
 * Build commentators grouped into shared "worlds" so pair affinity can
 * detect real friend-group clusters. Solo archetypes get unique posts.
 */
export function buildMockCommentators(
  handle: string,
  count: number,
  reciprocity: MockReciprocityOptions = {},
): Commentator[] {
  const rand = seeded(handle + ":circles");
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const self = handle.toLowerCase();
  const seen = new Set<string>();
  const out: Commentator[] = [];

  const slots: { world: World | null; slotInWorld: number }[] = [];
  let wi = 0;
  let membersInWorld = 0;
  const membersPerWorld = [4, 4, 3, 3, 2, 1];

  for (let i = 0; i < count; i++) {
    if (membersInWorld >= (membersPerWorld[wi] ?? 1)) {
      wi++;
      membersInWorld = 0;
    }
    const world = wi < WORLDS.length ? WORLDS[wi] : null;
    slots.push({ world, slotInWorld: membersInWorld });
    membersInWorld++;
  }

  for (let i = 0; i < count; i++) {
    const { world, slotInWorld } = slots[i];
    let username = "";
    let guard = 0;
    do {
      username = `${pick(FIRST)}${pick(LAST)}${pick(SUFFIX)}`.toLowerCase();
    } while ((seen.has(username) || username === self) && guard++ < 200);
    seen.add(username);

    const weights = world?.weights ?? { generic: 4, emoji: 2, hype: 1 };
    const timing = world?.timing ?? "mixed";
    const [minC, maxC] = world?.commentRange ?? [2, 5];
    const comments = Math.max(2, Math.round(minC + rand() * (maxC - minC)));

    const history: PostComment[] = [];
    for (let k = 0; k < comments; k++) {
      const cat = weightedPick(rand, weights);
      const text = pick(CATS[cat]);
      const postDef =
        world?.posts[k % world.posts.length] ??
        { title: pick(["Morning run", "New haircut", "City lights"]), type: "photo" as const, category: "generic" };
      const post = postDef.title;
      history.push({
        authorId: username,
        authorUsername: username,
        postId: post.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        text:
          slotInWorld > 0 && k % 4 === 0
            ? `${text} @${[...seen][(i + slotInWorld) % seen.size] ?? "friend"}`
            : text,
        when: pickWhen(rand, timing, k, comments),
        post,
        isTopLevel: true,
        ownerReplied: rand() > 0.58,
        postType: postDef.type,
        captionCategory: postDef.category,
      });
    }

    history.sort((a, b) => WHENS.indexOf(a.when) - WHENS.indexOf(b.when));
    const enriched = history.map((comment) => ({
      ...comment,
      signals: extractInteractionSignals(comment),
    }));
    const labels = deriveLabels(enriched);
    const features = deriveFeatures(enriched);

    out.push({
      username,
      fullName: username
        .replace(/[._]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      followersCount: 50 + Math.floor(rand() * 90000),
      isVerified: rand() > 0.92,
      comments,
      circle: -1,
      history: enriched,
      labels,
      features,
      relationshipEdge: deriveRelationshipEdge(self, username, labels, features),
    });
  }

  // Simulate direct cross-profile comments within shared worlds (top commenters only).
  const worldGroups = new Map<number, string[]>();
  for (let i = 0; i < count; i++) {
    const wi = slots[i].world ? WORLDS.indexOf(slots[i].world!) : -1;
    if (wi < 0) continue;
    const group = worldGroups.get(wi) ?? [];
    group.push(out[i].username.toLowerCase());
    worldGroups.set(wi, group);
  }

  for (const group of worldGroups.values()) {
    if (group.length < 2) continue;
    for (const username of group) {
      const commentator = out.find((c) => c.username.toLowerCase() === username);
      if (!commentator) continue;
      const peerComments: Record<string, number> = {};
      for (const peer of group) {
        if (peer === username) continue;
        peerComments[peer] = 1 + Math.floor(rand() * 4);
      }
      commentator.peerComments = peerComments;
    }
  }

  const reciprocityRand = seeded(handle + ":reciprocity");
  const reciprocityEnabled = reciprocity.reciprocityEnabled !== false;
  const reciprocityCap = reciprocityEnabled
    ? Math.min(reciprocity.reciprocityFriends ?? count, out.length)
    : 0;
  const reciprocityPostsCap = Math.max(3, reciprocity.reciprocityPostsPerFriend ?? 4);

  const sorted = out.sort(
    (a, b) =>
      (b.features?.relationshipStrengthScore ?? 0) -
        (a.features?.relationshipStrengthScore ?? 0) ||
      b.comments - a.comments,
  );

  for (let i = 0; i < reciprocityCap; i++) {
    const commentator = sorted[i];
    let outbound =
      reciprocityRand() > 0.22
        ? 1 + Math.floor(reciprocityRand() * Math.min(4, reciprocityPostsCap))
        : 0;
    if (outbound === 0 && i < Math.min(6, reciprocityCap)) {
      outbound = 1 + Math.floor(reciprocityRand() * 2);
    }
    commentator.outboundFromTarget = outbound;
    const features = deriveFeatures(commentator.history, {
      outboundFromTarget: outbound,
      reciprocityObserved: true,
      reciprocityPostsCap,
    });
    const labels = deriveLabels(commentator.history, {
      outboundFromTarget: outbound,
      reciprocityObserved: true,
      reciprocityPostsCap,
    });
    commentator.features = features;
    commentator.labels = labels;
    commentator.relationshipEdge = deriveRelationshipEdge(
      self,
      commentator.username.toLowerCase(),
      labels,
      features,
    );
  }

  return [...sorted].sort(compareByCloseness);
}

/* ------------------------------------------------------------------
 * LinkedIn demo data
 * ------------------------------------------------------------------ */

const LINKEDIN_POSTS = [
  "Excited to share that we just closed our Series A. Huge thanks to the team and investors who believed in the vision.",
  "After 12 months of building in public, here are the 5 hardest lessons I learned about product-market fit.",
  "We are hiring a Senior Product Designer. Remote-first, meaningful equity, and a team that cares about craft.",
  "Just shipped the feature our users asked for most. The feedback loop is everything.",
  "A few thoughts on the future of AI infrastructure and why I think the tooling layer is still wide open.",
  "Grateful for the team that made this quarter’s launch possible. None of this happens alone.",
  "New post: the metrics that actually matter when scaling a B2B SaaS go-to-market engine.",
  "Join me at the Growth Summit next week — I’ll be speaking about remote GTM playbooks.",
  "Remote work changed how we collaborate, but the fundamentals of trust and accountability stayed the same.",
  "Customer feedback is the best product roadmap. Here is what we learned from 50 calls this month.",
  "Proud to announce a partnership that brings our platform to thousands of new teams.",
  "Reflections on transitioning from IC to manager: the job is no longer your output, it’s the team’s.",
];

const LINKEDIN_POSITIONS = [
  "Product Manager at TechCo",
  "Founder & CEO at Startup Inc",
  "Senior Engineer at CloudScale",
  "Marketing Lead at GrowthBrand",
  "Investor at Seed VC",
  "Design Director at Creative Studio",
  "Head of Sales at SaaS Inc",
  "Data Scientist at AI Labs",
  "Operations Lead at LogisticsCo",
  "Strategy Consultant at BigThree",
  "VP of Growth at ScaleUp",
  "Community Lead at OpenSource",
  "Content Strategist at MediaHub",
  "Research Lead at ThinkTank",
  "Talent Partner at TechRecruit",
];

const LINKEDIN_COMMENTS = [
  "Congrats team — well deserved!",
  "This is a huge milestone. Proud of what you built.",
  "Would love to hear more about the tech stack behind this.",
  "Well written. The customer insight section really resonated.",
  "Agreed, the remote-first playbook is still evolving for everyone.",
  "Congratulations! Rooting for you all the way.",
  "Thanks for sharing, this is super helpful for my team.",
  "Looking forward to the launch.",
  "Great work — clearly a lot of effort went into this.",
  "This is why I follow your updates.",
  "Can we grab coffee to discuss this further?",
  "Happy to make an intro if it would be helpful.",
  "Your team is crushing it.",
  "Interesting take — I’ve seen similar results in our org.",
  "Well said. The hiring angle is spot on.",
  "Proud to see this growth.",
  "Send me the link when it’s live.",
  "Would love to collaborate on something like this.",
  "This is inspiring — thanks for writing it.",
  "Great insights, thank you for sharing.",
  "The metrics framework is exactly what we needed.",
  "Looking forward to hearing you speak at the summit.",
  "Customer calls are underrated. This is how you build conviction.",
  "Partnerships like this are how categories get made.",
  "The transition from IC to manager is harder than it looks.",
];

const LINKEDIN_REACTIONS = ["LIKE", "CELEBRATE", "LOVE", "SUPPORT", "INSIGHTFUL", "FUNNY"];

function buildMockLinkedInPostRefs(): { id: string; label: string; postedAt: string }[] {
  const base = Date.now() - 1000 * 60 * 60 * 24 * 60;
  return LINKEDIN_POSTS.map((label, i) => ({
    id: `linkedin-post-${i}`,
    label: label.length > 72 ? `${label.slice(0, 71)}…` : label,
    postedAt: new Date(base + i * 1000 * 60 * 60 * 24 * 5).toISOString(),
  }));
}

export function buildMockLinkedInProfile(handle: string): ProfileData {
  const profile = buildMockProfile(handle);
  return {
    ...profile,
    biography: "Building products, scaling teams, and sharing lessons in public. This is demo data — add APIFY_TOKEN for real scraping.",
    followersCount: 400 + Math.floor(seeded(handle)() * 15000),
    followingCount: 150 + Math.floor(seeded(handle)() * 1500),
    postsCount: LINKEDIN_POSTS.length,
    highlightReelCount: 0,
  };
}

export function buildMockLinkedInCommentators(
  handle: string,
  count: number,
  reciprocity: MockReciprocityOptions = {},
): Commentator[] {
  const rand = seeded(handle + ":linkedin");
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const self = handle.toLowerCase();
  const posts = buildMockLinkedInPostRefs();
  const seen = new Set<string>();
  const out: Commentator[] = [];

  for (let i = 0; i < count; i++) {
    let username = "";
    let guard = 0;
    do {
      username = `${pick(FIRST)}${pick(LAST)}`.toLowerCase();
    } while ((seen.has(username) || username === self) && guard++ < 200);
    seen.add(username);

    const comments = 2 + Math.floor(rand() * 9);
    const history: PostComment[] = [];
    const commentedPostIds = new Set<string>();

    for (let k = 0; k < comments; k++) {
      const post = posts[Math.floor(rand() * posts.length)];
      commentedPostIds.add(post.id);
      const text = pick(LINKEDIN_COMMENTS);
      const whenOffset = Math.floor(rand() * 50);
      const when = whenOffset < 7 ? `${whenOffset + 1} days ago` : `${Math.floor((whenOffset - 7) / 4) + 1} weeks ago`;
      history.push({
        authorId: username,
        authorUsername: username,
        postId: post.id,
        text,
        when,
        timestamp: new Date(Date.now() - whenOffset * 86_400_000).toISOString(),
        post: post.label,
        isTopLevel: true,
        ownerReplied: rand() > 0.6,
        postType: "unknown",
        captionCategory: "unknown",
      });
    }

    const enriched = history.map((comment) => ({
      ...comment,
      signals: extractInteractionSignals(comment),
    }));
    const labels = deriveLabels(enriched);
    const features = deriveFeatures(enriched);
    const reactionsTotal = Math.floor(rand() * 6);
    const reactionsByType: Record<string, number> = {};
    if (reactionsTotal > 0) {
      reactionsByType.LIKE = Math.max(1, Math.floor(reactionsTotal * 0.6));
      let remaining = reactionsTotal - reactionsByType.LIKE;
      while (remaining > 0) {
        const type = pick(LINKEDIN_REACTIONS);
        if (type === "LIKE") {
          reactionsByType.LIKE += 1;
        } else {
          reactionsByType[type] = (reactionsByType[type] ?? 0) + 1;
        }
        remaining--;
      }
    }

    out.push({
      username,
      fullName: username
        .replace(/[._]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      position: pick(LINKEDIN_POSITIONS),
      followersCount: 200 + Math.floor(rand() * 50000),
      isVerified: rand() > 0.9,
      comments,
      circle: -1,
      history: enriched,
      labels,
      features,
      relationshipEdge: deriveRelationshipEdge(self, username, labels, features),
      reactionsTotal: reactionsTotal > 0 ? reactionsTotal : undefined,
      reactionsByType: reactionsTotal > 0 ? reactionsByType : undefined,
      postsReactedTo: reactionsTotal > 0 ? Math.floor(rand() * commentedPostIds.size) + 1 : undefined,
      postsCommentedOn: commentedPostIds.size,
      totalPostsScraped: posts.length,
    });
  }

  // Reciprocity pass for top commenters (LinkedIn-style: owner comments back on their posts).
  const reciprocityRand = seeded(handle + ":linkedin-reciprocity");
  const reciprocityEnabled = reciprocity.reciprocityEnabled !== false;
  const reciprocityCap = reciprocityEnabled
    ? Math.min(reciprocity.reciprocityFriends ?? out.length, out.length)
    : 0;
  const reciprocityPostsCap = Math.max(3, reciprocity.reciprocityPostsPerFriend ?? 4);

  const sorted = out.sort(
    (a, b) =>
      (b.features?.relationshipStrengthScore ?? 0) -
        (a.features?.relationshipStrengthScore ?? 0) ||
      b.comments - a.comments,
  );

  for (let i = 0; i < reciprocityCap; i++) {
    const commentator = sorted[i];
    let outbound =
      reciprocityRand() > 0.25
        ? 1 + Math.floor(reciprocityRand() * Math.min(4, reciprocityPostsCap))
        : 0;
    if (outbound === 0 && i < Math.min(6, reciprocityCap)) {
      outbound = 1 + Math.floor(reciprocityRand() * 2);
    }
    commentator.outboundFromTarget = outbound;
    const features = deriveFeatures(commentator.history, {
      outboundFromTarget: outbound,
      reciprocityObserved: true,
      reciprocityPostsCap,
    });
    const labels = deriveLabels(commentator.history, {
      outboundFromTarget: outbound,
      reciprocityObserved: true,
      reciprocityPostsCap,
    });
    commentator.features = features;
    commentator.labels = labels;
    commentator.relationshipEdge = deriveRelationshipEdge(
      self,
      commentator.username.toLowerCase(),
      labels,
      features,
    );
  }

  return [...sorted].sort(compareByCloseness);
}

export function buildMockLinkedInResult(
  handle: string,
  budget: ReturnType<typeof estimateScrapeBudget> = estimateScrapeBudget({}),
): ScrapeResult {
  const profile = buildMockLinkedInProfile(handle);
  const commentators = buildMockLinkedInCommentators(handle, MAX_NODES, {
    reciprocityEnabled: budget.reciprocityEnabled,
    reciprocityFriends: budget.reciprocityFriends,
    reciprocityPostsPerFriend: budget.reciprocityPostsPerFriend,
  });
  const posts = buildMockLinkedInPostRefs().map((p) => ({
    id: p.id,
    label: p.label,
    postedAt: p.postedAt,
  }));
  const allEngagers = buildMemberNodes(profile, commentators);
  const graph = buildGraph(profile, commentators);
  const selfNode = graph.nodes.find((n) => n.group === "self");
  if (selfNode && profile.fullName) selfNode.fullName = profile.fullName;
  return {
    profile,
    graph,
    stats: {
      ...computeStats(profile, commentators, commentators.length * 3),
      shown: graph.nodes.filter((n) => n.group === "member").length,
    },
    budget,
    cached: false,
    demo: true,
    scrapedAt: Date.now(),
    posts,
    engagers: allEngagers,
  };
}

/* ------------------------------------------------------------------
 * Spotify demo data
 * ------------------------------------------------------------------ */

import type {
  SpotifyGenre,
  SpotifyGraphData,
  SpotifyGraphLink,
  SpotifyGraphNode,
  SpotifyPlaylistSummary,
  SpotifyProfile,
  SpotifyStats,
  SpotifyTasteResult,
  SpotifyTrack,
} from "./spotifyTypes";

const SPOTIFY_ARTISTS: { name: string; genre: string }[] = [
  { name: "The Weeknd", genre: "Alt R&B" },
  { name: "SZA", genre: "Alt R&B" },
  { name: "Frank Ocean", genre: "Alt R&B" },
  { name: "Travis Scott", genre: "Hip-Hop" },
  { name: "Kendrick Lamar", genre: "Hip-Hop" },
  { name: "Future", genre: "Hip-Hop" },
  { name: "Post Malone", genre: "Hip-Hop / Pop" },
  { name: "Drake", genre: "Hip-Hop" },
  { name: "Taylor Swift", genre: "Pop" },
  { name: "Billie Eilish", genre: "Alt Pop" },
  { name: "Olivia Rodrigo", genre: "Pop / Rock" },
  { name: "Dua Lipa", genre: "Pop / Dance" },
  { name: "Tove Lo", genre: "Pop / Electronic" },
  { name: "David Guetta", genre: "Dance / Electronic" },
  { name: "Calvin Harris", genre: "Dance / Electronic" },
  { name: "Hippie Sabotage", genre: "Indie Electronic" },
  { name: "Masego", genre: "Jazz / Soul" },
  { name: "FKJ", genre: "Jazz / Soul" },
  { name: "Norah Jones", genre: "Jazz / Soul" },
  { name: "Def Leppard", genre: "Rock" },
  { name: "Arctic Monkeys", genre: "Indie Rock" },
  { name: "Tame Impala", genre: "Psychedelic Pop" },
  { name: "Bon Iver", genre: "Indie Folk" },
  { name: "Bad Bunny", genre: "Latin Urban" },
  { name: "Karol G", genre: "Latin Pop" },
  { name: "Rosalía", genre: "Latin Experimental" },
  { name: "Daft Punk", genre: "Electronic" },
  { name: "Flume", genre: "Electronic" },
  { name: "Odesza", genre: "Indie Electronic" },
  { name: "Glass Animals", genre: "Indie Pop" },
];

const SPOTIFY_PLAYLIST_TITLES = [
  "Drive Time",
  "Focus Flow",
  "Late Night",
  "Workout Energy",
  "Chill Vibes",
  "Discover Weekly Picks",
  "Road Trip",
  "Morning Coffee",
  "Party Starters",
  "Rainy Day",
];

const SPOTIFY_GENRE_COLORS = [
  "#1DB954",
  "#1ED760",
  "#2E77D0",
  "#E13300",
  "#AF2896",
  "#FF4632",
  "#509BF5",
  "#F59B23",
  "#B49BC8",
  "#148A08",
];

function buildSpotifyTrack(rand: () => number, trackIndex: number): SpotifyTrack {
  const artist = SPOTIFY_ARTISTS[Math.floor(rand() * SPOTIFY_ARTISTS.length)];
  const plays = 100_000 + Math.floor(rand() * 900_000_000);
  return {
    trackName: `Track ${trackIndex + 1}`,
    trackId: `track-${trackIndex}-${Math.floor(rand() * 1e6)}`,
    artists: [{ artistName: artist.name, artistId: `artist-${artist.name.toLowerCase().replace(/\s+/g, "-")}` }],
    plays: String(plays),
    trackDuration: 120_000 + Math.floor(rand() * 240_000),
    albumName: "Album",
    albumId: `album-${trackIndex}`,
    albumArt: "",
    contentRating: rand() > 0.8 ? "EXPLICIT" : "NONE",
  };
}

function buildSpotifyGenres(playlists: SpotifyPlaylistSummary[]): SpotifyGenre[] {
  const bucket = new Map<
    string,
    { label: string; weight: number; playlistIds: Set<string>; evidence: { trackId: string; trackName: string; artistNames: string[]; reason: string }[] }
  >();

  for (const playlist of playlists) {
    for (const track of playlist.tracks ?? []) {
      const genre = track.artists[0]?.artistName
        ? SPOTIFY_ARTISTS.find((a) => a.name === track.artists[0].artistName)?.genre ?? "Eclectic"
        : "Eclectic";
      const id = genre.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      let entry = bucket.get(id);
      if (!entry) {
        entry = { label: genre, weight: 0, playlistIds: new Set(), evidence: [] };
        bucket.set(id, entry);
      }
      entry.weight += 1;
      entry.playlistIds.add(playlist.id);
      if (entry.evidence.length < 8) {
        entry.evidence.push({
          trackId: track.trackId,
          trackName: track.trackName,
          artistNames: track.artists.map((a) => a.artistName),
          reason: `artist:${track.artists[0]?.artistName ?? "unknown"}`,
        });
      }
    }
  }

  return [...bucket.entries()]
    .map(([id, entry], index) => ({
      id,
      label: entry.label,
      weight: entry.weight,
      playlistIds: [...entry.playlistIds],
      evidence: entry.evidence,
      color: SPOTIFY_GENRE_COLORS[index % SPOTIFY_GENRE_COLORS.length],
    }))
    .sort((a, b) => b.weight - a.weight);
}

function buildSpotifyGraph(
  profile: SpotifyProfile,
  friends: SpotifyProfile[],
  playlists: SpotifyPlaylistSummary[],
  genres: SpotifyGenre[],
): SpotifyGraphData {
  const selfId = `self:${profile.userId}`;
  const nodes: SpotifyGraphNode[] = [
    {
      id: selfId,
      label: profile.displayName,
      kind: "self",
      imageUrl: profile.profileImage,
      refId: profile.userId,
      weight: 1,
      color: "#1DB954",
    },
  ];
  const links: SpotifyGraphLink[] = [];
  const personNodeId = new Map<string, string>([[profile.userId, selfId]]);

  for (const friend of friends) {
    const nodeId = `friend:${friend.userId}`;
    personNodeId.set(friend.userId, nodeId);
    nodes.push({
      id: nodeId,
      label: friend.displayName,
      kind: "friend" as const,
      imageUrl: friend.profileImage,
      refId: friend.userId,
      weight: 1,
      color: "#509BF5",
    });
    links.push({ source: selfId, target: nodeId, kind: "self-friend", weight: 1 });
  }

  for (const playlist of playlists) {
    const nodeId = `playlist:${playlist.id}`;
    const ownerNode = personNodeId.get(playlist.ownerId) ?? selfId;
    nodes.push({
      id: nodeId,
      label: playlist.title,
      kind: "playlist" as const,
      imageUrl: playlist.image,
      refId: playlist.id,
      ownerId: playlist.ownerId,
      hasTracks: playlist.hasTracks,
      trackCount: playlist.trackCount ?? playlist.tracks?.length,
      weight: playlist.hasTracks ? 1.2 : 1,
      color: playlist.hasTracks ? "#1ED760" : "#535353",
    });
    links.push({ source: ownerNode, target: nodeId, kind: "profile-playlist", weight: 1 });
  }

  for (const genre of genres) {
    const linkedPlaylists = genre.playlistIds.filter((playlistId) =>
      playlists.some((p) => p.id === playlistId),
    );
    if (linkedPlaylists.length === 0) continue;
    const nodeId = `genre:${genre.id}`;
    nodes.push({
      id: nodeId,
      label: genre.label,
      kind: "genre" as const,
      refId: genre.id,
      weight: genre.weight,
      color: genre.color,
    });
    for (const playlistId of linkedPlaylists) {
      links.push({ source: `playlist:${playlistId}`, target: nodeId, kind: "playlist-genre", weight: genre.weight });
    }
  }

  return { nodes, links };
}

function buildSpotifyStats(
  profile: SpotifyProfile,
  friends: SpotifyProfile[],
  playlists: SpotifyPlaylistSummary[],
  genres: SpotifyGenre[],
): SpotifyStats {
  const artistSet = new Set<string>();
  let trackCount = 0;
  for (const playlist of playlists) {
    for (const track of playlist.tracks ?? []) {
      trackCount += 1;
      for (const artist of track.artists) {
        artistSet.add(artist.artistName.toLowerCase());
      }
    }
  }
  return {
    playlistCount: playlists.length,
    playlistsWithTracks: playlists.filter((p) => p.hasTracks).length,
    trackCount,
    uniqueArtists: artistSet.size,
    genreCount: genres.length,
    followers: profile.followersCount,
    following: profile.followingCount,
    friendCount: friends.length,
  };
}

export function buildMockSpotifyTasteResult(handle: string): SpotifyTasteResult {
  const rand = seeded(handle + ":spotify");
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const userId = `user-${handle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.floor(rand() * 1e6)}`;
  const displayName = handle
    .replace(/[^a-z0-9]/gi, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || "Spotify User";

  const profile: SpotifyProfile = {
    userId,
    displayName,
    username: handle.toLowerCase(),
    profileImage: "",
    sourceUrl: `https://open.spotify.com/user/${userId}`,
    followersCount: 10 + Math.floor(rand() * 500),
    followingCount: 20 + Math.floor(rand() * 800),
    totalPublicPlaylists: 6 + Math.floor(rand() * 10),
    role: "self",
  };

  const friends: SpotifyProfile[] = [];
  const friendCount = 1 + Math.floor(rand() * 2);
  for (let i = 0; i < friendCount; i++) {
    const friendName = `${pick(FIRST)} ${pick(LAST)}`;
    const friendId = `friend-${friendName.toLowerCase().replace(/\s+/g, "-")}-${i}`;
    friends.push({
      userId: friendId,
      displayName: friendName.replace(/\b\w/g, (c) => c.toUpperCase()),
      username: friendName.toLowerCase().replace(/\s+/g, ""),
      profileImage: "",
      sourceUrl: `https://open.spotify.com/user/${friendId}`,
      followersCount: Math.floor(rand() * 300),
      followingCount: Math.floor(rand() * 600),
      totalPublicPlaylists: 2 + Math.floor(rand() * 20),
      role: "friend",
    });
  }

  const playlists: SpotifyPlaylistSummary[] = [];
  const playlistCount = 4 + Math.floor(rand() * 5);
  for (let i = 0; i < playlistCount; i++) {
    const owner = rand() > 0.85 && friends.length > 0 ? pick(friends) : profile;
    const trackCount = 5 + Math.floor(rand() * 25);
    const tracks: SpotifyTrack[] = [];
    for (let t = 0; t < trackCount; t++) {
      tracks.push(buildSpotifyTrack(rand, i * 100 + t));
    }
    playlists.push({
      id: `playlist-${handle}-${i}`,
      title: SPOTIFY_PLAYLIST_TITLES[i % SPOTIFY_PLAYLIST_TITLES.length] || `Playlist ${i + 1}`,
      url: `https://open.spotify.com/playlist/playlist-${handle}-${i}`,
      image: "",
      trackCount,
      tracks,
      hasTracks: true,
      ownerId: owner.userId,
      ownerName: owner.displayName,
    });
  }

  const genres = buildSpotifyGenres(playlists);
  const graphGenres = genres.slice(0, 8);
  const graph = buildSpotifyGraph(profile, friends, playlists, graphGenres);
  const stats = buildSpotifyStats(profile, friends, playlists, genres);

  return {
    kind: "spotify",
    scrapedAt: Date.now(),
    demo: true,
    cached: false,
    profile,
    friends,
    playlists,
    genres,
    graph,
    taste: {
      source: "heuristic",
      topGenres: genres.slice(0, 8).map((g) => ({ id: g.id, label: g.label, weight: g.weight })),
      notes: "v1 genre labels from artist heuristics; demo data.",
    },
    stats,
  };
}
