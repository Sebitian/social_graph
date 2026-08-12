"use client";

import { useMemo, useState } from "react";
import type { CompanyEmploymentTimelineRow } from "@/lib/analytics";

interface Props {
  employees: CompanyEmploymentTimelineRow[];
  accent?: string;
  className?: string;
}

function Avatar({ name, src }: { name: string; src?: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-7 w-7 rounded-full object-cover ring-1 ring-white/15"
      />
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white/70 ring-1 ring-white/10">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function yearTicks(minMs: number, maxMs: number): number[] {
  const startYear = new Date(minMs).getUTCFullYear();
  const endYear = new Date(maxMs).getUTCFullYear();
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y += 1) years.push(y);
  if (years.length === 1) return years;
  // Thin out if dense
  if (years.length > 8) {
    const step = Math.ceil(years.length / 6);
    return years.filter((y, i) => i === 0 || i === years.length - 1 || i % step === 0);
  }
  return years;
}

export default function EmploymentTimelineChart({
  employees,
  accent = "#0A66C2",
  className = "",
}: Props) {
  const now = Date.now();

  const { minMs, maxMs, ticks } = useMemo(() => {
    if (employees.length === 0) {
      return { minMs: now, maxMs: now, ticks: [] as number[] };
    }
    const starts = employees.map((e) => e.startedAt);
    const min = Math.min(...starts);
    // Pad left a bit so earliest bar isn't flush
    const pad = Math.max(30 * 24 * 60 * 60 * 1000, (now - min) * 0.06);
    const minMs = min - pad;
    const maxMs = now;
    return { minMs, maxMs, ticks: yearTicks(minMs, maxMs) };
  }, [employees, now]);

  if (employees.length === 0) {
    return (
      <div
        className={`flex h-[220px] items-center justify-center px-4 text-sm text-white/35 ${className}`}
      >
        No start dates in this roster
      </div>
    );
  }

  const span = Math.max(maxMs - minMs, 1);

  return (
    <div className={`px-3 py-3 sm:px-4 ${className}`}>
      <div className="mb-2 flex items-end gap-3 pl-[9.5rem] sm:pl-[11.5rem]">
        <div className="relative h-4 flex-1">
          {ticks.map((year) => {
            const left = ((Date.UTC(year, 0, 1) - minMs) / span) * 100;
            if (left < 0 || left > 100) return null;
            return (
              <span
                key={year}
                className="absolute -translate-x-1/2 font-mono text-[10px] text-white/30"
                style={{ left: `${left}%` }}
              >
                {year}
              </span>
            );
          })}
        </div>
      </div>

      <ul className="flex max-h-[260px] flex-col gap-1.5 overflow-y-auto pr-1">
        {employees.map((emp) => {
          const left = ((emp.startedAt - minMs) / span) * 100;
          const width = ((now - emp.startedAt) / span) * 100;
          return (
            <li key={emp.id}>
              <a
                href={emp.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group grid grid-cols-[9rem_1fr] items-center gap-2 rounded-xl px-1 py-1.5 transition hover:bg-white/[0.04] sm:grid-cols-[11rem_1fr] sm:gap-3"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar name={emp.name} src={emp.profilePicUrl} />
                  <span className="min-w-0">
                    <span className="block truncate text-xs text-white/85 group-hover:text-white">
                      {emp.name}
                    </span>
                    <span className="block truncate text-[10px] text-white/35">
                      {emp.startedLabel}
                      {emp.tenure ? ` · ${emp.tenure}` : ""}
                    </span>
                  </span>
                </span>

                <span className="relative h-7 overflow-hidden rounded-md bg-white/[0.03] ring-1 ring-white/[0.04]">
                  {/* year guides */}
                  {ticks.map((year) => {
                    const x = ((Date.UTC(year, 0, 1) - minMs) / span) * 100;
                    if (x < 0 || x > 100) return null;
                    return (
                      <span
                        key={`${emp.id}-${year}`}
                        className="pointer-events-none absolute inset-y-0 w-px bg-white/[0.05]"
                        style={{ left: `${x}%` }}
                        aria-hidden
                      />
                    );
                  })}
                  <span
                    className="absolute inset-y-1 rounded-sm"
                    style={{
                      left: `${Math.max(0, left)}%`,
                      width: `${Math.max(2.5, width)}%`,
                      background: `linear-gradient(90deg, ${accent}55, ${accent})`,
                    }}
                    title={`${emp.title} · started ${emp.startedLabel}`}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center truncate text-[10px] text-white/45">
                    {emp.title}
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
