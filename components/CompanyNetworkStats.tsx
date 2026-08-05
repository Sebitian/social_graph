"use client";

import { motion } from "framer-motion";
import { Building2, GraduationCap, MapPin, Users } from "lucide-react";
import type { CompanyStats } from "@/lib/companyTypes";
import { compactNumber } from "@/lib/graphUtils";

interface Props {
  stats: CompanyStats;
  companyName: string;
  onSelectLocation?: (label: string) => void;
  onSelectSchool?: (label: string) => void;
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-black/25 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/35">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 font-mono text-lg text-white">{value}</div>
    </div>
  );
}

export default function CompanyNetworkStats({
  stats,
  companyName,
  onSelectLocation,
  onSelectSchool,
}: Props) {
  const employeeLabel =
    stats.totalReported && stats.totalReported > stats.employeeCount
      ? `${stats.employeeCount} of ${stats.totalReported}`
      : String(stats.employeeCount);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur sm:p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="text-sm font-semibold text-white/80">Company snapshot</div>
        <span className="rounded-full bg-[#0A66C2]/15 px-2 py-0.5 text-[10px] font-medium text-[#0A66C2]">
          LinkedIn
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <StatCard icon={Users} label="Employees" value={employeeLabel} />
        <StatCard icon={MapPin} label="Locations" value={stats.locationCount} />
        <StatCard icon={GraduationCap} label="Schools" value={stats.schoolCount} />
        <StatCard
          icon={Building2}
          label="Avg connections"
          value={compactNumber(stats.avgConnections)}
        />
      </div>

      {stats.topLocations.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">
            Top locations
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stats.topLocations.slice(0, 6).map((loc) => (
              <button
                key={loc.label}
                type="button"
                onClick={() => onSelectLocation?.(loc.label)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <MapPin className="h-3 w-3 text-[#0A66C2]/70" />
                {loc.label}
                <span className="tabular-nums text-white/35">{loc.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {stats.topSchools.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">
            Top schools
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stats.topSchools.slice(0, 6).map((school) => (
              <button
                key={school.label}
                type="button"
                onClick={() => onSelectSchool?.(school.label)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <GraduationCap className="h-3 w-3 text-[#0A66C2]/70" />
                <span className="max-w-[140px] truncate">{school.label}</span>
                <span className="tabular-nums text-white/35">{school.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-white/35">
        {companyName} employee roster from LinkedIn company search export.
      </p>
    </motion.div>
  );
}
