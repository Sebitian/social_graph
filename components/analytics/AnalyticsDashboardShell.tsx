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
  /** Optional labeled KPI groups (Instagram posts vs reels). */
  metricGroups?: { label: string; items: DashboardMetric[] }[];
  /** Initial / controlled selected metric id. */
  defaultMetricId?: string;
  accent?: string;
  chartMode?: "line" | "bars";
  chartEmptyLabel?: string;
  /** Static audience totals (followers / following) above the chart KPIs. */
  audience?: ReactNode;
  /** Primary widget (often tabbed). */
  primary?:
    | {
        tabs: BreakdownTab[];
        searchable?: boolean;
        searchPlaceholder?: string;
      }
    | {
        rows: BreakdownRow[];
        title: string;
        valueHeader?: string;
        empty?: string;
        searchable?: boolean;
        searchPlaceholder?: string;
      };
  /** Secondary widget. */
  secondary?:
    | {
        tabs: BreakdownTab[];
        searchable?: boolean;
        searchPlaceholder?: string;
      }
    | {
        rows: BreakdownRow[];
        title: string;
        valueHeader?: string;
        empty?: string;
        searchable?: boolean;
        searchPlaceholder?: string;
      };
  /** Optional third widget (full or half width). */
  tertiary?:
    | {
        tabs: BreakdownTab[];
        searchable?: boolean;
        searchPlaceholder?: string;
      }
    | {
        rows: BreakdownRow[];
        title: string;
        valueHeader?: string;
        empty?: string;
        searchable?: boolean;
        searchPlaceholder?: string;
      };
  footer?: ReactNode;
  className?: string;
}

type CardConfig =
  | {
      tabs: BreakdownTab[];
      searchable?: boolean;
      searchPlaceholder?: string;
    }
  | {
      rows: BreakdownRow[];
      title: string;
      valueHeader?: string;
      empty?: string;
      searchable?: boolean;
      searchPlaceholder?: string;
    };

function renderCard(card: CardConfig | undefined, searchableDefault = true) {
  if (!card) return null;
  const searchable = card.searchable ?? searchableDefault;
  if ("tabs" in card) {
    return (
      <BreakdownCard
        tabs={card.tabs}
        searchable={searchable}
        searchPlaceholder={card.searchPlaceholder}
      />
    );
  }
  return (
    <BreakdownCard
      title={card.title}
      rows={card.rows}
      valueHeader={card.valueHeader}
      empty={card.empty}
      searchable={searchable}
      searchPlaceholder={card.searchPlaceholder}
    />
  );
}

export default function AnalyticsDashboardShell({
  metrics,
  metricGroups,
  defaultMetricId,
  accent = "#60a5fa",
  chartMode = "line",
  chartEmptyLabel,
  audience,
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
    if (defaultMetricId) setSelectedId(defaultMetricId);
  }, [defaultMetricId]);

  useEffect(() => {
    if (!metrics.some((m) => m.id === selectedId)) {
      setSelectedId(metrics[0]?.id ?? "");
    }
  }, [metrics, selectedId]);

  const selected = metrics.find((m) => m.id === selectedId) ?? metrics[0];
  const grouped = (metricGroups ?? []).filter((group) => group.items.length > 0);

  const chart = selected?.chart != null ? (
    selected.chart
  ) : (
    <AnalyticsChart
      points={selected?.series ?? []}
      accent={accent}
      mode={selected?.chartMode ?? chartMode}
      emptyLabel={chartEmptyLabel}
    />
  );

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {audience}

      {grouped.length > 0 ? (
        grouped.map((group) => (
          <div key={group.label} className="flex flex-col gap-2">
            <div className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">
              {group.label}
            </div>
            <KpiStrip
              items={group.items}
              selectedId={selected?.id ?? ""}
              onSelect={setSelectedId}
            />
          </div>
        ))
      ) : (
        <KpiStrip
          items={metrics}
          selectedId={selected?.id ?? ""}
          onSelect={setSelectedId}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
        {chart}
      </div>

      {(primary || secondary) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {renderCard(primary)}
          {renderCard(secondary)}
        </div>
      )}

      {tertiary ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {renderCard(tertiary, false)}
        </div>
      ) : null}

      {footer}
    </div>
  );
}
