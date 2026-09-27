import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadPinnedGraph } from "@/lib/loadPinnedDemo";
import { pinnedGraphPath } from "@/lib/paths";

interface PageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const clean = decodeURIComponent(handle).replace(/^@/, "");
  return {
    title: `@${clean}'s network (saved) - Starling`,
    description: `Pinned snapshot of @${clean}'s interaction graph — no live scrape.`,
  };
}

export default async function PinnedGraphPage({ params }: PageProps) {
  const { handle } = await params;
  const clean = decodeURIComponent(handle).replace(/^@/, "").toLowerCase();

  const destination = pinnedGraphPath(clean);
  if (destination !== `/graph/${clean}/pinned`) {
    redirect(destination);
  }

  return loadPinnedGraph(clean);
}
