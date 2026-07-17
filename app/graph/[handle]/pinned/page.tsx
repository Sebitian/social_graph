import type { Metadata } from "next";
import GraphResult from "@/components/GraphResult";
import { readSnapshot, readSpotifySnapshot } from "@/lib/snapshot";

interface PageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const clean = decodeURIComponent(handle).replace(/^@/, "");
  return {
    title: `@${clean}'s network (saved) - Netgraph`,
    description: `Pinned snapshot of @${clean}'s interaction graph — no live scrape.`,
  };
}

/** Extra platform demos loaded alongside the primary pinned handle. */
const COMPANION_SNAPSHOTS = {
  instagram: "jppap",
  spotify: "sebastian-spotify",
} as const;

export default async function PinnedGraphPage({ params }: PageProps) {
  const { handle } = await params;
  const clean = decodeURIComponent(handle).replace(/^@/, "").toLowerCase();
  const snapshot = await readSnapshot(clean);
  const instagram =
    clean === COMPANION_SNAPSHOTS.instagram
      ? snapshot
      : await readSnapshot(COMPANION_SNAPSHOTS.instagram);
  const spotifyData = await readSpotifySnapshot(COMPANION_SNAPSHOTS.spotify);

  const initialPlatformData = {
    ...(snapshot?.posts?.length
      ? { linkedin: snapshot }
      : snapshot
        ? { instagram: snapshot }
        : {}),
    ...(instagram && !instagram.posts?.length ? { instagram } : {}),
  };

  return (
    <GraphResult
      key={`pinned-${clean}`}
      handle={clean}
      pinned
      initialData={snapshot}
      initialPlatformData={initialPlatformData}
      spotifyData={spotifyData}
    />
  );
}
