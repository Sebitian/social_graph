"use client";

import { useState } from "react";
import type { CompanyEmployeeRankRow } from "@/lib/analytics";
import { compactNumber } from "@/lib/graphUtils";

interface Props {
  employees: CompanyEmployeeRankRow[];
  /** Which reach metric to emphasize in the bar. */
  metric?: "followers" | "connections";
  accent?: string;
  className?: string;
}

function Avatar({
  name,
  src,
}: {
  name: string;
  src?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-8 w-8 rounded-full object-cover ring-1 ring-white/15"
      />
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white/70 ring-1 ring-white/10">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export default function EmployeeRankChart({
  employees,
  metric = "followers",
  accent = "#0A66C2",
  className = "",
}: Props) {
  if (employees.length === 0) {
    return (
      <div
        className={`flex h-[220px] items-center justify-center px-4 text-sm text-white/35 ${className}`}
      >
        No employee reach data
      </div>
    );
  }

  const values = employees.map((e) =>
    metric === "followers" ? e.followers || e.connections : e.connections || e.followers,
  );
  const max = Math.max(...values, 1);

  return (
    <div className={`px-3 py-3 sm:px-4 ${className}`}>
      <ul className="flex max-h-[260px] flex-col gap-1.5 overflow-y-auto pr-1">
        {employees.map((emp, idx) => {
          const value =
            metric === "followers"
              ? emp.followers || emp.connections
              : emp.connections || emp.followers;
          const pct = Math.max(6, (value / max) * 100);
          const secondary =
            metric === "followers"
              ? emp.connections
                ? `${compactNumber(emp.connections)} connections`
                : emp.location
              : emp.followers
                ? `${compactNumber(emp.followers)} followers`
                : emp.location;

          return (
            <li key={emp.id}>
              <a
                href={emp.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex w-full items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.04]"
              >
                <span
                  className="pointer-events-none absolute inset-y-1 left-1 rounded-lg"
                  style={{
                    width: `calc(${pct}% - 8px)`,
                    background: `${accent}22`,
                  }}
                  aria-hidden
                />
                <span className="relative z-[1] w-5 shrink-0 text-center font-mono text-[11px] text-white/30">
                  {idx + 1}
                </span>
                <span className="relative z-[1] shrink-0">
                  <Avatar name={emp.name} src={emp.profilePicUrl} />
                </span>
                <span className="relative z-[1] min-w-0 flex-1">
                  <span className="block truncate text-sm text-white/85 group-hover:text-white">
                    {emp.name}
                  </span>
                  <span className="block truncate text-[11px] text-white/35">
                    {emp.title}
                    {secondary ? ` · ${secondary}` : ""}
                  </span>
                </span>
                <span className="relative z-[1] shrink-0 text-right">
                  <span className="block font-mono text-xs tabular-nums text-white/70">
                    {compactNumber(value)}
                  </span>
                  <span className="block text-[10px] uppercase tracking-wide text-white/30">
                    {metric === "followers" ? "followers" : "connections"}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
