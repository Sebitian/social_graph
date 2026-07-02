import type { Metadata } from "next";
import GraphResult from "@/components/GraphResult";

interface PageProps {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const clean = decodeURIComponent(handle).replace(/^@/, "");
  return {
    title: `@${clean}'s Instagram network - Netgraph`,
    description: `Explore @${clean}'s visible public interaction patterns as a force-directed graph.`,
    openGraph: {
      title: `@${clean}'s Instagram network`,
      description: `See @${clean}'s visible interaction patterns visualized as a graph.`,
    },
  };
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function GraphPage({ params, searchParams }: PageProps) {
  const { handle } = await params;
  const query = await searchParams;
  const clean = decodeURIComponent(handle).replace(/^@/, "").toLowerCase();
  // key remounts on handle change so loading state resets cleanly.
  return (
    <GraphResult
      key={clean}
      handle={clean}
      initialBudget={{
        postLimit: Number(first(query.posts) ?? first(query.postLimit)),
        commentsPerPost: Number(first(query.comments) ?? first(query.commentsPerPost)),
        reciprocityEnabled: (() => {
          const v = first(query.reciprocity);
          if (v === "0" || v === "false") return false;
          if (v === "1" || v === "true") return true;
          return undefined;
        })(),
        reciprocityFriends: Number(first(query.reciprocityFriends)),
        reciprocityPostsPerFriend: Number(
          first(query.reciprocityPosts) ?? first(query.reciprocityPostsPerFriend),
        ),
      }}
    />
  );
}
