import { settleConferenceJob } from "@/lib/jobViewPage";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string; run: string }>;
}

/** `id` is the event name. Next requires this segment to share a name with /jobs/[label]/[id]. */
export default async function ConferenceJobPage({ params }: PageProps) {
  const { id: name, run } = await params;
  await settleConferenceJob(name, run, "map");
  return null;
}
