"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";

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
  /** Extra controls shown under the tab header (filters, etc.). */
  toolbar?: ReactNode;
  searchPlaceholder?: string;
}

interface Props {
  title?: string;
  tabs?: BreakdownTab[];
  /** Single-list mode when tabs omitted. */
  rows?: BreakdownRow[];
  empty?: string;
  valueHeader?: string;
  className?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function rowMatches(row: BreakdownRow, query: string): boolean {
  const needle = normalizeSearch(query.trim());
  if (!needle) return true;
  const haystack = normalizeSearch(
    [row.label, row.subtitle, row.id, row.valueLabel]
      .filter(Boolean)
      .join(" "),
  );
  return needle.split(/\s+/).every((token) => haystack.includes(token));
}

function ListSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5E665F]/80" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-8 w-full rounded-lg border border-[#D5CDBF] bg-[#F3EEE4] py-0 pl-8 pr-8 text-[11px] text-[#161A17] outline-none transition placeholder:text-[#5E665F]/70 focus:border-[#161A17]/30 focus:bg-[#FBF8F2]"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[#5E665F] hover:text-[#161A17]"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </label>
  );
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
      <div className="flex min-h-[140px] items-center justify-center px-4 py-8 text-center text-xs text-[#5E665F]/80">
        {empty ?? "No data"}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[#5E665F]/70">
        <span>Name</span>
        <span>{valueHeader ?? "Total"}</span>
      </div>
      <ul className="divide-y divide-[#E7E0D4]">
        {rows.map((row) => {
          const pct = Math.max(4, (row.value / max) * 100);
          return (
            <li key={row.id}>
              <button
                type="button"
                disabled={!row.onClick}
                onClick={row.onClick}
                className={`relative flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition ${
                  row.onClick ? "hover:bg-[#F3EEE4]" : "cursor-default"
                } ${row.selected ? "bg-[#EFE8DC]" : ""}`}
              >
                <span
                  className="pointer-events-none absolute inset-y-1 left-1 rounded-md bg-[#EFE8DC]"
                  style={{ width: `calc(${pct}% - 8px)` }}
                  aria-hidden
                />
                <span className="relative z-[1] flex min-w-0 flex-1 items-center gap-2.5">
                  {row.leading ? (
                    <span className="shrink-0">{row.leading}</span>
                  ) : null}
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-[#161A17]">
                      {row.label}
                    </span>
                    {row.subtitle ? (
                      <span className="block truncate text-[11px] text-[#5E665F]/80">
                        {row.subtitle}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="relative z-[1] shrink-0 font-mono text-xs tabular-nums text-[#5E665F]">
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
  searchable = false,
  searchPlaceholder = "Search…",
}: Props) {
  const [tabId, setTabId] = useState(tabs?.[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const activeTab = tabs?.find((t) => t.id === tabId) ?? tabs?.[0];

  useEffect(() => {
    setQuery("");
  }, [tabId]);

  const sourceRows = activeTab ? activeTab.rows : (rows ?? []);
  const visibleRows = useMemo(
    () =>
      searchable
        ? sourceRows.filter((row) => rowMatches(row, query))
        : sourceRows,
    [searchable, sourceRows, query],
  );
  const emptyLabel = query.trim()
    ? "No matches"
    : (activeTab?.empty ?? empty);
  const placeholder = activeTab?.searchPlaceholder ?? searchPlaceholder;
  const showTools = searchable || Boolean(activeTab?.toolbar);

  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[#D5CDBF] bg-[#FBF8F2] ${className}`}
    >
      {(title || (tabs && tabs.length > 1)) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D5CDBF] px-3 py-2">
          {title ? (
            <h3 className="text-xs font-semibold text-[#161A17]/85">{title}</h3>
          ) : (
            <span />
          )}
          {tabs && tabs.length > 1 ? (
            <div className="inline-flex rounded-lg border border-[#D5CDBF] bg-[#F3EEE4] p-0.5">
              {tabs.map((tab) => {
                const selected = tab.id === activeTab?.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTabId(tab.id)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                      selected
                        ? "bg-[#FBF8F2] text-[#161A17] shadow-[0_1px_2px_rgba(22,26,23,0.06)]"
                        : "text-[#5E665F] hover:text-[#161A17]"
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
        <header className="flex items-center justify-between border-b border-[#D5CDBF] px-3 py-2">
          <h3 className="text-xs font-semibold text-[#161A17]/85">
            {tabs[0].label}
          </h3>
        </header>
      ) : null}

      {showTools ? (
        <div className="flex flex-col gap-2 border-b border-[#D5CDBF] px-3 py-2">
          {searchable ? (
            <ListSearch
              value={query}
              onChange={setQuery}
              placeholder={placeholder}
            />
          ) : null}
          {activeTab?.toolbar}
        </div>
      ) : null}

      {activeTab || rows ? (
        <RowList
          rows={visibleRows}
          empty={emptyLabel}
          valueHeader={activeTab?.valueHeader ?? valueHeader}
        />
      ) : (
        <RowList rows={[]} empty={empty} valueHeader={valueHeader} />
      )}
    </section>
  );
}
