"use client";

import { useMemo } from "react";
import { GraduationCap, MapPin, UserRound, Users } from "lucide-react";
import type { CompanyResult } from "@/lib/companyTypes";
import { computeCompanyAnalytics } from "@/lib/analytics";
import { compactNumber } from "@/lib/graphUtils";
import MetricTile from "@/components/analytics/MetricTile";
import AnalyticsSection, {
  AnalyticsRow,
} from "@/components/analytics/AnalyticsSection";

interface Props {
  data: CompanyResult;
  onSelectLocation?: (label: string) => void;
  onSelectSchool?: (label: string) => void;
}

export default function CompanyAnalyticsBody({
  data,
  onSelectLocation,
  onSelectSchool,
}: Props) {
  const overview = useMemo(() => computeCompanyAnalytics(data), [data]);

  const employeeLabel =
    overview.totalReported != null &&
    overview.totalReported > overview.employeeCount
      ? `of ${compactNumber(overview.totalReported)}`
      : "Snapshot";

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[11px] text-white/45">
        Company roster is a point-in-time snapshot — time range does not filter
        these metrics.
      </p>

      <div className="grid grid-cols-2 gap-2.5">
        <MetricTile
          label="Employees"
          value={compactNumber(overview.employeeCount)}
          icon={<Users className="h-4 w-4" />}
          hint={employeeLabel}
        />
        <MetricTile
          label="Locations"
          value={compactNumber(overview.locationCount)}
          icon={<MapPin className="h-4 w-4" />}
        />
        <MetricTile
          label="Schools"
          value={compactNumber(overview.schoolCount)}
          icon={<GraduationCap className="h-4 w-4" />}
        />
        <MetricTile
          label="Avg connections"
          value={compactNumber(Math.round(overview.avgConnections))}
          icon={<UserRound className="h-4 w-4" />}
        />
      </div>

      <AnalyticsSection
        title="Top locations"
        subtitle={`${overview.topLocations.length}`}
        empty={
          overview.topLocations.length === 0 ? "No location data" : null
        }
      >
        {overview.topLocations.map((loc) => (
          <AnalyticsRow
            key={loc.label}
            title={loc.label}
            trailing={String(loc.count)}
            onClick={
              onSelectLocation ? () => onSelectLocation(loc.label) : undefined
            }
          />
        ))}
      </AnalyticsSection>

      <AnalyticsSection
        title="Top schools"
        subtitle={`${overview.topSchools.length}`}
        empty={overview.topSchools.length === 0 ? "No school data" : null}
      >
        {overview.topSchools.map((school) => (
          <AnalyticsRow
            key={school.label}
            title={school.label}
            trailing={String(school.count)}
            onClick={
              onSelectSchool ? () => onSelectSchool(school.label) : undefined
            }
          />
        ))}
      </AnalyticsSection>
    </div>
  );
}
