import { settleAccountJob } from "@/lib/jobViewPage";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ label: string; id: string }>;
}

export default async function AccountProfilePage({ params }: PageProps) {
  const { label, id } = await params;
  await settleAccountJob(label, id, "profile");
  return null;
}
