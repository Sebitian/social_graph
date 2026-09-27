import { settleConferenceJob } from "@/lib/jobViewPage";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string; run: string }>;
}

export default async function ConferenceAnalyticsPage({ params }: PageProps) {
  const { id: name, run } = await params;
  await settleConferenceJob(name, run, "analytics");
  return null;
}
