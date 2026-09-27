"use client";

import { useId, useMemo, useRef, useState } from "react";
import { compactNumber } from "@/lib/graphUtils";
import type { ChatChart, ChatChartSeries } from "@/lib/chat/types";

const WIDTH = 520;
const HEIGHT = 196;
const PAD = { top: 16, right: 14, bottom: 28, left: 38 };
const COLORS = ["#0F766E", "#E11D48", "#F59E0B", "#4F46E5"];
const RANGES = [
  { id: "7d", label: "7D", ms: 7 * 86_400_000 },
  { id: "30d", label: "1M", ms: 30 * 86_400_000 },
  { id: "90d", label: "3M", ms: 90 * 86_400_000 },
  { id: "all", label: "All", ms: null },
] as const;

type RangeId = (typeof RANGES)[number]["id"];

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

function seriesColor(series: ChatChartSeries, index: number): string {
  return series.color || COLORS[index % COLORS.length];
}

interface Props {
  chart: ChatChart;
}

export default function ChatTimeChart({ chart }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gradientId = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [range, setRange] = useState<RangeId>("all");

  const visibleSeries = chart.series.filter((s) => !hidden.has(s.id));
  const activeSeries = visibleSeries.length > 0 ? visibleSeries : chart.series;

  const timestamps = chart.series.flatMap((s) =>
    s.points.map((p) => p.t).filter((t): t is number => typeof t === "number"),
  );
  const hasTime = timestamps.length >= 4;
  const maxT = hasTime ? Math.max(...timestamps) : 0;
  const minT = hasTime ? Math.min(...timestamps) : 0;
  const span = maxT - minT;
  const showRanges = hasTime && span > 7 * 86_400_000;

  const axis = useMemo(() => {
    const cutoff =
      range === "all" || !hasTime
        ? null
        : maxT - (RANGES.find((r) => r.id === range)?.ms ?? 0);

    const keys: { key: string; label: string; t: number | null }[] = [];
    const seen = new Set<string>();
    for (const series of activeSeries) {
      for (const point of series.points) {
        if (cutoff != null && (point.t == null || point.t < cutoff)) continue;
        const key = point.t != null ? String(point.t) : point.label;
        if (seen.has(key)) continue;
        seen.add(key);
        keys.push({ key, label: point.label, t: point.t ?? null });
      }
    }
    keys.sort((a, b) => {
      if (a.t != null && b.t != null) return a.t - b.t;
      return 0;
    });
    return keys;
  }, [activeSeries, hasTime, maxT, range]);

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const valuesBySeries = useMemo(() => {
    const maps = new Map<string, Map<string, number>>();
    for (const series of activeSeries) {
      const map = new Map<string, number>();
      for (const point of series.points) {
        map.set(point.t != null ? String(point.t) : point.label, point.v);
      }
      maps.set(series.id, map);
    }
    return maps;
  }, [activeSeries]);

  const maxY = useMemo(() => {
    let max = 0;
    for (const series of activeSeries) {
      const map = valuesBySeries.get(series.id);
      for (const slot of axis) {
        const v = map?.get(slot.key) ?? 0;
        if (v > max) max = v;
      }
    }
    return niceMax(max);
  }, [activeSeries, axis, valuesBySeries]);

  const yTicks = useMemo(
    () => [...new Set([0, 0.5, 1].map((t) => Math.round(maxY * t)))],
    [maxY],
  );

  const xOf = (i: number) =>
    axis.length <= 1
      ? PAD.left + innerW / 2
      : PAD.left + (i / (axis.length - 1)) * innerW;

  const yOf = (v: number) => PAD.top + innerH - (v / maxY) * innerH;

  const paths = activeSeries.map((series) => {
    const map = valuesBySeries.get(series.id);
    const color = seriesColor(
      series,
      Math.max(0, chart.series.findIndex((row) => row.id === series.id)),
    );
    const coords = axis.map((slot, i) => ({
      x: xOf(i),
      y: yOf(map?.get(slot.key) ?? 0),
      v: map?.get(slot.key) ?? 0,
    }));
    const line = coords
      .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(" ");
    const area = `${line} L ${coords[coords.length - 1]?.x.toFixed(1) ?? PAD.left} ${(PAD.top + innerH).toFixed(1)} L ${coords[0]?.x.toFixed(1) ?? PAD.left} ${(PAD.top + innerH).toFixed(1)} Z`;
    return { series, color, coords, line, area };
  });

  function onMove(clientX: number) {
    const svg = svgRef.current;
    if (!svg || axis.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * WIDTH;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < axis.length; i++) {
      const d = Math.abs(xOf(i) - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    setHover(best);
  }

  const hoverSlot = hover != null ? axis[hover] : null;
  const hoverX = hover != null ? xOf(hover) : 0;

  return (
    <figure className="overflow-hidden rounded-xl border border-[#D5CDBF] bg-[#FBF8F2]">
      <div className="flex items-center justify-between gap-2 border-b border-[#D5CDBF] px-3 py-2">
        <figcaption className="min-w-0 truncate text-[11px] font-semibold text-[#5E665F]">
          {chart.title || chart.yLabel || "Trend"}
        </figcaption>
        {showRanges ? (
          <div className="flex shrink-0 gap-0.5 rounded-lg border border-[#D5CDBF] bg-[#F3EEE4] p-0.5">
            {RANGES.filter(
              (item) => item.id === "all" || span >= (item.ms ?? 0),
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setRange(item.id)}
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                  range === item.id
                    ? "bg-[#0F766E]/10 text-[#0F766E]"
                    : "text-[#5E665F] hover:text-[#161A17]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {axis.length < 2 ? (
        <div className="flex h-[196px] items-center justify-center text-xs text-[#5E665F]">
          Not enough dated points to chart.
        </div>
      ) : (
        <div
          className="relative cursor-crosshair px-1 pt-1"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(event) => onMove(event.clientX)}
          onTouchStart={(event) => onMove(event.touches[0]?.clientX ?? 0)}
          onTouchMove={(event) => onMove(event.touches[0]?.clientX ?? 0)}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="block h-[196px] w-full"
            role="img"
            aria-label={chart.title || "Time series chart"}
          >
            <defs>
              {paths.map((path, i) => (
                <linearGradient
                  key={path.series.id}
                  id={`${gradientId}-${i}`}
                  x1="0"
                  y1={PAD.top}
                  x2="0"
                  y2={PAD.top + innerH}
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor={path.color} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={path.color} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>
            {yTicks.map((tick) => {
              const y = yOf(tick);
              return (
                <g key={`y-${tick}`}>
                  <line
                    x1={PAD.left}
                    x2={WIDTH - PAD.right}
                    y1={y}
                    y2={y}
                    stroke="rgba(22,26,23,0.08)"
                  />
                  <text
                    x={PAD.left - 6}
                    y={y + 3}
                    textAnchor="end"
                    className="fill-[#161A17]/40"
                    style={{ fontSize: 10 }}
                  >
                    {compactNumber(tick)}
                  </text>
                </g>
              );
            })}

            {paths.map((path, i) => (
              <g key={path.series.id}>
                <path
                  d={path.area}
                  fill={`url(#${gradientId}-${i})`}
                  opacity={0.9}
                />
                <path
                  d={path.line}
                  fill="none"
                  stroke={path.color}
                  strokeWidth={2.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            ))}

            {hoverSlot ? (
              <>
                <line
                  x1={hoverX}
                  x2={hoverX}
                  y1={PAD.top}
                  y2={PAD.top + innerH}
                  stroke="rgba(22,26,23,0.15)"
                  strokeWidth={1}
                />
                {paths.map((path) => {
                  const c = path.coords[hover ?? 0];
                  if (!c) return null;
                  return (
                    <circle
                      key={`dot-${path.series.id}`}
                      cx={c.x}
                      cy={c.y}
                      r={4}
                      fill={path.color}
                      stroke="rgba(255,255,255,0.9)"
                      strokeWidth={1.25}
                    />
                  );
                })}
              </>
            ) : null}

            {axis.map((slot, i) => {
              const step = axis.length > 8 ? Math.ceil(axis.length / 6) : 1;
              if (i % step !== 0 && i !== axis.length - 1) return null;
              return (
                <text
                  key={`x-${slot.key}`}
                  x={xOf(i)}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className="fill-[#161A17]/40"
                  style={{ fontSize: 10 }}
                >
                  {slot.label}
                </text>
              );
            })}
          </svg>

          {hoverSlot ? (
            <div
              className="pointer-events-none absolute top-2 z-10 min-w-[120px] rounded-lg border border-[#D5CDBF] bg-[#FBF8F2] px-2.5 py-1.5 text-xs shadow-lg"
              style={{
                left: `clamp(8px, ${(hoverX / WIDTH) * 100}% - 60px, calc(100% - 132px))`,
              }}
            >
              <div className="text-[10px] text-[#5E665F]">{hoverSlot.label}</div>
              {paths.map((path) => {
                const v = valuesBySeries.get(path.series.id)?.get(hoverSlot.key) ?? 0;
                return (
                  <div
                    key={path.series.id}
                    className="mt-0.5 flex items-center justify-between gap-3 font-mono text-[11px] text-[#161A17]"
                  >
                    <span className="flex items-center gap-1.5 font-sans text-[#5E665F]">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: path.color }}
                      />
                      {path.series.label}
                    </span>
                    {compactNumber(v)}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      )}

      {chart.series.length > 1 ? (
        <div className="flex flex-wrap gap-1.5 border-t border-[#D5CDBF] px-3 py-2">
          {chart.series.map((series, index) => {
            const on = !hidden.has(series.id);
            const color = seriesColor(series, index);
            return (
              <button
                key={series.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setHidden((prev) => {
                    const next = new Set(prev);
                    if (next.has(series.id)) next.delete(series.id);
                    else if (next.size < chart.series.length - 1) next.add(series.id);
                    return next;
                  });
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] ${
                  on
                    ? "border-[#D5CDBF] bg-[#F3EEE4] text-[#161A17]"
                    : "border-[#D5CDBF]/60 text-[#5E665F]/70"
                }`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: on ? color : "rgba(22,26,23,0.2)" }}
                />
                {series.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {chart.caption ? (
        <p className="border-t border-[#D5CDBF] px-3 py-1.5 text-[11px] leading-relaxed text-[#5E665F]">
          {chart.caption}
        </p>
      ) : null}
    </figure>
  );
}
