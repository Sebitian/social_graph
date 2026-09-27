"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import type { AnalyticsPostRow } from "@/lib/analytics";
import { compactNumber } from "@/lib/graphUtils";

interface Props {
  posts: AnalyticsPostRow[];
  /** What the bubble number adds up. */
  valueCaption?: string;
  className?: string;
}

const HEIGHT = 280;
const PALETTE = [
  "#E1306C",
  "#F59E0B",
  "#22D3EE",
  "#A855F7",
  "#34D399",
  "#60A5FA",
  "#F472B6",
  "#F97316",
  "#818CF8",
  "#14B8A6",
  "#FACC15",
  "#FB7185",
];

function colorForId(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function isReel(post: AnalyticsPostRow): boolean {
  return (post.postType ?? "").toLowerCase() === "reel";
}

export default function D3PackChart({
  posts,
  valueCaption = "comments + reactions",
  className = "",
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const data = useMemo(
    () =>
      posts
        .filter((post) => post.value > 0)
        .slice()
        .sort((a, b) => b.value - a.value)
        .slice(0, 24),
    [posts],
  );

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    el.replaceChildren();
    if (data.length === 0) return;

    const width = Math.max(el.clientWidth || 640, 280);
    type PackNode = {
      id?: string;
      name?: string;
      value?: number;
      group?: string;
      children?: PackNode[];
    };
    const leaves: PackNode[] = data.map((post) => ({
      id: post.id,
      name: post.label,
      value: post.value,
      group: isReel(post) ? "reel" : "post",
    }));
    const root = d3.pack<PackNode>().size([width, HEIGHT]).padding(4)(
      d3.hierarchy<PackNode>({ children: leaves }).sum((d) => d.value ?? 0),
    );

    const svg = d3
      .select(el)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${HEIGHT}`)
      .attr("class", "block w-full")
      .attr("role", "img")
      .attr("aria-label", "Post engagement bubbles");

    const leaf = svg
      .selectAll("g")
      .data(root.leaves())
      .join("g")
      .attr("transform", (d) => `translate(${d.x},${d.y})`);

    leaf
      .append("circle")
      .attr("r", (d) => d.r)
      .attr("fill", (d) => colorForId(d.data.id ?? d.data.name ?? "post"))
      .attr("fill-opacity", 0.88)
      .attr("stroke", "rgba(22,26,23,0.12)")
      .attr("stroke-width", 1);

    leaf
      .append("title")
      .text(
        (d) =>
          `${d.data.name}\n${compactNumber(d.value ?? 0)} · ${valueCaption}`,
      );

    leaf
      .filter((d) => d.r > 18)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "white")
      .attr("font-size", (d) => Math.min(11, d.r / 3.5))
      .attr("pointer-events", "none")
      .text((d) => compactNumber(d.value ?? 0));
  }, [data, valueCaption]);

  if (data.length === 0) {
    return (
      <div
        className={`flex h-[220px] items-center justify-center text-sm text-[#5E665F]/80 ${className}`}
      >
        No posts to pack
      </div>
    );
  }

  const hasReels = data.some(isReel);

  return (
    <div className={className}>
      <p className="px-3 pt-3 text-[11px] leading-relaxed text-[#5E665F]">
        Bigger bubble = more engagement. The number is{" "}
        <span className="text-[#161A17]/85">{valueCaption}</span>.
      </p>
      <div ref={host} />
      <ul className="max-h-48 space-y-1 overflow-y-auto border-t border-[#D5CDBF] px-3 py-2">
        {data.map((post) => (
          <li
            key={post.id}
            className="flex items-center gap-2 text-[11px] text-[#5E665F]"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colorForId(post.id) }}
            />
            <span className="min-w-0 flex-1 truncate" title={post.label}>
              {hasReels ? (isReel(post) ? "Reel · " : "Post · ") : null}
              {post.label}
            </span>
            <span className="shrink-0 font-mono tabular-nums text-[#161A17]/85">
              {compactNumber(post.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
