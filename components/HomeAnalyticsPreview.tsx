"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChartPoint } from "@/lib/analytics";
import AnalyticsChart from "@/components/analytics/AnalyticsChart";
import EmployeeRankChart from "@/components/analytics/EmployeeRankChart";

type KpiId = "comments" | "reactions" | "engagers" | "posts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"] as const;

function series(values: number[]): ChartPoint[] {
  return values.map((v, i) => ({
    t: i,
    label: MONTHS[i],
    v,
    ...(i === values.length - 1 ? { incomplete: true } : {}),
  }));
}

const KPI_SERIES: Record<
  KpiId,
  { label: string; value: string; delta: number; accent: string; points: ChartPoint[] }
> = {
  comments: {
    label: "Comments",
    value: "1.2k",
    delta: 18,
    accent: "#60a5fa",
    points: series([82, 110, 96, 148, 172, 156, 201]),
  },
  reactions: {
    label: "Reactions",
    value: "3.4k",
    delta: 9,
    accent: "#f472b6",
    points: series([210, 248, 265, 302, 340, 318, 390]),
  },
  engagers: {
    label: "Engagers",
    value: "486",
    delta: -4,
    accent: "#a78bfa",
    points: series([64, 71, 68, 80, 77, 74, 69]),
  },
  posts: {
    label: "Posts",
    value: "42",
    delta: 12,
    accent: "#34d399",
    points: series([4, 5, 3, 7, 6, 8, 9]),
  },
};

const KPI_ITEMS = (Object.keys(KPI_SERIES) as KpiId[]).map((id) => ({
  id,
  ...KPI_SERIES[id],
}));

const SAMPLE_EMPLOYEES = [
  {
    id: "1",
    name: "Alex Chen",
    title: "VP Engineering",
    followers: 18400,
    connections: 9200,
    location: "San Francisco",
    linkedinUrl: "#",
    value: 18400,
  },
  {
    id: "2",
    name: "Jordan Lee",
    title: "Head of Growth",
    followers: 12100,
    connections: 7800,
    location: "New York",
    linkedinUrl: "#",
    value: 12100,
  },
  {
    id: "3",
    name: "Sam Rivera",
    title: "Principal Scientist",
    followers: 9600,
    connections: 5400,
    location: "Boston",
    linkedinUrl: "#",
    value: 9600,
  },
  {
    id: "4",
    name: "Taylor Brooks",
    title: "Director, Ops",
    followers: 7200,
    connections: 6100,
    location: "Austin",
    linkedinUrl: "#",
    value: 7200,
  },
  {
    id: "5",
    name: "Casey Ng",
    title: "Staff Designer",
    followers: 5400,
    connections: 3900,
    location: "Seattle",
    linkedinUrl: "#",
    value: 5400,
  },
];

export default function HomeAnalyticsPreview() {
  const [kpiId, setKpiId] = useState<KpiId>("comments");
  const selected = KPI_SERIES[kpiId];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
      {/* Engagement trends */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
        <div
          className="flex gap-0 overflow-x-auto border-b border-white/10 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Metrics"
        >
          {KPI_ITEMS.map((item) => {
            const isSelected = item.id === kpiId;
            const positive = item.delta > 0;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setKpiId(item.id)}
                className={`relative min-w-[6.75rem] flex-1 px-3 py-3.5 text-left transition sm:min-w-0 sm:px-4 ${
                  isSelected ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">
                  {item.label}
                  <span
                    className={`tabular-nums ${
                      positive ? "text-emerald-400/80" : "text-rose-400/80"
                    }`}
                  >
                    {positive ? "+" : ""}
                    {item.delta}%
                  </span>
                </div>
                <div className="mt-1 font-mono text-xl font-semibold tracking-tight text-white">
                  {item.value}
                </div>
                {isSelected && (
                  <motion.span
                    layoutId="home-kpi-underline"
                    className="absolute inset-x-3 bottom-0 h-0.5 rounded-full"
                    style={{ backgroundColor: item.accent }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
              </button>
            );
          })}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={kpiId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            <AnalyticsChart points={selected.points} accent={selected.accent} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Employee reach */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
        <div className="border-b border-white/10 px-4 py-3.5 sm:px-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
            Top by followers
          </p>
          <p className="mt-1 font-mono text-xl font-semibold tracking-tight text-white">
            Company roster
          </p>
        </div>
        <EmployeeRankChart
          employees={SAMPLE_EMPLOYEES}
          metric="followers"
          accent="#0A66C2"
        />
      </div>
    </div>
  );
}
