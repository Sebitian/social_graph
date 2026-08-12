import GraphResult from "@/components/GraphResult";
import {
  readSnapshot,
  readSpotifySnapshot,
  readCompanySnapshot,
  readTikTokSnapshot,
} from "@/lib/snapshot";
import { DEMO_HANDLE } from "@/lib/paths";
import type { ScrapeResult, SocialSourcePlatform } from "@/lib/types";

/** Extra platform demos loaded alongside the primary pinned handle. */
export const COMPANION_SNAPSHOTS = {
  instagram: "jppap",
  spotify: "sebastian-spotify",
  company: "formationbio",
  facebook: "kossof-facebook",
  tiktok: "kossof-tiktok",
} as const;

function socialPlatformOf(result: ScrapeResult): SocialSourcePlatform {
  if (result.platform) return result.platform;
  return result.posts?.length ? "linkedin" : "instagram";
}

/** Load primary + companion snapshots and render the pinned GraphResult. */
export async function loadPinnedGraph(handle: string) {
  const clean = handle.replace(/^@/, "").trim().toLowerCase();
  const snapshot = await readSnapshot(clean);
  const instagram =
    clean === COMPANION_SNAPSHOTS.instagram
      ? snapshot
      : await readSnapshot(COMPANION_SNAPSHOTS.instagram);
  const facebook =
    clean === COMPANION_SNAPSHOTS.facebook
      ? snapshot?.platform === "facebook"
        ? snapshot
        : null
      : await readSnapshot(COMPANION_SNAPSHOTS.facebook);
  const spotifyData = await readSpotifySnapshot(COMPANION_SNAPSHOTS.spotify);
  const companyData = await readCompanySnapshot(COMPANION_SNAPSHOTS.company);
  const tiktokData = await readTikTokSnapshot(COMPANION_SNAPSHOTS.tiktok);

  const initialPlatformData: Partial<
    Record<SocialSourcePlatform, ScrapeResult>
  > = {
    ...(snapshot ? { [socialPlatformOf(snapshot)]: snapshot } : {}),
    ...(instagram && socialPlatformOf(instagram) === "instagram"
      ? { instagram }
      : {}),
    ...(facebook && socialPlatformOf(facebook) === "facebook"
      ? { facebook }
      : {}),
  };

  return (
    <GraphResult
      key={`pinned-${clean}`}
      handle={clean}
      pinned
      initialData={snapshot}
      initialPlatformData={initialPlatformData}
      spotifyData={spotifyData}
      companyData={companyData}
      tiktokData={tiktokData}
    />
  );
}

export async function loadDemoGraph() {
  return loadPinnedGraph(DEMO_HANDLE);
}
