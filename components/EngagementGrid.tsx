"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Search } from "lucide-react";
import type { GraphNode, ProfilePost } from "@/lib/types";
import { compareByCloseness } from "@/lib/graphUtils";
import { REACTION_EMOJI, REACTION_TITLE } from "@/lib/reactions";

interface Props {
  posts: ProfilePost[];
  nodes: GraphNode[];
  selectedId?: string | null;
  onSelect: (node: GraphNode) => void;
  className?: string;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function personMatches(node: GraphNode, query: string): boolean {
  const needle = normalizeSearch(query.trim());
  if (!needle) return true;
  const haystack = normalizeSearch(
    [node.fullName, node.label, node.id].filter(Boolean).join(" "),
  );
  return needle.split(/\s+/).every((token) => haystack.includes(token));
}

function formatPostDate(postedAt?: string): string {
  if (!postedAt) return "";
  const ms = Date.parse(postedAt);
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function cellTooltip(
  post: ProfilePost,
  node: GraphNode,
): string {
  const engagement = node.postEngagement?.[post.id];
  if (!engagement) return `${post.label}\nNo engagement`;

  const parts = [post.label];
  if (engagement.reactionType) {
    const title =
      REACTION_TITLE[engagement.reactionType] ?? engagement.reactionType;
    parts.push(`Reacted: ${title}`);
  }
  if (engagement.commented) {
    const comment = (node.history ?? []).find(
      (c) => c.postId === post.id || c.post === post.label,
    );
    parts.push(
      comment?.text
        ? `Commented: “${comment.text.slice(0, 120)}${comment.text.length > 120 ? "…" : ""}”`
        : "Commented",
    );
  }
  return parts.join("\n");
}

export default function EngagementGrid({
  posts,
  nodes,
  selectedId,
  onSelect,
  className = "",
}: Props) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [personQuery, setPersonQuery] = useState("");

  const orderedPosts = useMemo(() => {
    return [...posts].sort((a, b) => {
      const ta = a.postedAt ? Date.parse(a.postedAt) : Number.NaN;
      const tb = b.postedAt ? Date.parse(b.postedAt) : Number.NaN;
      const aOk = Number.isFinite(ta);
      const bOk = Number.isFinite(tb);
      if (aOk && bOk && ta !== tb) return tb - ta; // newest left
      if (aOk !== bOk) return aOk ? -1 : 1;
      return 0;
    });
  }, [posts]);

  const members = useMemo(
    () =>
      [...nodes.filter((n) => n.group === "member")]
        .filter((n) => personMatches(n, personQuery))
        .sort(compareByCloseness),
    [nodes, personQuery],
  );

  const totalMembers = useMemo(
    () => nodes.filter((n) => n.group === "member").length,
    [nodes],
  );

  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-3 py-2 text-[11px] text-white/45">
        <span className="font-semibold uppercase tracking-wide text-white/35">
          Legend
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle className="h-3 w-3 text-white/70" /> Comment
        </span>
        <span className="inline-flex items-center gap-1">👍 Reaction</span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-flex items-center gap-0.5">
            👏
            <MessageCircle className="h-2.5 w-2.5 text-white/70" />
          </span>
          Both
        </span>
        <span className="text-white/30">
          Columns: latest post left → earliest right
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 min-w-[160px] border-b border-r border-white/10 bg-[#0c0b12] px-3 py-2 backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                  Person
                  <span className="ml-1 font-normal normal-case tracking-normal text-white/30">
                    ({personQuery.trim() ? `${members.length}/` : ""}
                    {totalMembers})
                  </span>
                </div>
                <label className="relative mt-1.5 block min-w-0">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-white/35" />
                  <input
                    value={personQuery}
                    onChange={(event) => setPersonQuery(event.target.value)}
                    placeholder="Filter..."
                    className="block w-full rounded-md border border-white/10 bg-black/40 py-1 pl-7 pr-2 text-[11px] font-normal normal-case tracking-normal text-white outline-none transition placeholder:text-white/35 focus:border-white/25 focus:bg-black/60"
                  />
                </label>
                {personQuery.trim() ? (
                  <div className="mt-1 text-[10px] font-normal normal-case tracking-normal text-white/35">
                    {members.length}/{totalMembers}
                    {members.length === 0 ? " — none" : ""}
                  </div>
                ) : null}
              </th>
              {orderedPosts.map((post, index) => (
                <th
                  key={post.id}
                  title={post.label}
                  className="sticky top-0 z-20 max-w-[80px] border-b border-white/10 bg-[#0c0b12]/95 px-1.5 py-2 text-center backdrop-blur"
                >
                  <div className="mx-auto flex w-[68px] flex-col items-center gap-1">
                    {post.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.imageUrl}
                        alt=""
                        className="h-10 w-10 rounded-md object-cover ring-1 ring-white/10"
                      />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white/5 text-[10px] text-white/25 ring-1 ring-white/10">
                        Post
                      </span>
                    )}
                    <span className="line-clamp-2 text-[9px] leading-tight text-white/55">
                      {post.label}
                    </span>
                    <span className="text-[9px] tabular-nums text-white/25">
                      {formatPostDate(post.postedAt) || `#${index + 1}`}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td
                  colSpan={orderedPosts.length + 1}
                  className="px-4 py-8 text-center text-xs text-white/40"
                >
                  No people match “{personQuery.trim()}”.
                </td>
              </tr>
            ) : (
              members.map((node) => {
              const isSelected = selectedId === node.id;
              return (
                <tr
                  key={node.id}
                  className={isSelected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-b border-r border-white/10 bg-[#0c0b12] px-0 backdrop-blur"
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(node)}
                      className={`flex w-full min-w-[160px] max-w-[200px] items-center gap-2 px-3 py-2 text-left text-xs transition ${
                        isSelected
                          ? "text-white"
                          : "text-white/75 hover:text-white"
                      }`}
                    >
                      {node.profilePicUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={node.profilePicUrl}
                          alt=""
                          className="h-6 w-6 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold">
                          {(node.fullName || node.label).charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="truncate font-medium">
                        {node.fullName || node.label}
                      </span>
                    </button>
                  </th>
                  {orderedPosts.map((post) => {
                    const engagement = node.postEngagement?.[post.id];
                    const key = `${node.id}:${post.id}`;
                    const reacted = Boolean(engagement?.reactionType);
                    const commented = Boolean(engagement?.commented);
                    const emoji = engagement?.reactionType
                      ? REACTION_EMOJI[engagement.reactionType] ?? "👍"
                      : null;

                    return (
                      <td
                        key={post.id}
                        className="border-b border-white/5 p-0 text-center"
                      >
                        <button
                          type="button"
                          title={cellTooltip(post, node)}
                          onClick={() => onSelect(node)}
                          onMouseEnter={() => setHoverKey(key)}
                          onMouseLeave={() => setHoverKey(null)}
                          className={`flex h-10 w-full min-w-[56px] items-center justify-center gap-0.5 transition ${
                            hoverKey === key ? "bg-white/10" : ""
                          } ${
                            reacted || commented
                              ? "text-white"
                              : "text-white/10 hover:text-white/25"
                          }`}
                        >
                          {reacted || commented ? (
                            <>
                              {emoji ? (
                                <span className="text-sm leading-none" aria-hidden>
                                  {emoji}
                                </span>
                              ) : null}
                              {commented ? (
                                <MessageCircle
                                  className={`h-3 w-3 ${
                                    reacted ? "text-white/70" : "text-white/85"
                                  }`}
                                />
                              ) : null}
                            </>
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-white/10" />
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
