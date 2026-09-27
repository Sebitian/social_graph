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
      className={`inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg border border-[#D5CDBF] bg-[#F3EEE4] p-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
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
            className={`min-h-[32px] shrink-0 rounded-md px-2.5 text-[11px] font-medium transition sm:px-3 ${
              selected
                ? "bg-[#FBF8F2] text-[#161A17] shadow-[0_1px_2px_rgba(22,26,23,0.06)]"
                : "text-[#5E665F] hover:bg-[#E7E0D4] hover:text-[#161A17]"
            } disabled:cursor-default disabled:opacity-40`}
          >
            {range.label}
          </button>
        );
      })}
    </div>
  );
}
