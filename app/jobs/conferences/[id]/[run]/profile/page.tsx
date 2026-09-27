import { settleConferenceJob } from "@/lib/jobViewPage";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string; run: string }>;
}

export default async function ConferenceProfilePage({ params }: PageProps) {
  const { id: name, run } = await params;
  await settleConferenceJob(name, run, "profile");
  return null;
}
