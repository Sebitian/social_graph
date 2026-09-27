import { notFound, redirect } from "next/navigation";
import { canonicalJobPath } from "@/lib/jobs";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ label: string }>;
}

/** Old /jobs/{id} links. The readable path is /jobs/{name}-{platform}/{id}. */
export default async function LegacyJobPage({ params }: PageProps) {
  const { label } = await params;
  const canonical = await canonicalJobPath(label);
  if (!canonical) notFound();
  redirect(canonical);
}
