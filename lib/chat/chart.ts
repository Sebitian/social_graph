import { parseEventMs } from "@/lib/analytics";
import type { ChatChart, ChatChartPoint, ChatChartSeries } from "./types";

const MAX_SERIES = 4;
const MAX_POINTS = 40;

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asPoint(value: unknown): ChatChartPoint | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const v = asNumber(rec.v ?? rec.value ?? rec.y);
  if (v == null) return null;
  const labelRaw = rec.label ?? rec.x ?? rec.date;
  const label =
    typeof labelRaw === "string" && labelRaw.trim()
      ? labelRaw.trim()
      : typeof rec.t === "number"
        ? new Date(rec.t).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })
        : "";
  if (!label) return null;
  const t = parseEventMs(
    (rec.t ?? rec.time ?? rec.timestamp ?? rec.date) as string | number | null,
  );
  return { t, label, v };
}

function asSeries(value: unknown, index: number): ChatChartSeries | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const rawPoints = Array.isArray(rec.points)
    ? rec.points
    : Array.isArray(rec.data)
      ? rec.data
      : [];
  const points = rawPoints
    .map(asPoint)
    .filter((p): p is ChatChartPoint => p != null)
    .slice(0, MAX_POINTS);
  if (points.length < 2) return null;
  const id =
    typeof rec.id === "string" && rec.id.trim()
      ? rec.id.trim()
      : typeof rec.key === "string" && rec.key.trim()
        ? rec.key.trim()
        : `series_${index}`;
  const label =
    typeof rec.label === "string" && rec.label.trim()
      ? rec.label.trim()
      : id;
  const color =
    typeof rec.color === "string" && rec.color.trim()
      ? rec.color.trim()
      : undefined;
  return { id, label, color, points };
}

export function parseChatChart(value: unknown): ChatChart | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const rawSeries = Array.isArray(rec.series)
    ? rec.series
    : rec.points
      ? [{ id: "series", label: rec.yLabel ?? "Value", points: rec.points }]
      : [];
  const series = rawSeries
    .map(asSeries)
    .filter((row): row is ChatChartSeries => row != null)
    .slice(0, MAX_SERIES);
  if (series.length === 0) return null;
  return {
    title: typeof rec.title === "string" ? rec.title.trim() || null : null,
    caption: typeof rec.caption === "string" ? rec.caption.trim() || null : null,
    yLabel: typeof rec.yLabel === "string" ? rec.yLabel.trim() || null : null,
    series,
  };
}

export function chartFromToolPart(part: {
  state?: string;
  input?: unknown;
  output?: unknown;
}): ChatChart | null {
  if (part.state === "output-available") {
    return parseChatChart(part.output) ?? parseChatChart(part.input);
  }
  return parseChatChart(part.input);
}
