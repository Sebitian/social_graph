"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { AnalyticsPersonRow } from "@/lib/analytics";
import type { SocialSourcePlatform } from "@/lib/types";
import AnalyticsAvatar from "@/components/analytics/AnalyticsAvatar";

interface Props {
  people: AnalyticsPersonRow[];
  platform: SocialSourcePlatform;
  selectedUsername?: string | null;
  onSelectUsername?: (username: string) => void;
  limit?: number;
}

const MAX = 10;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matches(person: AnalyticsPersonRow, query: string): boolean {
  const needle = normalize(query.trim());
  if (!needle) return true;
  const haystack = normalize(
    [person.fullName, person.username, person.title, person.position]
      .filter(Boolean)
      .join(" "),
  );
  return needle.split(/\s+/).every((token) => haystack.includes(token));
}

function roleLine(person: AnalyticsPersonRow): string {
  if (person.title && person.position) return `${person.title} · ${person.position}`;
  return person.title || person.position || `@${person.username}`;
}

export default function EngagerTable({
  people,
  platform,
  selectedUsername,
  onSelectUsername,
  limit = MAX,
}: Props) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const filtered = people.filter((p) => matches(p, query));
    return filtered.slice(0, limit);
  }, [people, query, limit]);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#D5CDBF] bg-[#FBF8F2]">
      <header className="border-b border-[#D5CDBF] px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold text-[#161A17]/85">Rank</h3>
          <span className="text-[10px] text-[#5E665F]/80">
            {query ? `${visible.length} of ${people.length}` : `Top ${Math.min(people.length, limit)}`}
          </span>
        </div>
        <label className="relative mt-2 block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5E665F]/80" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, role, company…"
            className="h-9 w-full rounded-lg border border-[#D5CDBF] bg-[#F3EEE4] py-0 pl-8 pr-8 text-[12px] text-[#161A17] outline-none transition placeholder:text-[#5E665F]/70 focus:border-[#161A17]/30 focus:bg-[#FBF8F2]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[#5E665F] hover:text-[#161A17]"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>
      </header>

      <div className="divide-y divide-[#E7E0D4]">
        {visible.map((person) => {
          const selected =
            selectedUsername?.toLowerCase() === person.username.toLowerCase();
          return (
            <button
              key={person.username}
              type="button"
              onClick={() => onSelectUsername?.(person.username)}
              className={`flex w-full min-h-[56px] items-center gap-3 px-3 py-2.5 text-left transition active:scale-[0.995] ${
                selected ? "bg-[#EFE8DC]" : "hover:bg-[#F3EEE4]"
              }`}
            >
              <AnalyticsAvatar
                username={person.username}
                fullName={person.fullName}
                profilePicUrl={person.profilePicUrl}
                platform={platform}
                size={36}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-[#161A17]">
                  {person.fullName || `@${person.username}`}
                </div>
                <div className="truncate text-[11px] text-[#5E665F]/80">
                  {roleLine(person)}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-[13px] font-medium text-[#161A17]">
                  {person.metricLabel ?? person.value}
                </div>
              </div>
            </button>
          );
        })}
        {visible.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-[#5E665F]/80">
            {query.trim() ? "No matches" : "No engagers in this range"}
          </div>
        ) : null}
      </div>
    </section>
  );
}
