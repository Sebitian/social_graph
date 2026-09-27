import { readFileSync } from "fs";
import { join } from "path";
import { proxiedAvatarUrl } from "@/lib/avatarUrl";
import type {
  FmaCommunityGraph,
  FmaCommunityLink,
  FmaCommunityNode,
  FmaPersonComment,
  FmaSentiment,
  FmaVoiceWhy,
} from "@/lib/aimanFmaCommunityTypes";
import {
  FMA_CREATOR_ID,
  FMA_STONE_ID,
  FMA_TUCKER_ID,
  formatFmaDate,
} from "@/lib/aimanFmaCommunityTypes";

export type {
  FmaCommunityGraph,
  FmaCommunityLink,
  FmaCommunityNode,
} from "@/lib/aimanFmaCommunityTypes";

type RawComment = {
  postUrl?: string;
  text?: string;
  ownerUsername?: string;
  ownerProfilePicUrl?: string;
  likesCount?: number;
  timestamp?: string;
};

type RawReel = {
  shortCode?: string;
  url?: string;
  caption?: string;
  likesCount?: number;
  videoPlayCount?: number;
  commentsCount?: number;
  displayUrl?: string;
  timestamp?: string;
};

type RawSentiment = {
  inputText?: string;
  finalClassification?: string;
  finalScore?: number;
};

const CREATOR = FMA_CREATOR_ID;
const STONE = FMA_STONE_ID;
const TUCKER = FMA_TUCKER_ID;

const POST_META: Record<
  string,
  { label: string; title: string; color: string; x: number }
> = {
  [STONE]: {
    label: "Philosopher's Stone",
    title: "CEOs watch FMA",
    color: "#fccc63",
    x: -240,
  },
  [TUCKER]: {
    label: "Nina Tucker",
    title: "Heartbreaking episode",
    color: "#7c6bff",
    x: 240,
  },
};

const VOICE_COLORS = [
  "#ff6b9d",
  "#34d399",
  "#38bdf8",
  "#fbbf24",
  "#fb7185",
  "#a78bfa",
  "#2dd4bf",
  "#f97316",
] as const;

function shortCode(url: string | undefined): string | null {
  const match = (url ?? "").match(/\/p\/([^/?#]+)/);
  return match ? match[1] : null;
}

function mentionsInText(text: string, owner: string): string[] {
  const found = text.match(/@[a-zA-Z0-9._]+/g) ?? [];
  const unique = new Set(
    found.map((token) => token.slice(1).toLowerCase()).filter((u) => u !== owner),
  );
  return [...unique];
}

function loadJson<T>(relativePath: string): T {
  const full = join(process.cwd(), relativePath);
  return JSON.parse(readFileSync(full, "utf8")) as T;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function asSentiment(value: string | undefined): FmaSentiment | null {
  if (value === "positive" || value === "neutral" || value === "negative") {
    return value;
  }
  return null;
}

const STOPWORDS = new Set([
  "the",
  "and",
  "that",
  "this",
  "with",
  "from",
  "have",
  "just",
  "about",
  "what",
  "when",
  "they",
  "them",
  "their",
  "your",
  "you",
  "are",
  "was",
  "for",
  "not",
  "but",
  "its",
  "it's",
  "all",
  "can",
  "dont",
  "don't",
  "like",
  "really",
  "also",
  "been",
  "were",
  "will",
  "would",
  "could",
  "should",
  "because",
  "there",
  "here",
  "some",
  "more",
  "than",
  "then",
  "into",
  "over",
  "even",
  "only",
  "how",
  "why",
  "who",
  "out",
  "get",
  "got",
  "one",
  "our",
  "has",
  "had",
  "does",
  "did",
  "too",
  "very",
  "still",
  "being",
]);

const MOTIFS: { match: RegExp; label: string }[] = [
  { match: /equivalent exchange/i, label: "equivalent exchange" },
  { match: /philosopher'?s stone/i, label: "philosopher's stone" },
  { match: /nina|shu tucker|\btucker\b/i, label: "Nina Tucker" },
  { match: /just because we can/i, label: "because we can" },
  { match: /suicide nets?/i, label: "suicide nets" },
  { match: /\bcobalt\b/i, label: "cobalt mines" },
  { match: /data ?centers?/i, label: "data centers" },
  { match: /homunculus|envy/i, label: "homunculus" },
  { match: /ed and al/i, label: "Ed and Al" },
  { match: /fullmetal|fmab|\bfma\b/i, label: "Fullmetal" },
  { match: /lithium/i, label: "lithium" },
  { match: /artists?|stolen|copyright/i, label: "stolen art" },
];

function commentPhrase(texts: string[]): string {
  const blob = texts
    .join(" ")
    .replace(/@[a-z0-9._]+/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!blob) return "comment";
  for (const motif of MOTIFS) {
    if (motif.match.test(blob)) return motif.label;
  }
  const words = blob
    .replace(/[^a-zA-Z0-9' ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w.toLowerCase()));
  if (words.length === 0) return blob.slice(0, 22);
  if (words.length === 1) return words[0];
  const two = `${words[0]} ${words[1]}`;
  if (two.length <= 22 && words[2] && two.length + words[2].length < 20) {
    return `${two} ${words[2]}`;
  }
  return two.length > 26 ? words[0] : two;
}

function personSentiment(
  texts: string[],
  byText: Map<string, { label: FmaSentiment; score: number }>,
): FmaSentiment {
  const counts: Record<FmaSentiment, number> = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };
  const scores: Record<FmaSentiment, number> = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };
  let matched = 0;
  for (const text of texts) {
    const hit = byText.get(text.trim()) ?? byText.get(normalizeText(text));
    if (!hit) continue;
    matched += 1;
    counts[hit.label] += 1;
    scores[hit.label] += hit.score;
  }
  if (matched === 0) return "neutral";
  const ranked: FmaSentiment[] = ["negative", "positive", "neutral"];
  ranked.sort((a, b) => counts[b] - counts[a] || scores[b] - scores[a]);
  return ranked[0];
}

/**
 * Posts as hubs. A "voice" is loud by comment likes (≥20) or by thread
 * gravity (3+ inbound @mentions). A community is everyone who @mentioned
 * that voice and is not themselves a voice.
 */
export function buildAimanFmaCommunityGraph(): FmaCommunityGraph {
  const comments = loadJson<RawComment[]>(
    "data/insta_raw/aiman/dataset_instagram-comment-scraper_2026-09-05_05-37-28-342.json",
  );
  const reels = loadJson<RawReel[]>(
    "data/insta_raw/aiman/dataset_instagram-reel-scraper_2026-09-05_06-09-02-703.json",
  );
  const sentiments = loadJson<RawSentiment[]>(
    "data/insta_raw/aiman/dataset_sentiment-analysis-online-tool_2026-09-05_05-42-01-996.json",
  );

  const sentimentByText = new Map<string, { label: FmaSentiment; score: number }>();
  for (const row of sentiments) {
    const label = asSentiment(row.finalClassification);
    const text = (row.inputText ?? "").trim();
    if (!label || !text) continue;
    const scored = { label, score: row.finalScore ?? 0 };
    sentimentByText.set(text, scored);
    sentimentByText.set(normalizeText(text), scored);
  }

  const reelByCode = new Map(
    reels.filter((r) => r.shortCode).map((r) => [r.shortCode as string, r]),
  );

  type Person = {
    username: string;
    likes: number;
    comments: number;
    posts: Set<string>;
    texts: string[];
    entries: FmaPersonComment[];
    pic?: string;
    commentedAt?: number;
  };

  const people = new Map<string, Person>();
  const mentionEdges: { from: string; to: string }[] = [];

  for (const row of comments) {
    const username = (row.ownerUsername ?? "").replace(/^@/, "").toLowerCase();
    if (!username) continue;
    const post = shortCode(row.postUrl);
    if (!post) continue;
    const person = people.get(username) ?? {
      username,
      likes: 0,
      comments: 0,
      posts: new Set<string>(),
      texts: [],
      entries: [],
      pic: row.ownerProfilePicUrl,
    };
    person.likes += row.likesCount ?? 0;
    person.comments += 1;
    person.posts.add(post);
    if (row.text) {
      person.texts.push(row.text);
      const hit =
        sentimentByText.get(row.text.trim()) ??
        sentimentByText.get(normalizeText(row.text));
      person.entries.push({
        text: row.text,
        likes: row.likesCount ?? 0,
        postId: post,
        postLabel: POST_META[post]?.label ?? post,
        sentiment: hit?.label ?? "neutral",
        timestamp: row.timestamp,
      });
      const at = row.timestamp ? Date.parse(row.timestamp) : NaN;
      if (!Number.isNaN(at)) {
        person.commentedAt =
          person.commentedAt == null ? at : Math.min(person.commentedAt, at);
      }
    }
    if (row.ownerProfilePicUrl) person.pic = row.ownerProfilePicUrl;
    people.set(username, person);
    for (const to of mentionsInText(row.text ?? "", username)) {
      mentionEdges.push({ from: username, to });
    }
  }

  const inbound = new Map<string, number>();
  for (const edge of mentionEdges) {
    inbound.set(edge.to, (inbound.get(edge.to) ?? 0) + 1);
  }

  const voiceIds = new Set<string>();
  const voiceWhy = new Map<string, FmaVoiceWhy>();
  for (const person of people.values()) {
    const mentioned = inbound.get(person.username) ?? 0;
    if (person.likes >= 20) {
      voiceIds.add(person.username);
      voiceWhy.set(person.username, "likes");
    } else if (mentioned >= 3) {
      voiceIds.add(person.username);
      voiceWhy.set(person.username, "thread");
    }
  }
  voiceIds.delete(CREATOR);

  const voiceRank = [...voiceIds].sort((a, b) => {
    const pa = people.get(a);
    const pb = people.get(b);
    return (pb?.likes ?? 0) - (pa?.likes ?? 0);
  });

  const colorByVoice = new Map<string, string>();
  voiceRank.forEach((id, i) => {
    colorByVoice.set(id, VOICE_COLORS[i % VOICE_COLORS.length]);
  });

  const homePost = (username: string): string => {
    const posts = people.get(username)?.posts;
    if (!posts || posts.size === 0) return STONE;
    if (posts.has(STONE) && posts.has(TUCKER)) return STONE;
    return [...posts][0];
  };

  const assigned = new Map<string, string>();
  for (const edge of mentionEdges) {
    if (!voiceIds.has(edge.to)) continue;
    if (edge.from === CREATOR || voiceIds.has(edge.from)) continue;
    const current = assigned.get(edge.from);
    if (!current) {
      assigned.set(edge.from, edge.to);
      continue;
    }
    const currentLikes = people.get(current)?.likes ?? 0;
    const nextLikes = people.get(edge.to)?.likes ?? 0;
    if (nextLikes > currentLikes) assigned.set(edge.from, edge.to);
  }

  // Keep the small reel readable: every Tucker commenter stays on the map.
  for (const person of people.values()) {
    if (person.username === CREATOR) continue;
    if (voiceIds.has(person.username) || assigned.has(person.username)) continue;
    if (person.posts.has(TUCKER) && person.posts.size === 1) {
      assigned.set(person.username, `__post:${TUCKER}`);
    }
  }

  const nodes: FmaCommunityNode[] = [];
  const links: FmaCommunityLink[] = [];
  const seen = new Set<string>();

  const pushNode = (node: FmaCommunityNode) => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    nodes.push(node);
  };

  const creator = people.get(CREATOR);
  pushNode({
    id: CREATOR,
    label: "Aiman",
    kind: "creator",
    color: "#fccc63",
    likes: creator?.likes ?? 0,
    comments: creator?.comments ?? 0,
    mentionsIn: inbound.get(CREATOR) ?? 0,
    postIds: [STONE, TUCKER],
    quote: creator?.texts[0],
    commentsList: creator?.entries ?? [],
    sentiment: personSentiment(creator?.texts ?? [], sentimentByText),
    url: "https://www.instagram.com/nuancedaiman/",
  });

  for (const code of [STONE, TUCKER]) {
    const meta = POST_META[code];
    const reel = reelByCode.get(code);
    pushNode({
      id: `post:${code}`,
      label: meta.label,
      kind: "post",
      color: meta.color,
      likes: reel?.likesCount ?? 0,
      comments: reel?.commentsCount ?? 0,
      mentionsIn: 0,
      postIds: [code],
      plays: reel?.videoPlayCount ?? undefined,
      caption: reel?.caption,
      commentsList: [...people.values()]
        .flatMap((p) => p.entries)
        .filter((entry) => entry.postId === code)
        .sort((a, b) => b.likes - a.likes),
      imageUrl: reel?.displayUrl ? proxiedAvatarUrl(reel.displayUrl) : undefined,
      url: reel?.url ?? `https://www.instagram.com/p/${code}/`,
      postedAt: reel?.timestamp,
      dateLabel: formatFmaDate(reel?.timestamp),
    });
    links.push({
      source: CREATOR,
      target: `post:${code}`,
      kind: "authored",
      weight: 1.4,
    });
  }

  for (const id of voiceRank) {
    const person = people.get(id);
    if (!person) continue;
    const communityId = id;
    const postId = homePost(id);
    const phrase = commentPhrase(person.texts);
    pushNode({
      id,
      label: phrase,
      kind: "voice",
      color: colorByVoice.get(id) ?? "#94a3b8",
      likes: person.likes,
      comments: person.comments,
      mentionsIn: inbound.get(id) ?? 0,
      postIds: [...person.posts],
      communityId,
      communityLabel: phrase,
      voiceWhy: voiceWhy.get(id),
      quote: [...person.texts].sort((a, b) => b.length - a.length)[0],
      commentsList: [...person.entries].sort((a, b) => b.likes - a.likes),
      sentiment: personSentiment(person.texts, sentimentByText),
      url: `https://www.instagram.com/${person.username}/`,
      commentedAt: person.commentedAt,
    });
    links.push({
      source: id,
      target: `post:${postId}`,
      kind: "commented",
      weight: 1 + Math.log1p(person.likes),
    });
  }

  for (const [memberId, voiceId] of assigned) {
    const person = people.get(memberId);
    if (!person) continue;
    const postHub = voiceId.startsWith("__post:");
    const communityVoice = postHub ? undefined : voiceId;
    const color = communityVoice
      ? (colorByVoice.get(communityVoice) ?? "#64748b")
      : POST_META[TUCKER].color;
    const phrase = commentPhrase(person.texts);
    const voicePhrase = communityVoice
      ? commentPhrase(people.get(communityVoice)?.texts ?? [])
      : POST_META[TUCKER].label;
    pushNode({
      id: memberId,
      label: phrase,
      kind: "member",
      color,
      likes: person.likes,
      comments: person.comments,
      mentionsIn: inbound.get(memberId) ?? 0,
      postIds: [...person.posts],
      communityId: communityVoice ?? `post:${TUCKER}`,
      communityLabel: voicePhrase,
      quote: person.texts[0],
      commentsList: [...person.entries].sort((a, b) => b.likes - a.likes),
      sentiment: personSentiment(person.texts, sentimentByText),
      url: `https://www.instagram.com/${person.username}/`,
      commentedAt: person.commentedAt,
    });
    if (postHub) {
      links.push({
        source: memberId,
        target: `post:${TUCKER}`,
        kind: "commented",
        weight: 0.7,
      });
    } else {
      links.push({
        source: memberId,
        target: voiceId,
        kind: "community",
        weight: 1.1,
      });
    }
  }

  for (const edge of mentionEdges) {
    if (!voiceIds.has(edge.from) || !voiceIds.has(edge.to)) continue;
    if (edge.from === edge.to) continue;
    const exists = links.some(
      (l) =>
        l.kind === "mention" &&
        ((l.source === edge.from && l.target === edge.to) ||
          (l.source === edge.to && l.target === edge.from)),
    );
    if (exists) continue;
    links.push({
      source: edge.from,
      target: edge.to,
      kind: "mention",
      weight: 0.35,
    });
  }

  const communitySize = new Map<string, number>();
  for (const node of nodes) {
    if (node.kind !== "member" || !node.communityId) continue;
    if (!voiceIds.has(node.communityId)) continue;
    communitySize.set(
      node.communityId,
      (communitySize.get(node.communityId) ?? 0) + 1,
    );
  }

  return {
    nodes,
    links,
    posts: [STONE, TUCKER].map((code) => {
      const reel = reelByCode.get(code);
      return {
        id: `post:${code}`,
        label: POST_META[code].label,
        plays: reel?.videoPlayCount ?? 0,
        likes: reel?.likesCount ?? 0,
      };
    }),
    voices: voiceRank.map((id) => ({
      id,
      label: commentPhrase(people.get(id)?.texts ?? []),
      likes: people.get(id)?.likes ?? 0,
      communitySize: communitySize.get(id) ?? 0,
    })),
  };
}
