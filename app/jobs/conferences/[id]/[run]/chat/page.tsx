import { settleConferenceJob } from "@/lib/jobViewPage";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string; run: string }>;
}

export default async function ConferenceChatPage({ params }: PageProps) {
  const { id: name, run } = await params;
  await settleConferenceJob(name, run, "chat");
  return null;
}
