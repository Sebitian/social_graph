"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink } from "lucide-react";
import type { ConferenceAttendee } from "@/lib/conferenceTypes";
import { compactNumber } from "@/lib/graphUtils";

type SortKey = "fullName" | "title" | "company" | "location" | "matchStatus";

interface Props {
  attendees: ConferenceAttendee[];
  selectedId?: string | null;
  onSelect?: (attendee: ConferenceAttendee | null) => void;
  className?: string;
}

export default function ConferenceRosterTable({
  attendees,
  selectedId = null,
  onSelect,
  className,
}: Props) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("fullName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let list = attendees;
    if (q) {
      list = attendees.filter((person) => {
        const hay = [
          person.fullName,
          person.lumaName,
          person.title,
          person.company,
          person.location,
          person.matchStatus,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return [...list].sort((a, b) => {
      const av = String(a[sortKey] ?? "");
      const bv = String(b[sortKey] ?? "");
      const cmp = av.localeCompare(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [attendees, filter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
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
          placeholder="Filter by name, company, location…"
          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-[#E11D48]/50 focus:outline-none"
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
              <th className={thClass} onClick={() => toggleSort("company")}>
                <span className="inline-flex items-center gap-1">
                  Company <SortIcon col="company" />
                </span>
              </th>
              <th className={thClass} onClick={() => toggleSort("location")}>
                <span className="inline-flex items-center gap-1">
                  Location <SortIcon col="location" />
                </span>
              </th>
              <th className={thClass} onClick={() => toggleSort("matchStatus")}>
                <span className="inline-flex items-center gap-1">
                  Match <SortIcon col="matchStatus" />
                </span>
              </th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-white/40">
                LinkedIn
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((person) => {
              const selected = selectedId === person.id;
              return (
                <tr
                  key={person.id}
                  onClick={() => onSelect?.(person)}
                  className={`cursor-pointer border-b border-white/5 transition ${
                    selected ? "bg-[#E11D48]/15" : "hover:bg-white/5"
                  }`}
                >
                  <td className="px-3 py-2.5 font-medium text-white">
                    {person.fullName}
                    {person.followerCount ? (
                      <span className="ml-2 text-[11px] font-normal text-white/35">
                        {compactNumber(person.followerCount)} fol.
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2.5 text-white/70">
                    {person.title || "—"}
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-2.5 text-white/70">
                    {person.company || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-white/60">
                    {person.location || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 capitalize text-white/55">
                    {person.matchStatus}
                  </td>
                  <td className="px-3 py-2.5">
                    {person.linkedinUrl && person.matchStatus === "matched" ? (
                      <a
                        href={person.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[#FDA4AF] hover:underline"
                      >
                        Profile
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-white/25">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
