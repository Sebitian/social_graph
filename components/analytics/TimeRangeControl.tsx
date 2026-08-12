"use client";

import {
  ANALYTICS_RANGES,
  type AnalyticsRangeId,
} from "@/lib/analytics";

interface Props {
  value: AnalyticsRangeId;
  onChange: (range: AnalyticsRangeId) => void;
  disabled?: boolean;
  className?: string;
}

export default function TimeRangeControl({
  value,
  onChange,
  disabled = false,
  className = "",
}: Props) {
  return (
    <div
      className={`-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      role="tablist"
      aria-label="Time range"
    >
      {ANALYTICS_RANGES.map((range) => {
        const selected = value === range.id;
        return (
          <button
            key={range.id}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => onChange(range.id)}
            className={`min-h-[36px] shrink-0 rounded-full px-3 text-xs font-medium transition ${
              selected
                ? "bg-white/15 text-white"
                : "text-white/45 hover:bg-white/10 hover:text-white/75"
            } disabled:cursor-default disabled:opacity-40`}
          >
            {range.label}
          </button>
        );
      })}
    </div>
  );
}
