"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { AnalyticsBreakdownRow } from "@/lib/analytics";
import { compactNumber } from "@/lib/graphUtils";
import { reactionColor, REACTION_EMOJI, REACTION_TITLE } from "@/lib/reactions";

interface Props {
  rows: AnalyticsBreakdownRow[];
  className?: string;
}

const SIZE = 220;

function reactionLabel(id: string): string {
  const upper = id.trim().toUpperCase();
  return REACTION_TITLE[upper] ?? id;
}

export default function D3DonutChart({ rows, className = "" }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const data = useMemo(() => rows.filter((row) => row.value > 0), [rows]);
  const total = useMemo(() => d3.sum(data, (d) => d.value), [data]);
  const hovered = data.find((row) => row.id === hoverId) ?? null;

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    el.replaceChildren();
    if (data.length === 0) return;

    const radius = SIZE / 2 - 10;
    const pie = d3
      .pie<AnalyticsBreakdownRow>()
      .value((d) => d.value)
      .sort(null)
      .padAngle(0.02);
    const slices = pie(data);
    const arc = (outer: number) =>
      d3
        .arc<d3.PieArcDatum<AnalyticsBreakdownRow>>()
        .innerRadius(radius * 0.58)
        .outerRadius(outer);

    const svg = d3
      .select(el)
      .append("svg")
      .attr("viewBox", `0 0 ${SIZE} ${SIZE}`)
      .attr("class", "mx-auto block")
      .attr("role", "img")
      .attr("aria-label", "Reaction mix");

    const g = svg
      .append("g")
      .attr("transform", `translate(${SIZE / 2},${SIZE / 2})`);

    const paths = g
      .selectAll("path")
      .data(slices)
      .join("path")
      .attr(
        "d",
        (d) => arc(d.data.id === hoverId ? radius + 7 : radius)(d) ?? "",
      )
      .attr("fill", (d) => reactionColor(d.data.id))
      .attr("fill-opacity", (d) =>
        hoverId && d.data.id !== hoverId ? 0.28 : 1,
      )
      .attr("stroke", (d) =>
        d.data.id === hoverId ? "#161A17" : "transparent",
      )
      .attr("stroke-width", (d) => (d.data.id === hoverId ? 1.5 : 0))
      .style("cursor", "pointer")
      .style("transition", "fill-opacity 120ms ease");

    paths
      .on("mouseenter", (_, d) => setHoverId(d.data.id))
      .on("mouseleave", () => setHoverId(null));

    const center = hovered ?? {
      id: "all",
      label: "reactions",
      value: total,
    };
    const percent =
      hovered && total > 0
        ? `${Math.round((hovered.value / total) * 100)}%`
        : "total";

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", hovered ? "-0.35em" : "-0.1em")
      .attr("fill", "#161A17")
      .attr("font-size", 16)
      .attr("font-weight", 600)
      .text(compactNumber(center.value));

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.15em")
      .attr("fill", "#5E665F")
      .attr("font-size", 10)
      .text(
        hovered
          ? `${REACTION_EMOJI[hovered.id.toUpperCase()] ?? ""} ${reactionLabel(hovered.id)} · ${percent}`
          : "reactions",
      );
  }, [data, hoverId, hovered, total]);

  if (data.length === 0) return null;

  return (
    <div className={className}>
      <div ref={host} />
      <ul className="mt-2 space-y-0.5 px-3 pb-3">
        {data.slice(0, 8).map((row) => {
          const active = hoverId === row.id;
          const dimmed = hoverId != null && !active;
          const share = total > 0 ? Math.round((row.value / total) * 100) : 0;
          return (
            <li key={row.id}>
              <button
                type="button"
                onMouseEnter={() => setHoverId(row.id)}
                onMouseLeave={() => setHoverId(null)}
                onFocus={() => setHoverId(row.id)}
                onBlur={() => setHoverId(null)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left text-[11px] transition ${
                  active
                    ? "bg-[#E7E0D4] text-[#161A17]"
                    : dimmed
                      ? "text-[#5E665F]/70"
                      : "text-[#5E665F] hover:bg-[#F3EEE4]"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: reactionColor(row.id) }}
                  />
                  <span className="truncate">
                    {REACTION_EMOJI[row.id.toUpperCase()] ?? ""}{" "}
                    {reactionLabel(row.id)}
                  </span>
                </span>
                <span className="shrink-0 font-mono tabular-nums text-[#161A17]/85">
                  {compactNumber(row.value)}
                  <span className="ml-1 text-[#5E665F]/80">{share}%</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
