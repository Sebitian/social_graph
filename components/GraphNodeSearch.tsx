"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { GraphNode } from "@/lib/types";
import { parsePosition } from "@/lib/position";

interface Props {
  nodes: GraphNode[];
  selectedId?: string | null;
  onSelect: (node: GraphNode) => void;
  className?: string;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function nodeMatches(node: GraphNode, query: string): boolean {
  const needle = normalizeSearch(query.trim());
  if (!needle) return false;
  const { title, company } = parsePosition(node.position);
  const haystack = normalizeSearch(
    [node.fullName, node.label, node.id, node.position, title, company]
      .filter(Boolean)
      .join(" "),
  );
  return needle.split(/\s+/).every((token) => haystack.includes(token));
}

export default function GraphNodeSearch({
  nodes,
  selectedId,
  onSelect,
  className = "",
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const members = useMemo(
    () => nodes.filter((n) => n.group === "member"),
    [nodes],
  );

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return members.filter((node) => nodeMatches(node, query)).slice(0, 8);
  }, [members, query]);

  function pick(node: GraphNode) {
    onSelect(node);
    setQuery(node.fullName || node.label);
    setOpen(false);
  }

  function clear() {
    setQuery("");
    setOpen(false);
  }

  return (
    <div className={`relative ${className}`}>
      <label className="relative block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search people on the map…"
          className="w-full rounded-xl border border-white/15 bg-black/70 py-2 pl-8 pr-8 text-xs text-white outline-none backdrop-blur transition placeholder:text-white/35 focus:border-white/30 focus:bg-black/80"
        />
        {query ? (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-white/40 hover:text-white/80"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </label>

      {open && query.trim() ? (
        <ul className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-64 overflow-y-auto rounded-xl border border-white/15 bg-black/90 py-1 shadow-xl backdrop-blur">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-xs text-white/40">No matches</li>
          ) : (
            matches.map((node) => {
              const { title, company } = parsePosition(node.position);
              const isSelected = selectedId === node.id;
              return (
                <li key={node.id}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pick(node)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left transition ${
                      isSelected ? "bg-white/15" : "hover:bg-white/10"
                    }`}
                  >
                    {node.profilePicUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={node.profilePicUrl}
                        alt=""
                        className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-white/15"
                      />
                    ) : (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white/70">
                        {(node.fullName || node.label).charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-white">
                        {node.fullName || node.label}
                      </span>
                      {(title || company) && (
                        <span className="block truncate text-[10px] text-white/45">
                          {title ? (
                            <span className="font-semibold text-white/60">{title}</span>
                          ) : null}
                          {title && company ? " " : null}
                          {company ? (
                            <span className="italic">{company}</span>
                          ) : null}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
