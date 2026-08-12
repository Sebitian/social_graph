import Link from "next/link";
import {
  BarChart3,
  Building2,
  Github,
  Hash,
  LayoutGrid,
  MapPin,
  MessageSquareText,
  Music2,
  Network,
  Share2,
  Users,
} from "lucide-react";
import HeroInput from "@/components/HeroInput";
import HomeAnalyticsPreview from "@/components/HomeAnalyticsPreview";
import GraphVisualizer from "@/components/GraphVisualizer";
import { buildGraph } from "@/lib/graphUtils";
import { buildMockProfile, buildMockCommentators } from "@/lib/mock";
import type { Commentator, ProfileData } from "@/lib/types";

/** Compact home showcase — fewer nodes, real portrait photos. */
const HOME_GRAPH_NODES = 14;

function demoPortraitUrl(seed: string, index: number): string {
  // Stable Random User portraits (proxied via /api/avatar/image for canvas).
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const gender = (hash + index) % 2 === 0 ? "women" : "men";
  const n = (hash + index * 17) % 99;
  return `https://randomuser.me/api/portraits/${gender}/${n}.jpg`;
}

function withDemoPortraits(
  profile: ProfileData,
  commentators: Commentator[],
): { profile: ProfileData; commentators: Commentator[] } {
  return {
    profile: {
      ...profile,
      profilePicUrl: demoPortraitUrl(profile.username, 0),
    },
    commentators: commentators.map((c, i) => ({
      ...c,
      profilePicUrl: demoPortraitUrl(c.username, i + 1),
    })),
  };
}

const demoHandle = "wanderlust";
const { profile: demoProfile, commentators: demoCommentators } = withDemoPortraits(
  buildMockProfile(demoHandle),
  buildMockCommentators(demoHandle, HOME_GRAPH_NODES, {
    reciprocityFriends: HOME_GRAPH_NODES,
    reciprocityPostsPerFriend: 3,
  }),
);
const demoGraph = buildGraph(demoProfile, demoCommentators);

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
    icon: Building2,
    title: "Employee analytics",
    body: "For company networks: rank employees by reach, map locations and schools, and read tenure timelines without leaving the graph.",
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
    icon: MapPin,
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
      {/* Hero — no graph behind copy */}
      <section className="relative z-10 mx-auto flex min-h-[100dvh] max-w-6xl flex-col justify-center px-4 pb-16 pt-safe sm:px-6 lg:pb-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(20rem,26rem)] lg:gap-14">
          <div className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left">
            <p className="text-sm font-semibold tracking-[0.18em] text-white/45 uppercase">
              Netgraph
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Map the networks around your public presence
            </h1>
            <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/55 sm:text-lg lg:mx-0">
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

      {/* Features */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-white/40 uppercase">
          Features
        </h2>
        <ul className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
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
      </section>

      {/* Graph showcase — between features and analytics */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
        <div className="relative h-[min(68vh,480px)] overflow-hidden rounded-2xl border border-white/10 bg-black/30">
          <GraphVisualizer
            data={demoGraph}
            className="h-full w-full"
            interactive={false}
          />
        </div>
      </section>

      {/* Analytics */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-[max(5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-28">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-white/40 uppercase">
          Analytics
        </h2>
        <ul className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
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

        <div className="mt-10 sm:mt-12">
          <HomeAnalyticsPreview />
        </div>

        <footer className="mt-20 flex items-center justify-center gap-2 text-sm text-white/30">
          <Github className="h-4 w-4" />
          Built with Next.js · Apify · react-force-graph
        </footer>
      </section>
    </main>
  );
}
