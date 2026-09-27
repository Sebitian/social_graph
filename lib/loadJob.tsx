import FmaCommunityView from "@/components/FmaCommunityView";
import GraphResult from "@/components/GraphResult";
import { buildAimanFmaCommunityGraph } from "@/lib/aimanFmaCommunityGraph";
import { DEMO_HANDLE } from "@/lib/paths";
import { loadPinnedGraph } from "@/lib/loadPinnedDemo";
import { resolveJob } from "@/lib/jobs";

/** Render one run. Missing ids return null so the page can 404. */
export async function loadJob(id: string) {
  const job = await resolveJob(id);
  if (!job) return null;

  if (job.kind === "bundle") {
    return loadPinnedGraph(DEMO_HANDLE);
  }

  if (job.kind === "aiman") {
    return <FmaCommunityView data={buildAimanFmaCommunityGraph()} />;
  }

  return (
    <GraphResult
      key={`job-${id}`}
      handle={job.handle}
      pinned
      isolated
      initialData={job.initialData}
      initialPlatformData={job.initialPlatformData}
      spotifyData={job.spotifyData}
      companyData={job.companyData}
      tiktokData={job.tiktokData}
      instagramPeopleData={job.instagramPeopleData}
      conferenceData={job.conferenceData}
    />
  );
}
