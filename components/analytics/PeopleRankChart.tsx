"use client";

import { useState } from "react";
import type { AnalyticsPersonRow } from "@/lib/analytics";
import { compactNumber } from "@/lib/graphUtils";
import { resolveProfilePicUrl, type AvatarPlatform } from "@/lib/avatarUrl";

interface Props {
  people: AnalyticsPersonRow[];
  accent?: string;
  platform?: AvatarPlatform;
  valueCaption?: string;
  empty?: string;
  selectedUsername?: string | null;
  onSelect?: (username: string) => void;
  className?: string;
}

function Avatar({
  username,
  fullName,
  profilePicUrl,
  platform,
}: {
  username: string;
  fullName?: string;
  profilePicUrl?: string;
  platform?: AvatarPlatform;
}) {
  const [failed, setFailed] = useState(false);
  const src = resolveProfilePicUrl(username, profilePicUrl, platform);
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-8 w-8 rounded-full object-cover ring-1 ring-[#161A17]/10"
      />
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E7E0D4] text-[11px] font-semibold text-[#161A17]/85 ring-1 ring-[#161A17]/10">
      {(fullName || username).charAt(0).toUpperCase()}
    </span>
  );
}

export default function PeopleRankChart({
  people,
  accent = "#E1306C",
  platform,
  valueCaption = "comments",
  empty = "No commentators in this range",
  selectedUsername,
  onSelect,
  className = "",
}: Props) {
  if (people.length === 0) {
    return (
      <div
        className={`flex h-[220px] items-center justify-center px-4 text-sm text-[#5E665F]/80 ${className}`}
      >
        {empty}
      </div>
    );
  }

  const max = Math.max(...people.map((p) => p.value), 1);

  return (
    <div className={`px-3 py-3 sm:px-4 ${className}`}>
      <ul className="flex max-h-[320px] flex-col gap-1 overflow-y-auto pr-1">
        {people.map((person, idx) => {
          const pct = Math.max(8, (person.value / max) * 100);
          const selected =
            selectedUsername?.toLowerCase() === person.username.toLowerCase();
          const label = person.fullName || `@${person.username}`;
          return (
            <li key={person.username}>
              <button
                type="button"
                disabled={!onSelect}
                onClick={() => onSelect?.(person.username)}
                className={`group relative flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition ${
                  onSelect ? "hover:bg-[#F3EEE4]" : "cursor-default"
                } ${selected ? "bg-[#EFE8DC]" : ""}`}
              >
                <span
                  className="pointer-events-none absolute inset-y-1 left-1 rounded-lg"
                  style={{
                    width: `calc(${pct}% - 8px)`,
                    background: `${accent}22`,
                  }}
                  aria-hidden
                />
                <span className="relative z-[1] w-5 shrink-0 text-center font-mono text-[11px] text-[#5E665F]/70">
                  {idx + 1}
                </span>
                <span className="relative z-[1] shrink-0">
                  <Avatar
                    username={person.username}
                    fullName={person.fullName}
                    profilePicUrl={person.profilePicUrl}
                    platform={platform}
                  />
                </span>
                <span className="relative z-[1] min-w-0 flex-1">
                  <span className="block truncate text-sm text-[#161A17] group-hover:text-[#161A17]">
                    {label}
                  </span>
                  <span className="block truncate text-[11px] text-[#5E665F]/80">
                    @{person.username}
                    {person.title ? ` · ${person.title}` : ""}
                  </span>
                </span>
                <span className="relative z-[1] shrink-0 text-right">
                  <span className="block font-mono text-xs tabular-nums text-[#161A17]/85">
                    {compactNumber(person.value)}
                  </span>
                  <span className="block text-[10px] uppercase tracking-wide text-[#5E665F]/70">
                    {valueCaption}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
