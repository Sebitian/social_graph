import type { ChatTable, ChatTableCell, ChatTableColumn } from "./types";

const MAX_COLUMNS = 8;
const MAX_ROWS = 20;

function asCell(value: unknown): ChatTableCell {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function asColumn(value: unknown, index: number): ChatTableColumn | null {
  if (typeof value === "string" && value.trim()) {
    const key = value.trim();
    return { key, label: key };
  }
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const key =
    typeof rec.key === "string" && rec.key.trim()
      ? rec.key.trim()
      : typeof rec.id === "string" && rec.id.trim()
        ? rec.id.trim()
        : `col_${index}`;
  const label =
    typeof rec.label === "string" && rec.label.trim()
      ? rec.label.trim()
      : key;
  const align = rec.align === "right" || rec.align === "left" ? rec.align : undefined;
  return { key, label, align };
}

export function parseChatTable(value: unknown): ChatTable | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const rawColumns = Array.isArray(rec.columns) ? rec.columns : [];
  const columns = rawColumns
    .map(asColumn)
    .filter((col): col is ChatTableColumn => col != null)
    .slice(0, MAX_COLUMNS);
  if (columns.length < 2) return null;

  const keys = new Set(columns.map((col) => col.key));
  const rawRows = Array.isArray(rec.rows) ? rec.rows : [];
  const rows: ChatTable["rows"] = [];
  for (const row of rawRows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const cells: Record<string, ChatTableCell> = {};
    for (const [key, cell] of Object.entries(row as Record<string, unknown>)) {
      if (!keys.has(key)) continue;
      cells[key] = asCell(cell);
    }
    if (Object.keys(cells).length === 0) continue;
    rows.push(cells);
    if (rows.length >= MAX_ROWS) break;
  }
  if (rows.length === 0) return null;

  return {
    title: typeof rec.title === "string" ? rec.title.trim() || null : null,
    caption: typeof rec.caption === "string" ? rec.caption.trim() || null : null,
    columns,
    rows,
  };
}

export function cellNumber(value: ChatTableCell): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/,/g, "").trim();
  const exact = trimmed.match(/^-?\d+(\.\d+)?$/);
  if (exact) return Number(trimmed);
  const lead = trimmed.match(/^-?\d+(\.\d+)?/);
  if (lead && /^-?\d/.test(trimmed)) return Number(lead[0]);
  return null;
}

export function isNumericColumn(
  column: ChatTableColumn,
  rows: ChatTable["rows"],
): boolean {
  if (column.align === "right") return true;
  if (column.align === "left") return false;
  const nums = rows
    .map((row) => cellNumber(row[column.key] ?? null))
    .filter((n): n is number => n != null);
  const filled = rows.filter(
    (row) => row[column.key] != null && row[column.key] !== "",
  ).length;
  return filled > 0 && nums.length === filled;
}

function slugKey(label: string, index: number, used: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "") || `col_${index}`;
  let key = base;
  let n = 2;
  while (used.has(key)) {
    key = `${base}_${n++}`;
  }
  used.add(key);
  return key;
}

function parsePipeRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return null;
  let cells = trimmed.split("|");
  if (trimmed.startsWith("|")) cells = cells.slice(1);
  if (trimmed.endsWith("|")) cells = cells.slice(0, -1);
  const values = cells.map((cell) => cell.trim());
  if (values.every((cell) => cell === "")) return null;
  return values;
}

function isDividerRow(cells: string[]): boolean {
  return (
    cells.length > 0 &&
    cells.every((cell) => /^:?-{2,}:?$/.test(cell.replace(/\s/g, "")))
  );
}

function coerceMarkdownCell(raw: string): ChatTableCell {
  const trimmed = raw.replace(/\\\|/g, "|").trim();
  if (!trimmed) return "";
  const compact = trimmed.replace(/,/g, "");
  if (/^-?\d+(\.\d+)?$/.test(compact)) {
    const n = Number(compact);
    return Number.isFinite(n) ? n : trimmed;
  }
  return trimmed;
}

export type MarkdownBlock =
  | { type: "markdown"; text: string }
  | { type: "table"; table: ChatTable };

/** Split GFM pipe tables out of markdown so they can use the sortable table UI. */
export function splitMarkdownWithTables(text: string): MarkdownBlock[] {
  const lines = text.split("\n");
  const blocks: MarkdownBlock[] = [];
  let buffer: string[] = [];

  const flushMarkdown = () => {
    const next = buffer.join("\n").trim();
    if (next) blocks.push({ type: "markdown", text: next });
    buffer = [];
  };

  let i = 0;
  while (i < lines.length) {
    const header = parsePipeRow(lines[i] ?? "");
    const divider = parsePipeRow(lines[i + 1] ?? "");
    if (
      header &&
      divider &&
      header.length >= 2 &&
      divider.length >= 2 &&
      isDividerRow(divider)
    ) {
      flushMarkdown();
      const used = new Set<string>();
      const columns: ChatTableColumn[] = header.slice(0, MAX_COLUMNS).map(
        (label, index) => ({
          key: slugKey(label, index, used),
          label: label || `Col ${index + 1}`,
        }),
      );
      i += 2;
      const rows: ChatTable["rows"] = [];
      while (i < lines.length) {
        const line = lines[i] ?? "";
        if (!line.trim()) break;
        const cells = parsePipeRow(line);
        if (!cells || isDividerRow(cells)) break;
        const rec: Record<string, ChatTableCell> = {};
        columns.forEach((col, index) => {
          rec[col.key] = coerceMarkdownCell(cells[index] ?? "");
        });
        rows.push(rec);
        i += 1;
        if (rows.length >= MAX_ROWS) break;
      }
      if (rows.length > 0) {
        blocks.push({ type: "table", table: { columns, rows } });
      }
      continue;
    }
    buffer.push(lines[i] ?? "");
    i += 1;
  }
  flushMarkdown();
  return blocks.length > 0 ? blocks : [{ type: "markdown", text }];
}
