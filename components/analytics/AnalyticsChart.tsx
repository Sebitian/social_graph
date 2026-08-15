"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChartPoint } from "@/lib/analytics";
import { compactNumber } from "@/lib/graphUtils";

interface Props {
  points: ChartPoint[];
  accent?: string;
  emptyLabel?: string;
  className?: string;
  /** When true, render as discrete bars (company snapshot distributions). */
  mode?: "line" | "bars";
}

const PAD = { top: 16, right: 16, bottom: 28, left: 40 };
const MIN_SLOT_PX = 44;
const MIN_CHART_WIDTH = 320;
const HEIGHT = 220;

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

export default function AnalyticsChart({
  points,
  accent = "#60a5fa",
  emptyLabel = "No data in this range",
  className = "",
  mode = "line",
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [containerW, setContainerW] = useState(0);

  const hasData = points.some((p) => p.v > 0);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setContainerW(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasData, points.length]);

  const width = Math.max(
    MIN_CHART_WIDTH,
    PAD.left + PAD.right + Math.max(points.length, 2) * MIN_SLOT_PX,
    containerW,
  );
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const { maxY, yTicks, pathSolid, pathDash, coords } = useMemo(() => {
    const maxRaw = Math.max(...points.map((p) => p.v), 0);
    const maxY = niceMax(maxRaw);
    const yTicks = [...new Set(
      [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(maxY * t)),
    )];

    const coords = points.map((p, i) => {
      const x =
        points.length <= 1
          ? PAD.left + innerW / 2
          : PAD.left + (i / (points.length - 1)) * innerW;
      const y = PAD.top + innerH - (p.v / maxY) * innerH;
      return { x, y, ...p };
    });

    const complete = coords.filter((c) => !c.incomplete);
    const incompleteStart = coords.findIndex((c) => c.incomplete);

    const toPath = (pts: typeof coords) => {
      if (pts.length === 0) return "";
      return pts
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(" ");
    };

    let pathSolid = toPath(
      incompleteStart > 0 ? coords.slice(0, incompleteStart + 1) : complete,
    );
    let pathDash = "";
    if (incompleteStart >= 0 && incompleteStart < coords.length) {
      const from = Math.max(0, incompleteStart - 1);
      pathDash = toPath(coords.slice(from));
      if (incompleteStart === 0) pathSolid = "";
      else pathSolid = toPath(coords.slice(0, incompleteStart + 1));
    }

    return { maxY, yTicks, pathSolid, pathDash, coords };
  }, [points, innerW, innerH]);

  function onMove(clientX: number) {
    const el = scrollRef.current;
    if (!el || coords.length === 0) return;
    const rect = el.getBoundingClientRect();
    const rel = clientX - rect.left + el.scrollLeft;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const d = Math.abs(coords[i].x - rel);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    setHover(best);
  }

  const hoverLeft =
    hover != null && coords[hover]
      ? coords[hover].x - (scrollRef.current?.scrollLeft ?? 0)
      : 0;

  return (
    <div className={`relative w-full rounded-b-xl ${className}`}>
      {!hasData ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-white/35">
          {emptyLabel}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.25)_transparent]"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => onMove(e.clientX)}
          onTouchStart={(e) => onMove(e.touches[0]?.clientX ?? 0)}
          onTouchMove={(e) => onMove(e.touches[0]?.clientX ?? 0)}
          onScroll={() => setHover(null)}
        >
          <svg
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            className="block h-[220px] max-w-none"
            style={{ minWidth: width }}
            role="img"
            aria-label="Analytics chart"
          >
            {yTicks.map((tick, tickIdx) => {
              const y = PAD.top + innerH - (tick / maxY) * innerH;
              return (
                <g key={`ytick-${tickIdx}-${tick}`}>
                  <line
                    x1={PAD.left}
                    x2={width - PAD.right}
                    y1={y}
                    y2={y}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={1}
                  />
                  <text
                    x={PAD.left - 8}
                    y={y + 3}
                    textAnchor="end"
                    className="fill-white/30"
                    style={{ fontSize: 10 }}
                  >
                    {compactNumber(tick)}
                  </text>
                </g>
              );
            })}

            {mode === "bars"
              ? coords.map((c, i) => {
                  const barW = Math.max(
                    6,
                    innerW / Math.max(points.length, 1) - 10,
                  );
                  const barH = Math.max(0, PAD.top + innerH - c.y);
                  return (
                    <rect
                      key={`bar-${i}`}
                      x={c.x - barW / 2}
                      y={c.y}
                      width={barW}
                      height={barH}
                      rx={3}
                      fill={accent}
                      opacity={hover === i ? 0.95 : 0.55}
                    />
                  );
                })
              : null}

            {mode === "line" && pathSolid ? (
              <path
                d={pathSolid}
                fill="none"
                stroke={accent}
                strokeWidth={2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {mode === "line" && pathDash ? (
              <path
                d={pathDash}
                fill="none"
                stroke={accent}
                strokeWidth={2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="5 4"
                opacity={0.85}
              />
            ) : null}

            {mode === "line"
              ? coords.map((c, i) => (
                  <circle
                    key={`dot-${i}`}
                    cx={c.x}
                    cy={c.y}
                    r={hover === i ? 4 : c.v > 0 ? 2.5 : 0}
                    fill={accent}
                    stroke="rgba(0,0,0,0.5)"
                    strokeWidth={1}
                    opacity={hover === i ? 1 : 0.7}
                  />
                ))
              : null}

            {coords.map((c, i) => {
              const step =
                points.length > 24 ? Math.ceil(points.length / 16) : 1;
              if (i % step !== 0 && i !== coords.length - 1) return null;
              return (
                <text
                  key={`x-${i}`}
                  x={c.x}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className="fill-white/35"
                  style={{ fontSize: 10 }}
                >
                  {c.label}
                </text>
              );
            })}

            {hover != null && coords[hover] ? (
              <line
                x1={coords[hover].x}
                x2={coords[hover].x}
                y1={PAD.top}
                y2={PAD.top + innerH}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            ) : null}
          </svg>
        </div>
      )}

      {hover != null && coords[hover] && hasData ? (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-lg border border-white/15 bg-black/85 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur"
          style={{
            left: `min(max(${hoverLeft}px - 40px, 8px), calc(100% - 100px))`,
          }}
        >
          <div className="text-white/45">{coords[hover].label}</div>
          <div className="font-mono font-semibold text-white">
            {compactNumber(coords[hover].v)}
            {coords[hover].incomplete ? (
              <span className="ml-1 text-[10px] font-normal text-white/40">
                partial
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
