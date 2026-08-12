"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface Props {
  label: string;
  value: string;
  icon?: ReactNode;
  series?: number[];
  hint?: string;
  className?: string;
}

function Sparkline({ series }: { series: number[] }) {
  if (series.length < 2) return null;
  const max = Math.max(...series, 1);
  const w = 72;
  const h = 24;
  const pts = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * w;
      const y = h - (v / max) * (h - 2) - 1;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="mt-2 overflow-visible text-white/45"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
}

export default function MetricTile({
  label,
  value,
  icon,
  series,
  hint,
  className = "",
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
          {label}
        </div>
        {icon ? <div className="text-white/45">{icon}</div> : null}
      </div>
      <div className="mt-2 font-mono text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[11px] text-white/35">{hint}</div>
      ) : null}
      {series && series.some((n) => n > 0) ? <Sparkline series={series} /> : null}
    </motion.div>
  );
}
