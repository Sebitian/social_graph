"use client";

import { useLayoutEffect, useRef } from "react";
import * as d3 from "d3";
import type { ActivityDay } from "@/lib/analytics";
import { compactNumber } from "@/lib/graphUtils";

interface Props {
  days: ActivityDay[];
  accent?: string;
  className?: string;
}

const CELL = 12;
const GAP = 3;
const PAD = { top: 22, right: 8, bottom: 8, left: 28 };

export default function D3CalendarChart({
  days,
  accent = "#E1306C",
  className = "",
}: Props) {
  const host = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    el.replaceChildren();
    if (days.length === 0) return;

    const values = new Map(
      days.map((d) => [d.t, d.comments + d.posts] as const),
    );
    const max = Math.max(...values.values(), 1);
    const color = d3
      .scaleSequential(d3.interpolateRgb("rgba(22,26,23,0.08)", accent))
      .domain([0, max]);

    const start = d3.utcDay.floor(new Date(days[0].t));
    const end = d3.utcDay.offset(
      d3.utcDay.floor(new Date(days[days.length - 1].t)),
      1,
    );
    const allDays = d3.utcDays(start, end);
    const weeks = d3.utcMonday.count(start, end) + 1;
    const width = PAD.left + PAD.right + weeks * (CELL + GAP);
    const height = PAD.top + PAD.bottom + 7 * (CELL + GAP);

    const svg = d3
      .select(el)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("class", "block w-full")
      .attr("role", "img")
      .attr("aria-label", "Activity calendar");

    const x = (date: Date) =>
      PAD.left + d3.utcMonday.count(start, date) * (CELL + GAP);
    const y = (date: Date) =>
      PAD.top + ((date.getUTCDay() + 6) % 7) * (CELL + GAP);

    const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    svg
      .selectAll("text.dow")
      .data([0, 2, 4])
      .join("text")
      .attr("x", PAD.left - 6)
      .attr("y", (d) => PAD.top + d * (CELL + GAP) + CELL - 2)
      .attr("text-anchor", "end")
      .attr("fill", "#5E665F")
      .attr("font-size", 9)
      .text((d) => weekday[d]);

    const months = d3.utcMonths(start, end);
    svg
      .selectAll("text.month")
      .data(months)
      .join("text")
      .attr("x", (d) => x(d))
      .attr("y", 12)
      .attr("fill", "#5E665F")
      .attr("font-size", 10)
      .text((d) => d3.utcFormat("%b")(d));

    svg
      .selectAll("rect.day")
      .data(allDays)
      .join("rect")
      .attr("x", (d) => x(d))
      .attr("y", (d) => y(d))
      .attr("width", CELL)
      .attr("height", CELL)
      .attr("rx", 2)
      .attr("fill", (d) => color(values.get(d.getTime()) ?? 0))
      .append("title")
      .text((d) => {
        const row = days.find((day) => day.t === d.getTime());
        const label = d3.utcFormat("%b %-d, %Y")(d);
        if (!row) return label;
        return `${label}\n${compactNumber(row.comments)} comments · ${compactNumber(row.posts)} posts`;
      });
  }, [days, accent]);

  if (days.length === 0) {
    return (
      <div
        className={`flex h-[140px] items-center justify-center text-sm text-[#5E665F]/80 ${className}`}
      >
        No dated activity in this range
      </div>
    );
  }

  return (
    <div ref={host} className={`overflow-x-auto px-3 py-2 ${className}`} />
  );
}
