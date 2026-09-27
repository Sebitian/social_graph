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
  accent?: string;
  className?: string;
}

function DeltaBadge({ delta }: { delta?: AnalyticsDelta }) {
  if (!delta || delta.pct == null) return null;
  const pct = delta.pct;
  const tone =
    pct > 0
      ? "bg-[#0F766E]/10 text-[#0F766E]"
      : pct < 0
        ? "bg-[#9B3A4A]/10 text-[#9B3A4A]"
        : "bg-[#E7E0D4] text-[#5E665F]";
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
  accent,
  className = "",
}: Props) {
  return (
    <div
      className={`grid grid-cols-[repeat(auto-fit,minmax(8.75rem,1fr))] gap-2 ${className}`}
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
            className={`relative min-w-0 rounded-2xl border px-3 py-2.5 text-left transition sm:px-4 ${
              selected
                ? "border-[#161A17]/25 bg-[#FBF8F2] text-[#161A17] shadow-[0_8px_24px_rgba(22,26,23,0.06)]"
                : "border-[#D5CDBF] bg-[#FBF8F2] text-[#5E665F] hover:border-[#161A17]/20 hover:text-[#161A17]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium tracking-wide text-[#5E665F]">
                {item.label}
              </span>
              <DeltaBadge delta={item.delta} />
            </div>
            <div className="mt-1 font-mono text-2xl font-semibold tracking-tight tabular-nums text-[#161A17] sm:text-[1.75rem]">
              {item.value}
            </div>
            {selected && accent ? (
              <span
                className="absolute inset-x-3 bottom-0 h-0.5 rounded-full"
                style={{ backgroundColor: accent }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
