"use client";

import { useState } from "react";
import { compactNumber } from "@/lib/graphUtils";

export interface SchoolLogoItem {
  label: string;
  count: number;
  logoUrl?: string;
}

interface Props {
  schools: SchoolLogoItem[];
  accent?: string;
  onSelect?: (label: string) => void;
  className?: string;
}

function SchoolMark({
  school,
  size,
}: {
  school: SchoolLogoItem;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  if (school.logoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={school.logoUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="rounded-lg object-cover ring-1 ring-white/15"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex items-center justify-center rounded-lg bg-white/10 text-xs font-semibold text-white/70 ring-1 ring-white/10"
      style={{ width: size, height: size }}
    >
      {school.label.charAt(0).toUpperCase()}
    </span>
  );
}

export default function SchoolLogoChart({
  schools,
  accent = "#0A66C2",
  onSelect,
  className = "",
}: Props) {
  if (schools.length === 0) {
    return (
      <div
        className={`flex h-[220px] items-center justify-center px-4 text-sm text-white/35 ${className}`}
      >
        No school data in this roster
      </div>
    );
  }

  const max = Math.max(...schools.map((s) => s.count), 1);

  return (
    <div className={`px-3 py-3 sm:px-4 ${className}`}>
      <ul className="flex max-h-[260px] flex-col gap-2 overflow-y-auto pr-1">
        {schools.map((school) => {
          const pct = Math.max(8, (school.count / max) * 100);
          return (
            <li key={school.label}>
              <button
                type="button"
                disabled={!onSelect}
                onClick={() => onSelect?.(school.label)}
                className={`group relative flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition ${
                  onSelect ? "hover:bg-white/[0.04]" : "cursor-default"
                }`}
              >
                <span
                  className="pointer-events-none absolute inset-y-1 left-1 rounded-lg"
                  style={{
                    width: `calc(${pct}% - 8px)`,
                    background: `${accent}22`,
                  }}
                  aria-hidden
                />
                <span className="relative z-[1] shrink-0">
                  <SchoolMark school={school} size={36} />
                </span>
                <span className="relative z-[1] min-w-0 flex-1">
                  <span className="block truncate text-sm text-white/85">
                    {school.label}
                  </span>
                  <span className="block text-[11px] text-white/35">
                    {school.count === 1 ? "1 employee" : `${school.count} employees`}
                  </span>
                </span>
                <span className="relative z-[1] shrink-0 font-mono text-xs tabular-nums text-white/55">
                  {compactNumber(school.count)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
