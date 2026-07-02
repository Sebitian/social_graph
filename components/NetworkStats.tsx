"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, MessageCircle, Users, Layers, Star } from "lucide-react";
import type { NetworkStats as Stats } from "@/lib/types";
import { compactNumber, CIRCLE_COLORS } from "@/lib/graphUtils";

interface Props {
  stats: Stats;
}

type CommentatorView = "all-time" | "present";

export default function NetworkStats({ stats }: Props) {
  const [view, setView] = useState<CommentatorView>("all-time");
  const cards = [
    { label: "Clusters", value: String(stats.circleCount), icon: Layers, color: "text-ig-pink" },
    { label: "Shown", value: String(stats.shown), icon: Users, color: "text-ig-blue" },
    { label: "Comments", value: compactNumber(stats.totalComments), icon: MessageCircle, color: "text-ig-purple" },
    { label: "Biggest", value: String(stats.biggestCircle.size), icon: Star, color: "text-ig-orange" },
  ];
  const visibleCommentators =
    view === "all-time" ? stats.topCommentators : stats.recentCommentators;

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

      {visibleCommentators.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
              {view === "all-time" ? (
                <MessageCircle className="h-4 w-4 text-ig-yellow" />
              ) : (
                <Clock className="h-4 w-4 text-ig-yellow" />
              )}
              Commentators
            </div>
            <div className="inline-flex rounded-lg border border-white/10 bg-black/30 p-0.5">
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
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            {visibleCommentators.slice(0, 8).map((u, i) => (
              <li
                key={u.username}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2 text-white/80">
                  <span className="w-4 shrink-0 text-white/30">{i + 1}</span>
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        CIRCLE_COLORS[u.circle] ?? CIRCLE_COLORS[CIRCLE_COLORS.length - 1],
                    }}
                  />
                  <span className="truncate">@{u.username}</span>
                </span>
                <span className="shrink-0 text-right font-mono text-[11px] text-white/50">
                  {view === "present" && "latestCommentWhen" in u
                    ? `${u.latestCommentWhen} · ${compactNumber(u.comments)} comments`
                    : `${compactNumber(u.comments)} comments`}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 border-t border-white/10 pt-2 text-[10px] leading-relaxed text-white/40">
            {view === "all-time"
              ? "Ranked by total comments in this scan."
              : "Ranked by graph distance — most recent activity first, then consistency."}
          </p>
        </div>
      )}
    </div>
  );
}
