import { getCached } from "@/lib/cache";
import type { CompanyResult } from "@/lib/companyTypes";
import { COMPANION_SNAPSHOTS } from "@/lib/paths";
import { DEFAULT_SCRAPE_BUDGET, type ScrapeBudget } from "@/lib/scrapeBudget";
import {
  readCompanySnapshot,
  readSnapshot,
  readTikTokSnapshot,
} from "@/lib/snapshot";
import type { TikTokResult } from "@/lib/tiktokTypes";
import type { ScrapeResult, SocialSourcePlatform } from "@/lib/types";
import {
  isChatSourceId,
  type ChatSocialPlatform,
  type ChatSourceId,
  type ChatSourceInfo,
} from "./types";

export type ChatBundle = {
  social: Partial<Record<ChatSocialPlatform, ScrapeResult>>;
  company: CompanyResult | null;
  tiktok: TikTokResult | null;
  sources: ChatSourceInfo[];
};

export type ChatContextOk = {
  ok: true;
  bundle: ChatBundle;
};

export type ChatContextErr = {
  ok: false;
  error: string;
  status: number;
};

function cleanHandle(handle: string): string {
  return handle.replace(/^@/, "").trim().toLowerCase();
}

function platformOf(result: ScrapeResult): SocialSourcePlatform {
  if (result.platform) return result.platform;
  return result.posts?.length ? "linkedin" : "instagram";
}

function socialSource(
  id: ChatSocialPlatform,
  data: ScrapeResult,
  snapshotHandle: string,
): ChatSourceInfo {
  const label =
    id === "linkedin" ? "LinkedIn" : id === "instagram" ? "Instagram" : "Facebook";
  const kind = id === "linkedin" ? "Person graph" : "Account graph";
  return {
    id,
    label,
    title: data.profile.fullName || data.profile.username,
    handle: snapshotHandle,
    subtitle: `@${data.profile.username} · ${kind}`,
  };
}

function companySource(data: CompanyResult, snapshotHandle: string): ChatSourceInfo {
  return {
    id: "company",
    label: "Company",
    title: data.company.name,
    handle: snapshotHandle,
    subtitle: `${data.stats.employeeCount} employees in graph`,
  };
}

function tiktokSource(data: TikTokResult, snapshotHandle: string): ChatSourceInfo {
  return {
    id: "tiktok",
    label: "TikTok",
    title: data.profile.displayName || data.profile.username,
    handle: snapshotHandle,
    subtitle: `@${data.profile.username} · Videos & hashtags`,
  };
}

function addSocial(
  social: ChatBundle["social"],
  sources: ChatSourceInfo[],
  data: ScrapeResult | null,
  snapshotHandle: string,
) {
  if (!data) return;
  const id = platformOf(data);
  if (id !== "linkedin" && id !== "instagram" && id !== "facebook") return;
  if (social[id]) return;
  social[id] = data;
  sources.push(socialSource(id, data, snapshotHandle));
}

/**
 * Load every Chat-capable snapshot for this graph: LinkedIn person,
 * Instagram/Facebook companions, LinkedIn company roster, and TikTok.
 */
export async function loadChatContext(input: {
  handle: string;
  pinned: boolean;
  budget?: Partial<ScrapeBudget>;
}): Promise<ChatContextOk | ChatContextErr> {
  const handle = cleanHandle(input.handle);
  if (!handle) {
    return { ok: false, error: "Missing handle.", status: 400 };
  }

  const social: ChatBundle["social"] = {};
  const sources: ChatSourceInfo[] = [];

  if (input.pinned) {
    addSocial(social, sources, await readSnapshot(handle), handle);
    for (const platform of ["instagram", "facebook"] as const) {
      const companionHandle = COMPANION_SNAPSHOTS[platform];
      if (companionHandle === handle) continue;
      addSocial(
        social,
        sources,
        await readSnapshot(companionHandle),
        companionHandle,
      );
    }
  } else {
    addSocial(
      social,
      sources,
      await getCached(handle, input.budget ?? DEFAULT_SCRAPE_BUDGET),
      handle,
    );
  }

  const companyHandle = COMPANION_SNAPSHOTS.company;
  const company = await readCompanySnapshot(companyHandle);

  if (company) {
    sources.push(companySource(company, companyHandle));
  }

  const tiktokHandle = COMPANION_SNAPSHOTS.tiktok;
  const tiktok =
    (await readTikTokSnapshot(handle)) ??
    (input.pinned ? await readTikTokSnapshot(tiktokHandle) : null);

  if (tiktok) {
    sources.push(
      tiktokSource(
        tiktok,
        tiktok.profile.username || tiktokHandle,
      ),
    );
  }

  if (sources.length === 0) {
    return {
      ok: false,
      error:
        "Chat needs a pinned snapshot (or a cached scrape). Open /demo or a pinned graph.",
      status: 404,
    };
  }

  return {
    ok: true,
    bundle: { social, company, tiktok, sources },
  };
}

export function parseEnabledSourceIds(
  value: unknown,
  available: ChatSourceInfo[],
): ChatSourceId[] {
  const allow = new Set(available.map((source) => source.id));
  const fallback = available.map((source) => source.id);
  if (!Array.isArray(value)) return fallback;
  const picked = value.filter(
    (id): id is ChatSourceId => isChatSourceId(id) && allow.has(id),
  );
  return picked.length > 0 ? picked : fallback;
}

export function restrictChatBundle(
  bundle: ChatBundle,
  enabled: ChatSourceId[],
): ChatBundle {
  const allow = new Set(enabled);
  const social: ChatBundle["social"] = {};
  if (allow.has("linkedin") && bundle.social.linkedin) {
    social.linkedin = bundle.social.linkedin;
  }
  if (allow.has("instagram") && bundle.social.instagram) {
    social.instagram = bundle.social.instagram;
  }
  if (allow.has("facebook") && bundle.social.facebook) {
    social.facebook = bundle.social.facebook;
  }
  return {
    social,
    company: allow.has("company") ? bundle.company : null,
    tiktok: allow.has("tiktok") ? bundle.tiktok : null,
    sources: bundle.sources.filter((source) => allow.has(source.id)),
  };
}
