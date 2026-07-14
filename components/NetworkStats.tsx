"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, Heart, MessageCircle, Users, Layers, Star } from "lucide-react";
import type { NetworkPersonStat, NetworkStats as Stats } from "@/lib/types";
import { compactNumber, CIRCLE_COLORS } from "@/lib/graphUtils";
import { formatReactionBreakdown } from "@/lib/reactions";

interface Props {
  stats: Stats;
  onSelectUsername?: (username: string) => void;
  selectedUsername?: string | null;
}

type PeopleView = "all-time" | "present" | "reactions";

function displayName(person: NetworkPersonStat): string {
  return person.fullName || `@${person.username}`;
}

function engagementLabel(person: NetworkPersonStat, view: PeopleView): string {
  const comments = person.comments;
  const reactions = person.reactionsTotal ?? 0;
  const reactionBits = formatReactionBreakdown(person.reactionsByType);

  if (view === "reactions") {
    const coverage =
      typeof person.totalPostsScraped === "number" &&
      person.totalPostsScraped > 0 &&
      typeof person.postsReactedTo === "number"
        ? ` · ${person.postsReactedTo}/${person.totalPostsScraped} posts`
        : "";
    if (reactionBits) return `${reactionBits}${coverage}`;
    return `${compactNumber(reactions)} reactions${coverage}`;
  }

  if (view === "present" && person.latestCommentWhen) {
    const parts = [person.latestCommentWhen];
    if (comments > 0) parts.push(`${compactNumber(comments)} comments`);
    if (reactions > 0) {
      parts.push(reactionBits || `${compactNumber(reactions)} reactions`);
    }
    return parts.join(" · ");
  }

  const parts: string[] = [];
  if (comments > 0) parts.push(`${compactNumber(comments)} comments`);
  if (reactions > 0) {
    parts.push(reactionBits || `${compactNumber(reactions)} reactions`);
  }
  if (parts.length === 0) return "No engagement";
  return parts.join(" · ");
}

export default function NetworkStats({
  stats,
  onSelectUsername,
  selectedUsername,
}: Props) {
  const [view, setView] = useState<PeopleView>("all-time");
  const hasReactions = (stats.totalReactions ?? 0) > 0 || (stats.topReactors?.length ?? 0) > 0;

  const cards = [
    { label: "Clusters", value: String(stats.circleCount), icon: Layers, color: "text-ig-pink" },
    { label: "Shown", value: String(stats.shown), icon: Users, color: "text-ig-blue" },
    { label: "Comments", value: compactNumber(stats.totalComments), icon: MessageCircle, color: "text-ig-purple" },
    hasReactions
      ? {
          label: "Reactions",
          value: compactNumber(stats.totalReactions ?? 0),
          icon: Heart,
          color: "text-ig-orange",
        }
      : {
          label: "Biggest",
          value: String(stats.biggestCircle.size),
          icon: Star,
          color: "text-ig-orange",
        },
  ];

  const visiblePeople: NetworkPersonStat[] =
    view === "all-time"
      ? stats.topCommentators
      : view === "present"
        ? stats.recentCommentators
        : (stats.topReactors ?? []);

  const title =
    view === "reactions"
      ? "Top reactors"
      : view === "present"
        ? "Most present"
        : "Top engagers";

  const TitleIcon =
    view === "reactions" ? Heart : view === "present" ? Clock : MessageCircle;

  const footer =
    view === "all-time"
      ? "Ranked by comments, then reactions."
      : view === "present"
        ? "Ranked by engagement volume, then recency."
        : "Ranked by reactions on your posts.";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"
            >
              <Icon className={`h-5 w-5 ${c.color}`} />
              <div className="mt-3 text-2xl font-bold text-white">{c.value}</div>
              <div className="text-xs uppercase tracking-wide text-white/40">
                {c.label}
              </div>
            </motion.div>
          );
        })}
      </div>

      {(visiblePeople.length > 0 || hasReactions) && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
              <TitleIcon className="h-4 w-4 text-ig-yellow" />
              {title}
            </div>
            <div className="inline-flex flex-wrap rounded-lg border border-white/10 bg-black/30 p-0.5">
              <button
                type="button"
                onClick={() => setView("all-time")}
                className={`rounded-md px-2 py-1 text-[11px] transition ${
                  view === "all-time"
                    ? "bg-white/15 text-white"
                    : "text-white/45 hover:bg-white/10 hover:text-white/70"
                }`}
              >
                All time
              </button>
              <button
                type="button"
                onClick={() => setView("present")}
                className={`rounded-md px-2 py-1 text-[11px] transition ${
                  view === "present"
                    ? "bg-white/15 text-white"
                    : "text-white/45 hover:bg-white/10 hover:text-white/70"
                }`}
              >
                Most present
              </button>
              {hasReactions && (
                <button
                  type="button"
                  onClick={() => setView("reactions")}
                  className={`rounded-md px-2 py-1 text-[11px] transition ${
                    view === "reactions"
                      ? "bg-white/15 text-white"
                      : "text-white/45 hover:bg-white/10 hover:text-white/70"
                  }`}
                >
                  Reactions
                </button>
              )}
            </div>
          </div>
          {visiblePeople.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {visiblePeople.slice(0, 8).map((u, i) => {
                const isSelected = selectedUsername === u.username;
                const row = (
                  <>
                    <span className="flex min-w-0 items-center gap-2 text-white/80">
                      <span className="w-4 shrink-0 text-white/30">{i + 1}</span>
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            CIRCLE_COLORS[u.circle] ?? CIRCLE_COLORS[CIRCLE_COLORS.length - 1],
                        }}
                      />
                      <span className="truncate">{displayName(u)}</span>
                    </span>
                    <span className="max-w-[55%] shrink-0 text-right font-mono text-[11px] leading-snug text-white/50">
                      {engagementLabel(u, view)}
                    </span>
                  </>
                );

                if (!onSelectUsername) {
                  return (
                    <li
                      key={u.username}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      {row}
                    </li>
                  );
                }

                return (
                  <li key={u.username}>
                    <button
                      type="button"
                      onClick={() => onSelectUsername(u.username)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-left text-sm transition ${
                        isSelected
                          ? "bg-white/10 text-white"
                          : "text-white/80 hover:bg-white/5"
                      }`}
                    >
                      {row}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-white/40">No people in this view yet.</p>
          )}
          <p className="mt-2 border-t border-white/10 pt-2 text-[10px] leading-relaxed text-white/40">
            {onSelectUsername ? "Tap a name to open their profile. " : ""}
            {footer}
          </p>
        </div>
      )}
    </div>
  );
}
