"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink } from "lucide-react";
import type { CompanyEmployee } from "@/lib/companyTypes";
import { compactNumber } from "@/lib/graphUtils";

type SortKey =
  | "fullName"
  | "title"
  | "location"
  | "tenure"
  | "connectionsCount";

interface Props {
  employees: CompanyEmployee[];
  selectedId?: string | null;
  onSelect?: (employee: CompanyEmployee | null) => void;
  className?: string;
}

function educationSummary(emp: CompanyEmployee): string {
  const first = emp.education?.[0];
  if (!first) return "—";
  const parts = [first.school];
  if (first.degree) parts.push(first.degree);
  return parts.join(" · ");
}

export default function CompanyRosterTable({
  employees,
  selectedId = null,
  onSelect,
  className,
}: Props) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("connectionsCount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let list = employees;
    if (q) {
      list = employees.filter((emp) => {
        const hay = [
          emp.fullName,
          emp.title,
          emp.headline,
          emp.location,
          emp.tenure,
          ...(emp.education?.map((e) => e.school) ?? []),
          ...(emp.topSkills ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return [...list].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortKey) {
        case "fullName":
          av = a.fullName;
          bv = b.fullName;
          break;
        case "title":
          av = a.title;
          bv = b.title;
          break;
        case "location":
          av = a.location ?? "";
          bv = b.location ?? "";
          break;
        case "tenure":
          av = a.tenure ?? "";
          bv = b.tenure ?? "";
          break;
        case "connectionsCount":
          av = a.connectionsCount ?? 0;
          bv = b.connectionsCount ?? 0;
          break;
      }
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [employees, filter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "connectionsCount" ? "desc" : "asc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  };

  const thClass =
    "cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-white/40 hover:text-white/60";

  return (
    <div className={`flex h-full flex-col ${className ?? ""}`}>
      <div className="shrink-0 border-b border-white/10 px-3 py-2.5">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name, role, location, school…"
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-[#0A66C2]/50 focus:outline-none"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-black/80 backdrop-blur">
            <tr className="border-b border-white/10">
              <th className={thClass} onClick={() => toggleSort("fullName")}>
                <span className="inline-flex items-center gap-1">
                  Name <SortIcon col="fullName" />
                </span>
              </th>
              <th className={thClass} onClick={() => toggleSort("title")}>
                <span className="inline-flex items-center gap-1">
                  Title <SortIcon col="title" />
                </span>
              </th>
              <th className={thClass} onClick={() => toggleSort("location")}>
                <span className="inline-flex items-center gap-1">
                  Location <SortIcon col="location" />
                </span>
              </th>
              <th className={thClass} onClick={() => toggleSort("tenure")}>
                <span className="inline-flex items-center gap-1">
                  Tenure <SortIcon col="tenure" />
                </span>
              </th>
              <th
                className={thClass}
                onClick={() => toggleSort("connectionsCount")}
              >
                <span className="inline-flex items-center gap-1">
                  Connections <SortIcon col="connectionsCount" />
                </span>
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-white/40">
                Education
              </th>
              <th className="w-10 px-2 py-2.5" aria-label="LinkedIn" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp) => {
              const selected = selectedId === emp.id;
              return (
                <tr
                  key={emp.id}
                  onClick={() => onSelect?.(selected ? null : emp)}
                  className={`cursor-pointer border-b border-white/5 transition hover:bg-white/5 ${
                    selected ? "bg-[#0A66C2]/15" : ""
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {emp.profilePicUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={emp.profilePicUrl}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                        />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0A66C2]/20 text-xs font-semibold text-[#0A66C2]">
                          {emp.fullName.charAt(0)}
                        </div>
                      )}
                      <span className="font-medium text-white/90">
                        {emp.fullName}
                      </span>
                    </div>
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2.5 text-white/65">
                    {emp.title}
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-2.5 text-white/50">
                    {emp.location ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-white/50">
                    {emp.tenure ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-white/70">
                    {emp.connectionsCount != null
                      ? compactNumber(emp.connectionsCount)
                      : "—"}
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-2.5 text-white/45">
                    {educationSummary(emp)}
                  </td>
                  <td className="px-2 py-2.5">
                    <a
                      href={emp.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex rounded-md p-1.5 text-white/40 transition hover:bg-white/10 hover:text-[#0A66C2]"
                      title="Open LinkedIn profile"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-white/40">
            No employees match your filter.
          </div>
        )}
      </div>
    </div>
  );
}
