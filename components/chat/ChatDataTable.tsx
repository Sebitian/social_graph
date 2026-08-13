"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { compactNumber } from "@/lib/graphUtils";
import {
  cellNumber,
  isNumericColumn,
  parseChatTable,
} from "@/lib/chat/table";
import type { ChatTable, ChatTableCell } from "@/lib/chat/types";
import { MentionText } from "./ChatMentions";

interface Props {
  table: ChatTable;
  onSelectUsername?: (username: string) => void;
}

function formatCell(value: ChatTableCell, numeric: boolean): string {
  if (value == null || value === "") return "—";
  if (typeof value === "number") {
    return Math.abs(value) >= 1000 ? compactNumber(value) : value.toLocaleString();
  }
  if (numeric) {
    const n = cellNumber(value);
    if (n != null) {
      return Math.abs(n) >= 1000 ? compactNumber(n) : n.toLocaleString();
    }
  }
  return value;
}

export function tableFromToolPart(part: {
  state?: string;
  input?: unknown;
  output?: unknown;
}): ChatTable | null {
  if (part.state === "output-available") {
    return parseChatTable(part.output) ?? parseChatTable(part.input);
  }
  return parseChatTable(part.input);
}

export default function ChatDataTable({ table, onSelectUsername }: Props) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const numericKeys = new Set(
    table.columns
      .filter((col) => isNumericColumn(col, table.rows))
      .map((col) => col.key),
  );
  const maxima = new Map<string, number>();
  for (const key of numericKeys) {
    let max = -Infinity;
    for (const row of table.rows) {
      const n = cellNumber(row[key] ?? null);
      if (n != null && n > max) max = n;
    }
    if (Number.isFinite(max) && max > 0) maxima.set(key, max);
  }

  const rows = useMemo(() => {
    if (!sortKey) return table.rows;
    const column = table.columns.find((col) => col.key === sortKey);
    const numeric = column ? isNumericColumn(column, table.rows) : false;
    const sign = sortDir === "asc" ? 1 : -1;
    return [...table.rows].sort((a, b) => {
      const av = a[sortKey] ?? null;
      const bv = b[sortKey] ?? null;
      if (numeric) {
        const na = cellNumber(av);
        const nb = cellNumber(bv);
        if (na == null && nb == null) return 0;
        if (na == null) return 1;
        if (nb == null) return -1;
        return (na - nb) * sign;
      }
      return (
        String(av ?? "").localeCompare(String(bv ?? ""), undefined, {
          numeric: true,
          sensitivity: "base",
        }) * sign
      );
    });
  }, [sortDir, sortKey, table.columns, table.rows]);

  const toggleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir(numericKeys.has(key) ? "desc" : "asc");
      return;
    }
    setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
  };

  return (
    <figure className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
      {table.title ? (
        <figcaption className="border-b border-white/10 px-3 py-2 text-[11px] font-semibold text-white/70">
          {table.title}
        </figcaption>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.04]">
              {table.columns.map((col, index) => {
                const numeric = numericKeys.has(col.key);
                const right = col.align === "right" || (col.align !== "left" && numeric);
                const active = sortKey === col.key;
                const Icon = !active
                  ? ArrowUpDown
                  : sortDir === "asc"
                    ? ArrowUp
                    : ArrowDown;
                return (
                  <th
                    key={col.key}
                    className={`whitespace-nowrap px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/40 ${
                      index === 0 ? "sticky left-0 bg-black/80" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={`inline-flex w-full items-center gap-1 px-2 py-1 hover:text-white/70 ${
                        right ? "justify-end" : "justify-start"
                      } ${active ? "text-white/75" : ""}`}
                    >
                      {col.label}
                      <Icon className="h-3 w-3 shrink-0 opacity-70" />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-white/5 last:border-0"
              >
                {table.columns.map((col, index) => {
                  const numeric = numericKeys.has(col.key);
                  const right =
                    col.align === "right" || (col.align !== "left" && numeric);
                  const raw = row[col.key] ?? null;
                  const n = numeric ? cellNumber(raw) : null;
                  const peak = maxima.get(col.key);
                  const isPeak = n != null && peak != null && n === peak;
                  const display = formatCell(raw, numeric);
                  const mentionable =
                    typeof raw === "string" && raw.includes("@") && !numeric;
                  return (
                    <td
                      key={col.key}
                      className={`px-3 py-2 ${
                        right
                          ? "whitespace-nowrap text-right font-mono tabular-nums"
                          : "max-w-[16rem] text-left"
                      } ${
                        index === 0
                          ? "sticky left-0 bg-black/75 font-medium text-white/90"
                          : "text-white/75"
                      } ${isPeak ? "text-white" : ""}`}
                    >
                      {isPeak ? (
                        <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-medium text-white">
                          {display}
                        </span>
                      ) : mentionable ? (
                        <MentionText
                          text={display}
                          onSelectUsername={onSelectUsername}
                        />
                      ) : (
                        display
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.caption ? (
        <p className="border-t border-white/10 px-3 py-1.5 text-[11px] leading-relaxed text-white/40">
          {table.caption}
        </p>
      ) : null}
    </figure>
  );
}
