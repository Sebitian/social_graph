"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
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
  /** Static audience totals (followers / following) above the chart KPIs. */
  audience?: ReactNode;
  /** Optional content rendered under the chart (rank lists, and so on). */
  top?: ReactNode;
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
      }
    | {
        title: string;
        content: ReactNode;
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
      }
    | {
        title: string;
        content: ReactNode;
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
      }
    | {
        title: string;
        content: ReactNode;
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
    }
  | {
      title: string;
      content: ReactNode;
    };

function isContentCard(card: CardConfig): card is { title: string; content: ReactNode } {
  return "content" in card;
}

function renderCard(card: CardConfig | undefined, searchableDefault = true) {
  if (!card) return null;
  if (isContentCard(card)) {
    return (
      <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#D5CDBF] bg-[#FBF8F2]">
        <header className="border-b border-[#D5CDBF] px-3 py-2">
          <h3 className="text-xs font-semibold text-[#161A17]/85">{card.title}</h3>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">{card.content}</div>
      </section>
    );
  }
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
  defaultMetricId,
  accent = "#60a5fa",
  chartMode = "line",
  chartEmptyLabel,
  audience,
  top,
  primary,
  secondary,
  tertiary,
  footer,
  className = "",
}: Props) {
  const [userSelectedId, setUserSelectedId] = useState<string | null>(null);

  const selectedId = useMemo(() => {
    if (userSelectedId && metrics.some((m) => m.id === userSelectedId)) {
      return userSelectedId;
    }
    if (defaultMetricId && metrics.some((m) => m.id === defaultMetricId)) {
      return defaultMetricId;
    }
    return metrics[0]?.id ?? "";
  }, [userSelectedId, defaultMetricId, metrics]);

  const setSelectedId = useCallback((id: string) => {
    setUserSelectedId(id);
  }, []);

  const selected = metrics.find((m) => m.id === selectedId) ?? metrics[0];

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

      <KpiStrip
        items={metrics}
        selectedId={selected?.id ?? ""}
        onSelect={setSelectedId}
        accent={accent}
      />

      <div className="overflow-hidden rounded-2xl border border-[#D5CDBF] bg-[#FBF8F2]">
        {chart}
      </div>

      {top}

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
