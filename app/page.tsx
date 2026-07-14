import Link from "next/link";
import { Github, Network, Sparkles, Zap } from "lucide-react";
import HeroInput from "@/components/HeroInput";
import GraphVisualizer from "@/components/GraphVisualizer";
import { buildGraph, MAX_NODES } from "@/lib/graphUtils";
import { buildMockProfile, buildMockCommentators } from "@/lib/mock";

// Pre-build a demo network to render behind the hero.
const demoHandle = "wanderlust";
const demoProfile = buildMockProfile(demoHandle);
const demoGraph = buildGraph(
  demoProfile,
  buildMockCommentators(demoHandle, MAX_NODES, {
    reciprocityFriends: MAX_NODES,
    reciprocityPostsPerFriend: 4,
  }),
);

const features = [
  {
    icon: Network,
    title: "Your visible circle",
    body: "Distance from you reflects how present someone is. Pods show people who actually show up together.",
  },
  {
    icon: Zap,
    title: "Recency-weighted",
    body: "Recent comments matter most. Pair affinity detects travel crews, work circles, and paired connections.",
  },
  {
    icon: Sparkles,
    title: "Built to share",
    body: "Every graph gets its own link and auto-generated share card. Post it, send it, go viral.",
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background bg-grid">
      {/* Demo graph backdrop */}
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <GraphVisualizer data={demoGraph} className="h-full w-full" interactive={false} />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />

      {/* Hero */}
      <section className="relative z-10 mx-auto flex min-h-[100dvh] max-w-5xl flex-col items-center justify-center px-4 pb-safe pt-safe text-center sm:px-6">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/60 backdrop-blur sm:mb-6 sm:px-4 sm:text-xs">
          <span className="h-2 w-2 animate-pulse rounded-full bg-ig-pink" />
          Search yourself · map visible public interaction
        </div>

        <h1 className="max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl sm:leading-tight lg:text-7xl">
          What communities show up around your{" "}
          <span className="text-ig-gradient animate-gradient-pan">circle</span>?
        </h1>
        <p className="mt-4 max-w-xl text-base leading-snug text-white/60 sm:mt-6 sm:text-lg sm:leading-relaxed">
          Search your handle. We rank the people who comment on your posts the
          most, group them into visible clusters, and explain the patterns with
          private, editable receipts.
        </p>

        <div className="mt-8 flex w-full flex-col items-center sm:mt-10">
          <HeroInput />
          <p className="mt-3 text-xs text-white/30">
            Try{" "}
            <Link href="/graph/wanderlust" className="underline hover:text-white/60">
              @wanderlust
            </Link>{" "}
            ·{" "}
            <Link href="/graph/nasa" className="underline hover:text-white/60">
              @nasa
            </Link>
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 pb-[max(5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-28">
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur sm:p-6"
              >
                <div className="mb-3 inline-flex rounded-xl bg-ig-gradient p-2.5 sm:mb-4">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-base font-semibold text-white sm:text-lg">{f.title}</h3>
                <p className="mt-2 text-sm text-white/50">{f.body}</p>
              </div>
            );
          })}
        </div>

        <footer className="mt-16 flex items-center justify-center gap-2 text-sm text-white/30">
          <Github className="h-4 w-4" />
          Built with Next.js · Apify · react-force-graph
        </footer>
      </section>
    </main>
  );
}
