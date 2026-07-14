"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Heart,
  MessageCircle,
  Users,
  Layers,
  Star,
  Search,
} from "lucide-react";
import type { NetworkPersonStat, NetworkStats as Stats } from "@/lib/types";
import { compactNumber } from "@/lib/graphUtils";
import { parsePosition } from "@/lib/position";
import {
  formatReactionBreakdown,
  REACTION_TITLE,
  reactionEntries,
} from "@/lib/reactions";

interface Props {
  stats: Stats;
  onSelectUsername?: (username: string) => void;
  selectedUsername?: string | null;
}

type PeopleView = "all-time" | "present" | "reactions";

function displayName(person: NetworkPersonStat): string {
  return person.fullName || `@${person.username}`;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function personSearchHaystack(person: NetworkPersonStat): string {
  const { title, company } = parsePosition(person.position);
  const reactionBits = reactionEntries(person.reactionsByType).flatMap(
    ({ type, title: reactionTitle, emoji, count }) => [
      type,
      reactionTitle,
      emoji,
      String(count),
      REACTION_TITLE[type] ?? "",
    ],
  );

  return normalizeSearch(
    [
      person.fullName,
      person.username,
      person.position,
      title,
      company,
      String(person.comments),
      `${person.comments} comments`,
      person.comments === 1 ? "1 comment" : "",
      String(person.reactionsTotal ?? 0),
      `${person.reactionsTotal ?? 0} reactions`,
      (person.reactionsTotal ?? 0) === 1 ? "1 reaction" : "",
      formatReactionBreakdown(person.reactionsByType),
      ...reactionBits,
      person.postsCommentedOn != null
        ? `${person.postsCommentedOn} commented`
        : "",
      person.postsReactedTo != null ? `${person.postsReactedTo} reacted` : "",
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function personMatches(person: NetworkPersonStat, query: string): boolean {
  const needle = normalizeSearch(query.trim());
  if (!needle) return true;
  const haystack = personSearchHaystack(person);
  return needle.split(/\s+/).every((token) => haystack.includes(token));
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

function PersonAvatar({ person }: { person: NetworkPersonStat }) {
  const name = displayName(person);
  if (person.profilePicUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.profilePicUrl}
        alt=""
        className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-white/15"
      />
    );
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white/70 ring-1 ring-white/10">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function PersonRole({ position }: { position?: string }) {
  const { title, company } = parsePosition(position);
  if (!title && !company) return null;
  return (
    <span className="min-w-0 flex-1 truncate text-[11px] text-white/55">
      <span className="text-white/30">- </span>
      {title ? <span className="font-semibold text-white/70">{title}</span> : null}
      {title && company ? <span className="text-white/30"> </span> : null}
      {company ? <span className="italic text-white/45">{company}</span> : null}
    </span>
  );
}

export default function NetworkStats({
  stats,
  onSelectUsername,
  selectedUsername,
}: Props) {
  const [view, setView] = useState<PeopleView>("all-time");
  const [query, setQuery] = useState("");
  const hasReactions =
    (stats.totalReactions ?? 0) > 0 || (stats.topReactors?.length ?? 0) > 0;

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

  const basePeople: NetworkPersonStat[] =
    view === "all-time"
      ? stats.topCommentators
      : view === "present"
        ? stats.recentCommentators
        : (stats.topReactors ?? []);

  const visiblePeople = useMemo(
    () => basePeople.filter((person) => personMatches(person, query)),
    [basePeople, query],
  );

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

      {(basePeople.length > 0 || hasReactions) && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
              <TitleIcon className="h-4 w-4 text-ig-yellow" />
              {title}
              <span className="font-normal text-white/35">
                ({query.trim() ? `${visiblePeople.length}/` : ""}
                {basePeople.length})
              </span>
            </div>
            <div className="inline-flex flex-wrap rounded-lg border border-white/10 bg-black/30 p-0.5">
              <button
                type="button"
                onClick={() => setView("all-time")}
                className={`min-h-[36px] rounded-md px-2.5 py-1.5 text-[11px] transition sm:min-h-0 sm:px-2 sm:py-1 ${
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
                className={`min-h-[36px] rounded-md px-2.5 py-1.5 text-[11px] transition sm:min-h-0 sm:px-2 sm:py-1 ${
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
                  className={`min-h-[36px] rounded-md px-2.5 py-1.5 text-[11px] transition sm:min-h-0 sm:px-2 sm:py-1 ${
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

          <label className="relative mb-3 block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by name, role, company, reactions…"
              className="w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-8 pr-3 text-xs text-white outline-none transition placeholder:text-white/35 focus:border-white/25 focus:bg-black/60"
            />
          </label>

          {visiblePeople.length > 0 ? (
            <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto overscroll-y-contain pr-1">
              {visiblePeople.map((u, i) => {
                const isSelected =
                  selectedUsername?.toLowerCase() === u.username.toLowerCase();
                const row = (
                  <>
                    <span className="flex min-w-0 flex-1 items-start gap-2 overflow-hidden sm:items-center">
                      <span className="mt-0.5 w-5 shrink-0 tabular-nums text-white/30 sm:mt-0">
                        {i + 1}
                      </span>
                      <PersonAvatar person={u} />
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
                          <span className="truncate text-white/85 sm:max-w-[45%] sm:shrink-0">
                            {displayName(u)}
                          </span>
                          <PersonRole position={u.position} />
                        </span>
                        <span className="mt-1 block font-mono text-[11px] leading-snug text-white/50 sm:hidden">
                          {engagementLabel(u, view)}
                        </span>
                      </span>
                    </span>
                    <span className="hidden max-w-[42%] shrink-0 text-right font-mono text-[11px] leading-snug text-white/50 sm:block">
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
                      className={`flex w-full min-h-[44px] items-center justify-between gap-2 rounded-xl px-2 py-2 text-left text-sm transition sm:min-h-0 sm:py-1.5 ${
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
            <p className="text-xs text-white/40">
              {query.trim()
                ? `No people match “${query.trim()}”.`
                : "No people in this view yet."}
            </p>
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
