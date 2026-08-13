import type { ChatChart, ChatTable } from "./types";
import { splitMarkdownWithTables } from "./table";

export type ChatDisplayPart =
  | { type: "text"; text: string }
  | { type: "table"; key: string; table: ChatTable }
  | { type: "chart"; key: string; chart: ChatChart };

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function uniqueParagraphs(text: string): string {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const para of text.split(/\n{2,}/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    const key = normalizeText(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(trimmed);
  }
  return kept.join("\n\n");
}

function stripMarkdownTables(text: string): string {
  return splitMarkdownWithTables(text)
    .filter(
      (block): block is { type: "markdown"; text: string } =>
        block.type === "markdown",
    )
    .map((block) => block.text)
    .join("\n\n")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripRepeatedTitles(text: string, titles: string[]): string {
  let next = text;
  for (const title of titles) {
    const clean = title.trim();
    if (!clean) continue;
    const escaped = escapeRegExp(clean);
    next = next.replace(new RegExp(`^#{1,3}\\s*${escaped}\\s*$`, "gim"), "");
    next = next.replace(new RegExp(`\\*\\*${escaped}\\*\\*\\s*`, "gi"), "");
  }
  return next.replace(/\n{3,}/g, "\n\n").trim();
}

function tableKey(table: ChatTable): string {
  return JSON.stringify({
    title: table.title ?? "",
    columns: table.columns.map((col) => col.label),
    rows: table.rows,
  });
}

function chartKey(chart: ChatChart): string {
  return JSON.stringify({
    title: chart.title ?? "",
    series: chart.series.map((series) => ({
      id: series.id,
      points: series.points.map((point) => [point.label, point.v]),
    })),
  });
}

export function displayPartsFromMessage(
  parts: Array<{
    type: string;
    text?: string;
    toolCallId?: string;
    table?: ChatTable | null;
    chart?: ChatChart | null;
  }>,
): ChatDisplayPart[] {
  const hasToolTable = parts.some((part) => part.type === "table" && part.table);
  const items: ChatDisplayPart[] = [];

  for (const part of parts) {
    if (part.type === "text") {
      let text = (part.text ?? "").trim();
      if (!text) continue;
      if (hasToolTable) text = stripMarkdownTables(text);
      if (!text) continue;
      items.push({ type: "text", text: uniqueParagraphs(text) });
      continue;
    }
    if (part.type === "table" && part.table) {
      items.push({
        type: "table",
        key: part.toolCallId || tableKey(part.table),
        table: part.table,
      });
      continue;
    }
    if (part.type === "chart" && part.chart) {
      items.push({
        type: "chart",
        key: part.toolCallId || chartKey(part.chart),
        chart: part.chart,
      });
    }
  }

  const titles = items
    .filter((item): item is Extract<ChatDisplayPart, { type: "table" }> =>
      item.type === "table",
    )
    .map((item) => item.table.title)
    .filter((title): title is string => Boolean(title));

  if (titles.length > 0) {
    for (const item of items) {
      if (item.type === "text") {
        item.text = stripRepeatedTitles(item.text, titles);
      }
    }
  }

  const seenMedia = new Set<string>();
  const withoutDupMedia = items.filter((item) => {
    if (item.type === "text") return Boolean(item.text.trim());
    const key = item.type === "table" ? `t:${tableKey(item.table)}` : `c:${chartKey(item.chart)}`;
    if (seenMedia.has(key)) return false;
    seenMedia.add(key);
    return true;
  });

  const textNorms = withoutDupMedia.map((item) =>
    item.type === "text" ? normalizeText(item.text) : null,
  );
  const drop = new Set<number>();
  for (let i = 0; i < withoutDupMedia.length; i++) {
    if (textNorms[i] == null) continue;
    for (let j = 0; j < withoutDupMedia.length; j++) {
      if (i === j || textNorms[j] == null || drop.has(i)) continue;
      const a = textNorms[i] as string;
      const b = textNorms[j] as string;
      if (a === b && i > j) drop.add(i);
      else if (b.startsWith(a) && b.length > a.length) drop.add(i);
    }
  }

  return withoutDupMedia.filter((item, index) => !drop.has(index) && (item.type !== "text" || item.text.trim()));
}
