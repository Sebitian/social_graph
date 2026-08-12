import Link from "next/link";
import {
  BarChart3,
  Building2,
  Github,
  Hash,
  LayoutGrid,
  MessageSquareText,
  Music2,
  Network,
  Share2,
  Users,
} from "lucide-react";
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
    title: "Multi-platform graphs",
    body: "Map LinkedIn, Instagram, Facebook, TikTok, and Spotify from one place — you at the center, clusters by shared activity.",
  },
  {
    icon: MessageSquareText,
    title: "Engagement receipts",
    body: "Open anyone to see comments, reactions, and how often they show up on your posts — explainable, not a black box.",
  },
  {
    icon: LayoutGrid,
    title: "Platform-native maps",
    body: "TikTok videos and hashtags, Spotify genres and playlists, LinkedIn person or company roster — each platform keeps its shape.",
  },
  {
    icon: Share2,
    title: "Built to share",
    body: "Every graph gets its own link and share card so you can send a readable network snapshot, not a screenshot dump.",
  },
];

const analytics = [
  {
    icon: BarChart3,
    title: "Time-ranged KPIs",
    body: "Comments, reactions and likes, engagers, and posts or videos — filter by day, week, month, or all time.",
  },
  {
    icon: Users,
    title: "Top engagers & reaction mix",
    body: "Rank who shows up most and break down reaction types where the platform exposes them.",
  },
  {
    icon: Building2,
    title: "Company roster intel",
    body: "Locations, schools, tenure, and follower rankings when you map a LinkedIn company network.",
  },
  {
    icon: Music2,
    title: "Spotify taste breakdown",
    body: "Tracks, artists, playlists, and genres pulled into a taste graph you can explore side by side with social.",
  },
  {
    icon: Hash,
    title: "TikTok performance",
    body: "Plays, likes, shares, and hashtag reach across your videos — tied back to the graph.",
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background bg-grid">
      {/* Demo graph backdrop */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <GraphVisualizer data={demoGraph} className="h-full w-full" interactive={false} />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/50 via-background/80 to-background" />

      {/* Hero */}
      <section className="relative z-10 mx-auto flex min-h-[100dvh] max-w-6xl flex-col justify-center px-4 pb-16 pt-safe sm:px-6 lg:pb-24">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(20rem,26rem)] lg:gap-14">
          <div className="max-w-xl text-center lg:text-left">
            <p className="text-sm font-semibold tracking-[0.18em] text-white/45 uppercase">
              Netgraph
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Map the networks around your public presence
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-white/55 sm:text-lg lg:mx-0 mx-auto">
              Add any handles you have. We chart visible interaction, audience,
              and taste across five platforms — with analytics you can explain.
            </p>
            <p className="mt-6 text-sm text-white/35">
              Prefer a walkthrough?{" "}
              <Link
                href="/demo"
                className="font-medium text-white/70 underline decoration-white/25 underline-offset-4 transition hover:text-white"
              >
                View the live demo
              </Link>
            </p>
          </div>

          <div className="mx-auto w-full lg:mx-0">
            <HeroInput />
            <p className="mt-3 text-center text-xs text-white/30 lg:text-left">
              Demo mode uses sample data until live scrapes are connected.
            </p>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-[max(5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-28">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-xs font-semibold tracking-[0.16em] text-white/40 uppercase">
              Features
            </h2>
            <ul className="mt-6 space-y-6">
              {features.map((f) => {
                const Icon = f.icon;
                return (
                  <li key={f.title} className="flex gap-4">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-white">{f.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-white/50">{f.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold tracking-[0.16em] text-white/40 uppercase">
              Analytics
            </h2>
            <ul className="mt-6 space-y-6">
              {analytics.map((a) => {
                const Icon = a.icon;
                return (
                  <li key={a.title} className="flex gap-4">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold text-white">{a.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-white/50">{a.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <footer className="mt-20 flex items-center justify-center gap-2 text-sm text-white/30">
          <Github className="h-4 w-4" />
          Built with Next.js · Apify · react-force-graph
        </footer>
      </section>
    </main>
  );
}
