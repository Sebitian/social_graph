"use client";

import { useState, type ReactNode } from "react";

export interface BreakdownRow {
  id: string;
  label: string;
  value: number;
  valueLabel?: string;
  subtitle?: string;
  leading?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
}

export interface BreakdownTab {
  id: string;
  label: string;
  rows: BreakdownRow[];
  empty?: string;
  valueHeader?: string;
}

interface Props {
  title?: string;
  tabs?: BreakdownTab[];
  /** Single-list mode when tabs omitted. */
  rows?: BreakdownRow[];
  empty?: string;
  valueHeader?: string;
  className?: string;
}

function RowList({
  rows,
  empty,
  valueHeader,
}: {
  rows: BreakdownRow[];
  empty?: string;
  valueHeader?: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[140px] items-center justify-center px-4 py-8 text-center text-xs text-white/35">
        {empty ?? "No data"}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-white/30">
        <span>Name</span>
        <span>{valueHeader ?? "Total"}</span>
      </div>
      <ul className="divide-y divide-white/[0.04]">
        {rows.map((row) => {
          const pct = Math.max(4, (row.value / max) * 100);
          return (
            <li key={row.id}>
              <button
                type="button"
                disabled={!row.onClick}
                onClick={row.onClick}
                className={`relative flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition ${
                  row.onClick ? "hover:bg-white/[0.04]" : "cursor-default"
                } ${row.selected ? "bg-white/[0.06]" : ""}`}
              >
                <span
                  className="pointer-events-none absolute inset-y-1 left-1 rounded-md bg-white/[0.06]"
                  style={{ width: `calc(${pct}% - 8px)` }}
                  aria-hidden
                />
                <span className="relative z-[1] flex min-w-0 flex-1 items-center gap-2.5">
                  {row.leading ? (
                    <span className="shrink-0">{row.leading}</span>
                  ) : null}
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-white/85">
                      {row.label}
                    </span>
                    {row.subtitle ? (
                      <span className="block truncate text-[11px] text-white/35">
                        {row.subtitle}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="relative z-[1] shrink-0 font-mono text-xs tabular-nums text-white/55">
                  {row.valueLabel ?? String(row.value)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function BreakdownCard({
  title,
  tabs,
  rows,
  empty,
  valueHeader,
  className = "",
}: Props) {
  const [tabId, setTabId] = useState(tabs?.[0]?.id ?? "");
  const activeTab = tabs?.find((t) => t.id === tabId) ?? tabs?.[0];

  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] ${className}`}
    >
      {(title || (tabs && tabs.length > 1)) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          {title ? (
            <h3 className="text-xs font-semibold text-white/70">{title}</h3>
          ) : (
            <span />
          )}
          {tabs && tabs.length > 1 ? (
            <div className="inline-flex rounded-lg border border-white/10 bg-black/30 p-0.5">
              {tabs.map((tab) => {
                const selected = tab.id === activeTab?.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTabId(tab.id)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                      selected
                        ? "bg-white/15 text-white"
                        : "text-white/45 hover:text-white/75"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </header>
      )}

      {tabs && tabs.length === 1 && !title ? (
        <header className="flex items-center justify-between border-b border-white/10 px-3 py-2">
          <h3 className="text-xs font-semibold text-white/70">
            {tabs[0].label}
          </h3>
        </header>
      ) : null}

      {activeTab ? (
        <RowList
          rows={activeTab.rows}
          empty={activeTab.empty}
          valueHeader={activeTab.valueHeader ?? valueHeader}
        />
      ) : (
        <RowList rows={rows ?? []} empty={empty} valueHeader={valueHeader} />
      )}
    </section>
  );
}
