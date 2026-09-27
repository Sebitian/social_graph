"use client";

import { useMemo, useState } from "react";
import type { CompanyResult } from "@/lib/companyTypes";
import { computeCompanyAnalytics } from "@/lib/analytics";
import { compactNumber } from "@/lib/graphUtils";
import AnalyticsDashboardShell from "@/components/analytics/AnalyticsDashboardShell";
import LocationMapChart from "@/components/analytics/LocationMapChart";
import SchoolLogoChart from "@/components/analytics/SchoolLogoChart";
import EmployeeRankChart from "@/components/analytics/EmployeeRankChart";
import EmploymentTimelineChart from "@/components/analytics/EmploymentTimelineChart";

interface Props {
  data: CompanyResult;
  onSelectLocation?: (label: string) => void;
  onSelectSchool?: (label: string) => void;
}

function SchoolAvatar({ label, logoUrl }: { label: string; logoUrl?: string }) {
  const [failed, setFailed] = useState(false);
  if (logoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-7 w-7 rounded-md object-cover ring-1 ring-[#161A17]/10"
      />
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#E7E0D4] text-[10px] font-semibold text-[#161A17]/85 ring-1 ring-[#161A17]/10">
      {label.charAt(0).toUpperCase()}
    </span>
  );
}

function PersonAvatar({ name, src }: { name: string; src?: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-7 w-7 rounded-full object-cover ring-1 ring-[#161A17]/10"
      />
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E7E0D4] text-[10px] font-semibold text-[#161A17]/85 ring-1 ring-[#161A17]/10">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export default function CompanyAnalyticsBody({
  data,
  onSelectLocation,
  onSelectSchool,
}: Props) {
  const overview = useMemo(() => computeCompanyAnalytics(data), [data]);

  const employeeHint =
    overview.totalReported != null &&
    overview.totalReported > overview.employeeCount
      ? `of ${compactNumber(overview.totalReported)}`
      : undefined;

  return (
    <AnalyticsDashboardShell
      accent="#0A66C2"
      chartEmptyLabel="No roster data"
      defaultMetricId="locations"
      metrics={[
        {
          id: "employees",
          label: "Employees",
          value: compactNumber(overview.employeeCount),
          chart: (
            <EmploymentTimelineChart
              employees={overview.employmentTimeline}
              accent="#0A66C2"
            />
          ),
        },
        {
          id: "locations",
          label: "Locations",
          value: compactNumber(overview.locationCount),
          chart: (
            <LocationMapChart
              locations={overview.topLocations}
              accent="#0A66C2"
              onSelect={onSelectLocation}
            />
          ),
        },
        {
          id: "schools",
          label: "Schools",
          value: compactNumber(overview.schoolCount),
          chart: (
            <SchoolLogoChart
              schools={overview.topSchools}
              accent="#0A66C2"
              onSelect={onSelectSchool}
            />
          ),
        },
        {
          id: "reach",
          label: "Avg followers",
          value: compactNumber(overview.avgFollowers || overview.avgConnections),
          chart: (
            <EmployeeRankChart
              employees={overview.topByFollowers}
              metric="followers"
              accent="#0A66C2"
            />
          ),
        },
      ]}
      primary={{
        searchPlaceholder: "Search people…",
        title: "Top by followers",
        valueHeader: "Followers",
        empty: "No follower data",
        rows: overview.topByFollowers.slice(0, 8).map((emp) => ({
          id: emp.id,
          label: emp.name,
          subtitle: emp.title,
          value: emp.followers || emp.connections,
          valueLabel: compactNumber(emp.followers || emp.connections),
          leading: (
            <PersonAvatar name={emp.name} src={emp.profilePicUrl} />
          ),
          onClick: () =>
            window.open(emp.linkedinUrl, "_blank", "noopener,noreferrer"),
        })),
      }}
      secondary={{
        searchPlaceholder: "Search…",
        tabs: [
          {
            id: "schools",
            label: "Schools",
            valueHeader: "People",
            empty: "No school data",
            rows: overview.topSchools.map((school) => ({
              id: school.label,
              label: school.label,
              value: school.count,
              valueLabel: compactNumber(school.count),
              leading: (
                <SchoolAvatar label={school.label} logoUrl={school.logoUrl} />
              ),
              onClick: onSelectSchool
                ? () => onSelectSchool(school.label)
                : undefined,
            })),
          },
          {
            id: "locations",
            label: "Locations",
            valueHeader: "People",
            empty: "No location data",
            rows: overview.topLocations.map((loc) => ({
              id: loc.label,
              label: loc.label,
              value: loc.count,
              valueLabel: compactNumber(loc.count),
              onClick: onSelectLocation
                ? () => onSelectLocation(loc.label)
                : undefined,
            })),
          },
          {
            id: "connections",
            label: "Connections",
            valueHeader: "Conn.",
            empty: "No connection data",
            rows: overview.topByConnections.slice(0, 8).map((emp) => ({
              id: emp.id,
              label: emp.name,
              subtitle: emp.title,
              value: emp.connections || emp.followers,
              valueLabel: compactNumber(emp.connections || emp.followers),
              onClick: () =>
                window.open(emp.linkedinUrl, "_blank", "noopener,noreferrer"),
            })),
          },
        ],
      }}
      footer={
        <p className="rounded-2xl border border-[#D5CDBF] bg-[#F3EEE4] px-3 py-2 text-[11px] text-[#5E665F]">
          Company roster is a point-in-time snapshot
          {employeeHint ? ` (${employeeHint} reported)` : ""} — time range does
          not apply. Charts show hire timeline, geography, schools, and reach.
        </p>
      }
    />
  );
}
