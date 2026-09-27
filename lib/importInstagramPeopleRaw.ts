import {
  buildScrapeResultFromInstagramRaw,
  type RawInstagramPost,
  type RawInstagramProfile,
  type RawInstagramReel,
} from "./importInstagramRaw";
import type {
  InstagramPeopleResult,
  InstagramPersonOption,
  InstagramPersonRole,
} from "./instagramPeople";

const EMPLOYEE_ORDER: Array<{
  username: string;
  title: string;
  role?: InstagramPersonRole;
}> = [
  { username: "joanna_artistry", title: "Beauty Artist" },
  { username: "jennymastercolorist", title: "Master Colorist" },
  { username: "beauty.by.brentley", title: "Long Hair Specialist" },
  { username: "hairdesigner33", title: "Master Stylist" },
];

function cleanHandle(value?: string): string {
  return (value ?? "").replace(/^@/, "").trim().toLowerCase();
}

function titleFromProfile(profile: RawInstagramProfile, fallback: string): string {
  const category = profile.businessCategoryName?.trim();
  if (category) return category;
  const bioLine = (profile.biography ?? "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("@") && !line.startsWith("http"));
  if (bioLine) return bioLine.slice(0, 48);
  return fallback;
}

function mergePosts(
  posts: RawInstagramPost[],
  latestPosts: RawInstagramPost[] | undefined,
): RawInstagramPost[] {
  const byId = new Map<string, RawInstagramPost>();
  for (const post of posts) {
    if (!post.id) continue;
    byId.set(post.id, post);
  }
  for (const extra of latestPosts ?? []) {
    if (!extra.id) continue;
    const existing = byId.get(extra.id);
    if (!existing) {
      byId.set(extra.id, extra);
      continue;
    }
    byId.set(extra.id, {
      ...existing,
      ...extra,
      caption: extra.caption || existing.caption,
      displayUrl: extra.displayUrl || existing.displayUrl,
      mentions: extra.mentions?.length ? extra.mentions : existing.mentions,
      taggedUsers: extra.taggedUsers?.length
        ? extra.taggedUsers
        : existing.taggedUsers,
      coauthorProducers: extra.coauthorProducers?.length
        ? extra.coauthorProducers
        : existing.coauthorProducers,
      locationName: extra.locationName || existing.locationName,
    });
  }
  return [...byId.values()];
}

export function buildInstagramPeopleResult(args: {
  companyHandle: string;
  profiles: RawInstagramProfile[];
  posts: RawInstagramPost[];
  reels?: RawInstagramReel[];
}): InstagramPeopleResult {
  const companyHandle = cleanHandle(args.companyHandle) || "kossof_salonspa";
  const profilesByUser = new Map<string, RawInstagramProfile>();
  for (const profile of args.profiles) {
    const username = cleanHandle(profile.username);
    if (username) profilesByUser.set(username, profile);
  }

  const postsByOwner = new Map<string, RawInstagramPost[]>();
  for (const post of args.posts) {
    if (!post.id) continue;
    const owner = cleanHandle(post.ownerUsername);
    if (!owner) continue;
    const list = postsByOwner.get(owner) ?? [];
    list.push(post);
    postsByOwner.set(owner, list);
  }

  const reelsByOwner = new Map<string, RawInstagramReel[]>();
  for (const reel of args.reels ?? []) {
    if (!reel.id) continue;
    const owner = cleanHandle(reel.ownerUsername);
    if (!owner) continue;
    const list = reelsByOwner.get(owner) ?? [];
    list.push(reel);
    reelsByOwner.set(owner, list);
  }

  const roster = [...EMPLOYEE_ORDER];
  for (const username of profilesByUser.keys()) {
    if (username === companyHandle) continue;
    if (roster.some((row) => row.username === username)) continue;
    roster.push({ username, title: "Stylist" });
  }

  const people: InstagramPersonOption[] = roster.map((row) => {
    const profile = profilesByUser.get(row.username);
    const posts = mergePosts(
      postsByOwner.get(row.username) ?? [],
      profile?.latestPosts,
    );
    const reels = reelsByOwner.get(row.username) ?? [];
    const privateAccount = Boolean(profile?.private);
    const available = (posts.length > 0 || reels.length > 0) && !privateAccount;

    let result = null;
    if (available) {
      result = buildScrapeResultFromInstagramRaw(row.username, {
        profile: profile ?? null,
        posts,
        reels,
      });
    }

    return {
      id: row.username,
      username: profile?.username || row.username,
      fullName: profile?.fullName || row.username,
      title:
        row.role === "person"
          ? row.title
          : profile
            ? titleFromProfile(profile, row.title)
            : row.title,
      role: row.role ?? "employee",
      profilePicUrl: profile?.profilePicUrlHD || profile?.profilePicUrl,
      followersCount: profile?.followersCount,
      available,
      unavailableReason: available
        ? undefined
        : privateAccount
          ? "Private account — no posts available"
          : "No Instagram posts in this snapshot",
      result,
    };
  });

  return {
    kind: "instagram-people",
    scrapedAt: Date.now(),
    companyHandle,
    people,
  };
}
