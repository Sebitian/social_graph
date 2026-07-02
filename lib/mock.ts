import type { Commentator, PostComment, ProfileData } from "./types";
import { deriveFeatures, deriveLabels, deriveRelationshipEdge, extractInteractionSignals } from "./labels";
import { compareByCloseness } from "./graphUtils";

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
