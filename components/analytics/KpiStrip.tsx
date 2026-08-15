"use client";

import type { AnalyticsDelta } from "@/lib/analytics";

export interface KpiItem {
  id: string;
  label: string;
  value: string;
  delta?: AnalyticsDelta;
}

interface Props {
  items: KpiItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}

function DeltaBadge({ delta }: { delta?: AnalyticsDelta }) {
  if (!delta || delta.pct == null) return null;
  const pct = delta.pct;
  const tone =
    pct > 0
      ? "bg-emerald-500/15 text-emerald-300"
      : pct < 0
        ? "bg-rose-500/15 text-rose-300"
        : "bg-white/10 text-white/45";
  const sign = pct > 0 ? "+" : "";
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${tone}`}
    >
      {sign}
      {pct}%
    </span>
  );
}

function gridClass(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-2";
  if (count === 3) return "grid-cols-3";
  return "grid-cols-2 sm:grid-cols-4";
}

export default function KpiStrip({
  items,
  selectedId,
  onSelect,
  className = "",
}: Props) {
  return (
    <div
      className={`grid gap-2 ${gridClass(items.length)} ${className}`}
      role="tablist"
      aria-label="Metrics"
    >
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(item.id)}
            className={`min-w-0 rounded-xl border px-3 py-2.5 text-left transition sm:px-4 ${
              selected
                ? "border-white/25 bg-white/[0.07] text-white"
                : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium tracking-wide text-white/55">
                {item.label}
              </span>
              <DeltaBadge delta={item.delta} />
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold tracking-tight tabular-nums text-white sm:text-[1.75rem]">
              {item.value}
            </div>
          </button>
        );
      })}
    </div>
  );
}
