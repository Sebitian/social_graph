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

export default function KpiStrip({
  items,
  selectedId,
  onSelect,
  className = "",
}: Props) {
  return (
    <div
      className={`flex gap-0 overflow-x-auto border-b border-white/10 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
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
            className={`relative min-w-[7.5rem] flex-1 px-3 py-3 text-left transition sm:min-w-0 sm:px-4 ${
              selected ? "text-white" : "text-white/55 hover:text-white/80"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium tracking-wide">
                {item.label}
              </span>
              <DeltaBadge delta={item.delta} />
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold tracking-tight tabular-nums sm:text-[1.75rem]">
              {item.value}
            </div>
            <span
              className={`absolute inset-x-3 bottom-0 h-[2px] rounded-full transition ${
                selected ? "bg-white" : "bg-transparent"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
