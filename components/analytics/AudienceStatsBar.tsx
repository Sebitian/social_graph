"use client";

import { compactNumber } from "@/lib/graphUtils";
import type { AbsoluteDelta, AudienceStatItem } from "@/lib/analytics";

interface Props {
  items: AudienceStatItem[];
  className?: string;
}

function AbsDeltaBadge({ delta }: { delta: AbsoluteDelta }) {
  if (delta.abs == null) return null;
  const n = delta.abs;
  const tone =
    n > 0
      ? "bg-[#0F766E]/10 text-[#0F766E]"
      : n < 0
        ? "bg-[#9B3A4A]/10 text-[#9B3A4A]"
        : "bg-[#E7E0D4] text-[#5E665F]";
  const sign = n > 0 ? "+" : "";
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${tone}`}
    >
      {sign}
      {n}
    </span>
  );
}

export default function AudienceStatsBar({ items, className = "" }: Props) {
  if (items.length === 0) return null;

  return (
    <div
      className={`grid gap-2 ${
        items.length === 1 ? "grid-cols-1" : "grid-cols-2"
      } ${className}`}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl border border-[#D5CDBF] bg-[#FBF8F2] px-3 py-2.5 sm:px-4"
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium tracking-wide text-[#5E665F]">
              {item.label}
            </span>
            <AbsDeltaBadge delta={item.delta} />
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold tracking-tight tabular-nums text-[#161A17] sm:text-[1.75rem]">
            {compactNumber(item.value)}
          </div>
        </div>
      ))}
    </div>
  );
}
