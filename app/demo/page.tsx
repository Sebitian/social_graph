import type { Metadata } from "next";
import { loadDemoGraph } from "@/lib/loadPinnedDemo";
import { DEMO_HANDLE } from "@/lib/paths";

export const metadata: Metadata = {
  title: `@${DEMO_HANDLE}'s network (demo) - Netgraph`,
  description: `Demo snapshot of @${DEMO_HANDLE}'s multi-platform interaction graph — no live scrape.`,
};

export default async function DemoPage() {
  return loadDemoGraph();
}
