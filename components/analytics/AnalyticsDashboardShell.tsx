"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { ChartPoint } from "@/lib/analytics";
import KpiStrip, { type KpiItem } from "@/components/analytics/KpiStrip";
import AnalyticsChart from "@/components/analytics/AnalyticsChart";
import BreakdownCard, {
  type BreakdownTab,
  type BreakdownRow,
} from "@/components/analytics/BreakdownCard";

export interface DashboardMetric extends KpiItem {
  /** Time-series / bar points. Ignored when `chart` is provided. */
  series?: ChartPoint[];
  /** Custom chart body for this KPI (map, logos, ranking, etc.). */
  chart?: ReactNode;
  chartMode?: "line" | "bars";
}

interface Props {
  metrics: DashboardMetric[];
  /** Initial / controlled selected metric id. */
  defaultMetricId?: string;
  accent?: string;
  chartMode?: "line" | "bars";
  chartEmptyLabel?: string;
  /** Primary widget (often tabbed). */
  primary?: { tabs: BreakdownTab[] } | { rows: BreakdownRow[]; title: string; valueHeader?: string; empty?: string };
  /** Secondary widget. */
  secondary?: { tabs: BreakdownTab[] } | { rows: BreakdownRow[]; title: string; valueHeader?: string; empty?: string };
  /** Optional third widget (full or half width). */
  tertiary?: { tabs: BreakdownTab[] } | { rows: BreakdownRow[]; title: string; valueHeader?: string; empty?: string };
  footer?: ReactNode;
  className?: string;
}

function renderCard(
  card:
    | { tabs: BreakdownTab[] }
    | { rows: BreakdownRow[]; title: string; valueHeader?: string; empty?: string }
    | undefined,
) {
  if (!card) return null;
  if ("tabs" in card) {
    return <BreakdownCard tabs={card.tabs} />;
  }
  return (
    <BreakdownCard
      title={card.title}
      rows={card.rows}
      valueHeader={card.valueHeader}
      empty={card.empty}
    />
  );
}

export default function AnalyticsDashboardShell({
  metrics,
  defaultMetricId,
  accent = "#60a5fa",
  chartMode = "line",
  chartEmptyLabel,
  primary,
  secondary,
  tertiary,
  footer,
  className = "",
}: Props) {
  const initial =
    defaultMetricId && metrics.some((m) => m.id === defaultMetricId)
      ? defaultMetricId
      : (metrics[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState(initial);

  useEffect(() => {
    if (!metrics.some((m) => m.id === selectedId)) {
      setSelectedId(metrics[0]?.id ?? "");
    }
  }, [metrics, selectedId]);

  const selected = metrics.find((m) => m.id === selectedId) ?? metrics[0];

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
        <KpiStrip
          items={metrics}
          selectedId={selected?.id ?? ""}
          onSelect={setSelectedId}
        />
        {selected?.chart != null ? (
          selected.chart
        ) : (
          <AnalyticsChart
            points={selected?.series ?? []}
            accent={accent}
            mode={selected?.chartMode ?? chartMode}
            emptyLabel={chartEmptyLabel}
          />
        )}
      </div>

      {(primary || secondary) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {renderCard(primary)}
          {renderCard(secondary)}
        </div>
      )}

      {tertiary ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {renderCard(tertiary)}
        </div>
      ) : null}

      {footer}
    </div>
  );
}
