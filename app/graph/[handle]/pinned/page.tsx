import type { Metadata } from "next";
import GraphResult from "@/components/GraphResult";

interface PageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const clean = decodeURIComponent(handle).replace(/^@/, "");
  return {
    title: `@${clean}'s network (saved) - Netgraph`,
    description: `Pinned snapshot of @${clean}'s interaction graph — no live scrape.`,
  };
}

export default async function PinnedGraphPage({ params }: PageProps) {
  const { handle } = await params;
  const clean = decodeURIComponent(handle).replace(/^@/, "").toLowerCase();
  return <GraphResult key={`pinned-${clean}`} handle={clean} pinned />;
}
