import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadJob } from "@/lib/loadJob";
import { readJobTitle } from "@/lib/jobs";

export const dynamic = "force-dynamic";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string; run: string }>;
}

export async function generateMetadata({
  params,
}: LayoutProps): Promise<Metadata> {
  const { run } = await params;
  const title = await readJobTitle(run);
  if (!title) return { title: "Run not found - Starling" };
  return {
    title: `${title} - Starling`,
    description: `Conference graph for ${title}.`,
    referrer: "no-referrer",
  };
}

/** `id` is the event name. Next requires this segment to share a name with /jobs/[label]/[id]. */
export default async function ConferenceJobLayout({
  children,
  params,
}: LayoutProps) {
  const { run } = await params;
  const view = await loadJob(run);
  if (!view) notFound();
  return (
    <>
      {view}
      {children}
    </>
  );
}
