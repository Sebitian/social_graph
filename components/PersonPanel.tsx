"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Heart, MessageCircle, Search, X } from "lucide-react";
import type { Circle, GraphNode, PostComment } from "@/lib/types";
import { deriveSimpleTags, explainRingPlacement } from "@/lib/graphUtils";
import { formatReactionBreakdown, reactionEntries } from "@/lib/reactions";

function formatRecentDays(days?: number): string {
  if (days == null) return "unknown";
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 60) return `${Math.round(days / 7)}w ago`;
  if (days < 730) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

type CommentSort = "time-desc" | "time-asc";

function relativeDays(when?: string, timestamp?: string): number | undefined {
  if (timestamp) {
    const ms = Date.parse(timestamp);
    if (!Number.isNaN(ms)) return Math.max(0, (Date.now() - ms) / 86_400_000);
  }
  if (!when) return undefined;
  const clean = when.trim().toLowerCase();
  if (clean === "today" || clean === "recently") return 0;
  const match = clean.match(/^(\d+)\s*(second|minute|hour|day|week|month|year|s|m|h|d|w|mo|y)s?(?:\s+ago)?$/i);
  if (!match) return undefined;
  const n = Number(match[1]);
  const unit = match[2];
  if (unit.startsWith("s") || unit === "m" || unit.startsWith("minute") || unit.startsWith("h")) return 0;
  if (unit.startsWith("d")) return n;
  if (unit.startsWith("w")) return n * 7;
  if (unit === "mo" || unit.startsWith("month")) return n * 30;
  return n * 365;
}

function commentTimeValue(comment: PostComment): number | undefined {
  if (comment.timestamp) {
    const ms = Date.parse(comment.timestamp);
    if (!Number.isNaN(ms)) return ms;
  }
  const days = relativeDays(comment.when);
  if (days == null) return undefined;
  return Date.now() - days * 86_400_000;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function fuzzyScore(needle: string, haystack: string): number | null {
  if (!needle) return 0;
  const exactIndex = haystack.indexOf(needle);
  if (exactIndex >= 0) return exactIndex;

  let score = 0;
  let lastMatch = -1;
  let searchFrom = 0;

  for (const char of needle) {
    const found = haystack.indexOf(char, searchFrom);
    if (found === -1) return null;
    score += found - searchFrom;
    if (lastMatch >= 0) score += Math.max(0, found - lastMatch - 1);
    lastMatch = found;
    searchFrom = found + 1;
  }

  return score + haystack.length - needle.length;
}

function searchableCommentText(comment: PostComment): string {
  return normalizeSearch([
    comment.text,
    comment.post,
    comment.when,
    comment.authorUsername,
    comment.postType,
    comment.captionCategory,
    ...(comment.mentionedUsers ?? []),
  ].filter(Boolean).join(" "));
}

function commentSearchScore(comment: PostComment, query: string): number | null {
  const normalizedQuery = normalizeSearch(query.trim());
  if (!normalizedQuery) return 0;
  const searchable = searchableCommentText(comment);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  let total = 0;
  for (const token of tokens) {
    const score = fuzzyScore(token, searchable);
    if (score == null) return null;
    total += score;
  }
  return total;
}

function CommentReceiptList({ history }: { history: PostComment[] }) {
  const [commentSearch, setCommentSearch] = useState("");
  const [commentSort, setCommentSort] = useState<CommentSort>("time-desc");

  const visibleHistory = useMemo(() => {
    const scored = history
      .map((comment, index) => ({
        comment,
        index,
        score: commentSearchScore(comment, commentSearch),
        time: commentTimeValue(comment),
      }))
      .filter((item) => item.score != null);

    scored.sort((a, b) => {
      if (a.time == null && b.time != null) return 1;
      if (a.time != null && b.time == null) return -1;
      if (a.time != null && b.time != null && a.time !== b.time) {
        return commentSort === "time-desc" ? b.time - a.time : a.time - b.time;
      }
      if ((a.score ?? 0) !== (b.score ?? 0)) return (a.score ?? 0) - (b.score ?? 0);
      return a.index - b.index;
    });

    return scored.map((item) => item.comment);
  }, [history, commentSearch, commentSort]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-2">
        <label className="relative block min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
          <input
            value={commentSearch}
            onChange={(event) => setCommentSearch(event.target.value)}
            placeholder="Search comments..."
            className="block w-full min-w-0 rounded-xl border border-white/10 bg-black/35 py-2 pl-8 pr-3 text-xs text-white shadow-inner shadow-black/20 outline-none transition placeholder:text-white/35 focus:border-white/25 focus:bg-black/55"
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-white/10 bg-black/35 p-0.5">
            <button
              type="button"
              onClick={() => setCommentSort("time-desc")}
              aria-pressed={commentSort === "time-desc"}
              className={`rounded-md px-2 py-1 text-[11px] transition ${
                commentSort === "time-desc"
                  ? "bg-white/15 text-white"
                  : "text-white/45 hover:bg-white/10 hover:text-white/70"
              }`}
            >
              Newest
            </button>
            <button
              type="button"
              onClick={() => setCommentSort("time-asc")}
              aria-pressed={commentSort === "time-asc"}
              className={`rounded-md px-2 py-1 text-[11px] transition ${
                commentSort === "time-asc"
                  ? "bg-white/15 text-white"
                  : "text-white/45 hover:bg-white/10 hover:text-white/70"
              }`}
            >
              Oldest
            </button>
          </div>
          <span className="ml-auto text-[11px] text-white/35">
            {visibleHistory.length} of {history.length}
          </span>
        </div>
      </div>

      {visibleHistory.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {visibleHistory.map((c, i) => (
            <li key={`${c.postId ?? c.post}-${c.timestamp ?? c.when}-${i}`} className="text-sm">
              <div className="text-white/85">{c.text}</div>
              <div className="mt-0.5 text-[11px] text-white/35">
                on “{c.post}” · {c.when}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs leading-relaxed text-white/40">
          No comments match “{commentSearch}”.
        </p>
      )}
    </div>
  );
}

interface Props {
  node: GraphNode | null;
  proximityRing?: { id: number; label: string; subtitle?: string; color: string };
  friendCluster?: Circle;
  onClose: () => void;
}

export default function PersonPanel({ node, proximityRing, friendCluster, onClose }: Props) {
  const color = proximityRing?.color ?? friendCluster?.color ?? "#94a3b8";
  const initial = (node?.label ?? "?").charAt(0).toUpperCase();
  const history = useMemo(() => node?.history ?? [], [node?.history]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const isOpen = Boolean(node && node.group !== "self");

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen, node?.id]);

  const tags = useMemo(() => (node ? deriveSimpleTags(node) : []), [node]);
  const explanation = useMemo(
    () => (node && proximityRing ? explainRingPlacement(node, proximityRing) : ""),
    [node, proximityRing],
  );
  const features = node?.features;
  const reactionParts = reactionEntries(node?.reactionsByType);
  const reactionBreakdown = formatReactionBreakdown(node?.reactionsByType);

  const panel = (
    <AnimatePresence>
      {isOpen && node && (
        <>
          <motion.button
            type="button"
            key={`${node.id}-backdrop`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/65 sm:bg-black/40"
            onClick={onClose}
            aria-label="Close profile"
          />
          <motion.div
            key={node.id}
            initial={isMobile ? { y: "100%" } : { opacity: 0, x: 24 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, x: 0 }}
            exit={isMobile ? { y: "100%" } : { opacity: 0, x: 24 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-50 flex w-full max-h-[min(88dvh,100%)] flex-col overflow-hidden rounded-t-2xl rounded-b-none border border-white/10 bg-black/90 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-20 sm:max-h-[calc(100dvh-6rem)] sm:w-[300px] sm:rounded-2xl sm:pb-0"
            onTouchMove={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20 sm:hidden" />

            <div className="relative shrink-0 border-b border-white/10 px-4 pb-3 pt-4">
              <button
                onClick={onClose}
                className="absolute right-3 top-3 rounded-full p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3 pr-8">
                {node.profilePicUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={node.profilePicUrl}
                    alt={node.label}
                    className="h-12 w-12 rounded-full object-cover ring-2"
                    style={{ boxShadow: `0 0 0 2px ${color}` }}
                  />
                ) : (
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${color}, #07060d)` }}
                  >
                    {initial}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-semibold text-white">
                      {node.fullName || node.label}
                    </span>
                    {node.isVerified && (
                      <BadgeCheck className="h-4 w-4 shrink-0 text-ig-blue" />
                    )}
                  </div>
                  <div className="truncate text-sm text-white/50">@{node.label}</div>
                  {proximityRing && (
                    <span
                      className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                      style={{ backgroundColor: `${color}22`, color }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      {proximityRing.label}
                    </span>
                  )}
                  {friendCluster && (
                    <span
                      className="mt-1 ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                      style={{
                        backgroundColor: `${friendCluster.color}22`,
                        color: friendCluster.color,
                      }}
                    >
                      {friendCluster.label}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y px-4 py-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-[11px] text-white/35">Their comments</div>
                  <div className="mt-0.5 flex items-center gap-1 font-semibold text-white">
                    <MessageCircle className="h-3.5 w-3.5" style={{ color }} />
                    {node.comments}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-[11px] text-white/35">Their reactions</div>
                  <div className="mt-0.5 flex items-center gap-1 font-semibold text-white">
                    <Heart className="h-3.5 w-3.5" style={{ color }} />
                    {node.reactionsTotal ?? 0}
                  </div>
                  {reactionParts.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {reactionParts.map(({ type, emoji, title, count }) => (
                        <span
                          key={type}
                          title={title}
                          className="inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-black/30 px-1.5 py-0.5 text-[11px] text-white/80"
                        >
                          <span aria-hidden>{emoji}</span>
                          <span className="tabular-nums">{count}</span>
                          <span className="sr-only">{title}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-[11px] text-white/35">Last interaction</div>
                  <div className="mt-0.5 font-semibold text-white">
                    {history.length > 0
                      ? formatRecentDays(features?.mostRecentDaysAgo)
                      : (node.reactionsTotal ?? 0) > 0
                        ? "Reactions only"
                        : "unknown"}
                  </div>
                </div>
                {typeof node.totalPostsScraped === "number" &&
                  node.totalPostsScraped > 0 && (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <div className="text-[11px] text-white/35">Post coverage</div>
                      <div className="mt-0.5 text-xs font-semibold leading-snug text-white">
                        {node.postsCommentedOn ?? 0}/{node.totalPostsScraped} commented
                      </div>
                      <div className="mt-0.5 text-xs font-semibold leading-snug text-white">
                        {node.postsReactedTo ?? 0}/{node.totalPostsScraped} reacted
                      </div>
                    </div>
                  )}
                {features?.reciprocityObserved && (
                  <div className="col-span-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <div className="text-[11px] text-white/35">You on their posts</div>
                    <div className="mt-0.5 font-semibold text-white">
                      {(features.outboundCommentsFromTarget ?? 0) > 0
                        ? `${features.outboundCommentsFromTarget} visible comment${
                            features.outboundCommentsFromTarget === 1 ? "" : "s"
                          }`
                        : "None observed (public posts only)"}
                    </div>
                  </div>
                )}
              </div>

              {tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/75"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {explanation && (
                <p className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-xs leading-relaxed text-white/60">
                  {explanation}
                </p>
              )}

              <div className="mt-4 border-t border-white/10 pt-3">
                {history.length > 0 ? (
                  <>
                    <h3 className="mb-2 text-xs font-semibold text-white/70">
                      What they wrote
                    </h3>
                    <CommentReceiptList key={node.id} history={history} />
                  </>
                ) : (node.reactionsTotal ?? 0) > 0 ? (
                  <p className="text-xs leading-relaxed text-white/50">
                    No comments — but they reacted to{" "}
                    <span className="font-semibold text-white/80">
                      {node.postsReactedTo ?? node.reactionsTotal}
                      {typeof node.totalPostsScraped === "number"
                        ? ` of your ${node.totalPostsScraped}`
                        : ""}{" "}
                      posts
                    </span>
                    {reactionBreakdown ? ` (${reactionBreakdown})` : ""}.
                  </p>
                ) : (
                  <p className="text-xs leading-relaxed text-white/40">
                    No comments from this person were returned by the scrape.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document !== "undefined") {
    return createPortal(panel, document.body);
  }

  return panel;
}
