import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadJob } from "@/lib/loadJob";
import { readJobTitle } from "@/lib/jobs";

export const dynamic = "force-dynamic";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ label: string; id: string }>;
}

export async function generateMetadata({
  params,
}: LayoutProps): Promise<Metadata> {
  const { id } = await params;
  const title = await readJobTitle(id);
  if (!title) return { title: "Run not found - Starling" };
  return {
    title: `${title} - Starling`,
    description: `Graph, comments, reactions, and likes for ${title}.`,
    referrer: "no-referrer",
  };
}

export default async function AccountJobLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const view = await loadJob(id);
  if (!view) notFound();
  return (
    <>
      {view}
      {children}
    </>
  );
}
