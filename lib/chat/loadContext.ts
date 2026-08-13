import { getCached } from "@/lib/cache";
import type { CompanyResult } from "@/lib/companyTypes";
import { COMPANION_SNAPSHOTS } from "@/lib/paths";
import { DEFAULT_SCRAPE_BUDGET, type ScrapeBudget } from "@/lib/scrapeBudget";
import { readCompanySnapshot, readSnapshot } from "@/lib/snapshot";
import type { ScrapeResult, SocialSourcePlatform } from "@/lib/types";
import type {
  ChatSocialPlatform,
  ChatSourceInfo,
} from "./types";

export type ChatBundle = {
  social: Partial<Record<ChatSocialPlatform, ScrapeResult>>;
  company: CompanyResult | null;
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
 * Instagram/Facebook companions, and the LinkedIn company roster.
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
    bundle: { social, company, sources },
  };
}
