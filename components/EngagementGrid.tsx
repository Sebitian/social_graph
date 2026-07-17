"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, MessageCircle, Search } from "lucide-react";
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

type SortKey = "engagement" | "comments" | "reactions" | `reaction:${string}`;
type SortDir = "desc" | "asc";

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

function commentCount(node: GraphNode): number {
  return node.comments ?? node.history?.length ?? 0;
}

function reactionCount(node: GraphNode): number {
  return node.reactionsTotal ?? 0;
}

function reactionTypeCount(node: GraphNode, type: string): number {
  return node.reactionsByType?.[type] ?? 0;
}

function sortValue(node: GraphNode, key: SortKey): number {
  if (key === "engagement") return commentCount(node) * 3 + reactionCount(node);
  if (key === "comments") return commentCount(node);
  if (key === "reactions") return reactionCount(node);
  return reactionTypeCount(node, key.slice("reaction:".length));
}

function compareMembers(
  a: GraphNode,
  b: GraphNode,
  key: SortKey,
  dir: SortDir,
): number {
  if (key === "engagement" && dir === "desc") {
    return compareByCloseness(a, b);
  }
  const diff = sortValue(a, key) - sortValue(b, key);
  if (diff !== 0) return dir === "desc" ? -diff : diff;
  return compareByCloseness(a, b);
}

function cellTooltip(post: ProfilePost, node: GraphNode): string {
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

function SortChip({
  active,
  dir,
  label,
  title,
  onClick,
}: {
  active: boolean;
  dir: SortDir;
  label: ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-md border px-2 py-1.5 text-[11px] transition sm:px-1.5 sm:py-0.5 sm:text-[10px] ${
        active
          ? "border-white/30 bg-white/15 text-white"
          : "border-white/10 bg-transparent text-white/45 hover:border-white/20 hover:text-white/70"
      }`}
    >
      <span>{label}</span>
      {active ? (
        dir === "desc" ? (
          <ArrowDown className="h-2.5 w-2.5" aria-hidden />
        ) : (
          <ArrowUp className="h-2.5 w-2.5" aria-hidden />
        )
      ) : (
        <ArrowDown className="h-2.5 w-2.5 opacity-30" aria-hidden />
      )}
    </button>
  );
}

function EngagementMarks({
  post,
  node,
  compact = false,
}: {
  post: ProfilePost;
  node: GraphNode;
  compact?: boolean;
}) {
  const engagement = node.postEngagement?.[post.id];
  const reacted = Boolean(engagement?.reactionType);
  const commented = Boolean(engagement?.commented);
  const emoji = engagement?.reactionType
    ? (REACTION_EMOJI[engagement.reactionType] ?? "👍")
    : null;

  if (!reacted && !commented) {
    return (
      <span
        className={`rounded-full bg-white/10 ${compact ? "h-1 w-1" : "h-1.5 w-1.5"}`}
      />
    );
  }

  return (
    <>
      {emoji ? (
        <span
          className={`leading-none ${compact ? "text-xs" : "text-sm"}`}
          aria-hidden
        >
          {emoji}
        </span>
      ) : null}
      {commented ? (
        <MessageCircle
          className={`${compact ? "h-3 w-3" : "h-3 w-3"} ${
            reacted ? "text-white/70" : "text-white/85"
          }`}
        />
      ) : null}
    </>
  );
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
  const [sortKey, setSortKey] = useState<SortKey>("engagement");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  const reactionTypes = useMemo(() => {
    const totals = new Map<string, number>();
    for (const node of nodes) {
      if (node.group !== "member") continue;
      for (const [type, count] of Object.entries(node.reactionsByType ?? {})) {
        if (count > 0) totals.set(type, (totals.get(type) ?? 0) + count);
      }
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type]) => type);
  }, [nodes]);

  const members = useMemo(
    () =>
      [...nodes.filter((n) => n.group === "member")]
        .filter((n) => personMatches(n, personQuery))
        .sort((a, b) => compareMembers(a, b, sortKey, sortDir)),
    [nodes, personQuery, sortKey, sortDir],
  );

  const totalMembers = useMemo(
    () => nodes.filter((n) => n.group === "member").length,
    [nodes],
  );

  function toggleSort(next: SortKey) {
    if (sortKey === next) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(next);
    setSortDir("desc");
  }

  const sortChips = (
    <>
      <SortChip
        active={sortKey === "engagement"}
        dir={sortDir}
        label="Rank"
        title="Sort by overall engagement"
        onClick={() => toggleSort("engagement")}
      />
      <SortChip
        active={sortKey === "comments"}
        dir={sortDir}
        label={
          <span className="inline-flex items-center gap-0.5">
            <MessageCircle className="h-2.5 w-2.5" />
            Comments
          </span>
        }
        title="Sort by comment count"
        onClick={() => toggleSort("comments")}
      />
      <SortChip
        active={sortKey === "reactions"}
        dir={sortDir}
        label="Reactions"
        title="Sort by total reactions"
        onClick={() => toggleSort("reactions")}
      />
      {reactionTypes.map((type) => (
        <SortChip
          key={type}
          active={sortKey === `reaction:${type}`}
          dir={sortDir}
          label={REACTION_EMOJI[type] ?? type}
          title={`Sort by ${REACTION_TITLE[type] ?? type}`}
          onClick={() => toggleSort(`reaction:${type}`)}
        />
      ))}
    </>
  );

  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      {/* Shared toolbar */}
      <div className="shrink-0 space-y-2 border-b border-white/10 px-3 py-2.5 sm:space-y-1.5 sm:px-3 sm:py-2">
        <div className="flex items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35 sm:left-2 sm:h-3 sm:w-3" />
            <input
              value={personQuery}
              onChange={(event) => setPersonQuery(event.target.value)}
              placeholder="Filter people..."
              className="block w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-8 pr-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/25 focus:bg-black/60 sm:rounded-md sm:py-1.5 sm:pl-7 sm:pr-2 sm:text-[11px]"
            />
          </label>
          <span className="shrink-0 text-[11px] tabular-nums text-white/35">
            {personQuery.trim() ? `${members.length}/` : ""}
            {totalMembers}
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-white/35">
            Sort
          </span>
          <div className="-mx-0.5 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {sortChips}
          </div>
        </div>

        <div className="hidden flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-white/45 sm:flex">
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
          <span className="text-white/30">Columns: latest → earliest</span>
        </div>
      </div>

      {/* Mobile: person cards with horizontal post strip */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain sm:hidden">
        {members.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-white/40">
            No people match “{personQuery.trim()}”.
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {members.map((node, i) => {
              const isSelected = selectedId === node.id;
              const comments = commentCount(node);
              const reactions = reactionCount(node);
              return (
                <li key={node.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(node)}
                    className={`w-full px-3 py-3 text-left transition ${
                      isSelected ? "bg-white/[0.07]" : "active:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 shrink-0 text-center text-[11px] tabular-nums text-white/30">
                        {i + 1}
                      </span>
                      {node.profilePicUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={node.profilePicUrl}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
                          {(node.fullName || node.label).charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div
                          className={`truncate text-sm font-medium ${
                            isSelected ? "text-white" : "text-white/85"
                          }`}
                        >
                          {node.fullName || node.label}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] tabular-nums text-white/40">
                          <span className="inline-flex items-center gap-0.5">
                            <MessageCircle className="h-3 w-3" />
                            {comments}
                          </span>
                          <span className="inline-flex items-center gap-0.5">
                            <span aria-hidden>👍</span>
                            {reactions}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="-mx-1 mt-2.5 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {orderedPosts.map((post, index) => {
                        const engagement = node.postEngagement?.[post.id];
                        const active = Boolean(
                          engagement?.reactionType || engagement?.commented,
                        );
                        return (
                          <div
                            key={post.id}
                            title={cellTooltip(post, node)}
                            className={`flex w-14 shrink-0 flex-col items-center gap-1 rounded-lg border px-1 py-1.5 ${
                              active
                                ? "border-white/20 bg-white/[0.06]"
                                : "border-white/5 bg-white/[0.02]"
                            }`}
                          >
                            {post.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={post.imageUrl}
                                alt=""
                                className="h-8 w-8 rounded object-cover ring-1 ring-white/10"
                              />
                            ) : (
                              <span className="flex h-8 w-8 items-center justify-center rounded bg-white/5 text-[9px] text-white/25 ring-1 ring-white/10">
                                {formatPostDate(post.postedAt) || `#${index + 1}`}
                              </span>
                            )}
                            <span className="flex h-4 min-w-0 items-center justify-center gap-0.5">
                              <EngagementMarks post={post} node={node} compact />
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Desktop: sticky matrix table */}
      <div className="hidden min-h-0 flex-1 overflow-auto overscroll-contain sm:block">
        <table className="min-w-full border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 min-w-[220px] border-b border-r border-white/10 bg-[#0c0b12] px-3 py-2 backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                  Person
                  <span className="ml-1 font-normal normal-case tracking-normal text-white/30">
                    ({personQuery.trim() ? `${members.length}/` : ""}
                    {totalMembers})
                  </span>
                </div>
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
              members.map((node, i) => {
                const isSelected = selectedId === node.id;
                const comments = commentCount(node);
                const reactions = reactionCount(node);
                return (
                  <tr
                    key={node.id}
                    className={
                      isSelected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                    }
                  >
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-r border-white/10 bg-[#0c0b12] px-0 backdrop-blur"
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(node)}
                        className={`flex w-full min-w-[220px] max-w-[280px] items-center gap-2 px-3 py-2 text-left text-xs transition ${
                          isSelected
                            ? "text-white"
                            : "text-white/75 hover:text-white"
                        }`}
                      >
                        <span className="w-5 shrink-0 tabular-nums text-white/30">
                          {i + 1}
                        </span>
                        {node.profilePicUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={node.profilePicUrl}
                            alt=""
                            className="h-6 w-6 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold">
                            {(node.fullName || node.label)
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {node.fullName || node.label}
                        </span>
                        <span
                          className="flex shrink-0 items-center gap-1.5 tabular-nums text-[10px] text-white/45"
                          title={`${comments} comments · ${reactions} reactions`}
                        >
                          <span className="inline-flex items-center gap-0.5">
                            <MessageCircle className="h-2.5 w-2.5" />
                            {comments}
                          </span>
                          <span className="inline-flex items-center gap-0.5">
                            <span aria-hidden>👍</span>
                            {reactions}
                          </span>
                        </span>
                      </button>
                    </th>
                    {orderedPosts.map((post) => {
                      const engagement = node.postEngagement?.[post.id];
                      const key = `${node.id}:${post.id}`;
                      const reacted = Boolean(engagement?.reactionType);
                      const commented = Boolean(engagement?.commented);

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
                              <EngagementMarks post={post} node={node} />
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
