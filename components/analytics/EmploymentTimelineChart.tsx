"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

/** Evenly spaced year labels that never crowd (esp. near "now" on phones). */
function yearTicks(
  minMs: number,
  maxMs: number,
  trackWidthPx: number,
): number[] {
  const startYear = new Date(minMs).getUTCFullYear();
  const endYear = new Date(maxMs).getUTCFullYear();
  if (endYear <= startYear) return [startYear];

  // ~34px per "2025" label with padding; leave room on narrow tracks
  const labelW = 34;
  const maxLabels = Math.max(
    3,
    Math.min(6, Math.floor(trackWidthPx / labelW) || 3),
  );

  const spanYears = endYear - startYear;
  const step = Math.max(1, Math.ceil(spanYears / (maxLabels - 1)));

  const ticks: number[] = [];
  for (let y = startYear; y < endYear; y += step) {
    ticks.push(y);
  }

  // Prefer showing the current/end year; drop the previous tick if too close
  const minGapYears = Math.max(1, Math.floor(step * 0.75));
  const last = ticks[ticks.length - 1];
  if (last == null) {
    ticks.push(endYear);
  } else if (endYear - last >= minGapYears) {
    ticks.push(endYear);
  } else {
    ticks[ticks.length - 1] = endYear;
  }

  return ticks;
}

function labelAlign(leftPct: number): string {
  if (leftPct <= 8) return "translateX(0%)";
  if (leftPct >= 92) return "translateX(-100%)";
  return "translateX(-50%)";
}

export default function EmploymentTimelineChart({
  employees,
  accent = "#0A66C2",
  className = "",
}: Props) {
  const now = Date.now();
  const axisRef = useRef<HTMLDivElement | null>(null);
  const [trackWidth, setTrackWidth] = useState(280);

  useEffect(() => {
    const el = axisRef.current;
    if (!el) return;
    const update = () => setTrackWidth(el.clientWidth || 280);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    return { minMs, maxMs, ticks: yearTicks(minMs, maxMs, trackWidth) };
  }, [employees, now, trackWidth]);

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
        <div ref={axisRef} className="relative h-4 flex-1">
          {ticks.map((year) => {
            const left = ((Date.UTC(year, 0, 1) - minMs) / span) * 100;
            if (left < -2 || left > 102) return null;
            const clamped = Math.min(100, Math.max(0, left));
            return (
              <span
                key={year}
                className="absolute font-mono text-[10px] tabular-nums text-white/30"
                style={{
                  left: `${clamped}%`,
                  transform: labelAlign(clamped),
                }}
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
