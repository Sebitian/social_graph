"use client";

import { useMemo } from "react";
import type { ConferenceResult } from "@/lib/conferenceTypes";
import { computeConferenceAnalytics } from "@/lib/analytics";
import { compactNumber } from "@/lib/graphUtils";
import AnalyticsDashboardShell from "@/components/analytics/AnalyticsDashboardShell";
import LocationMapChart from "@/components/analytics/LocationMapChart";

interface Props {
  data: ConferenceResult;
  onSelectLocation?: (label: string) => void;
  onSelectCompany?: (label: string) => void;
  onSelectAttendee?: (id: string) => void;
}

export default function ConferenceAnalyticsBody({
  data,
  onSelectLocation,
  onSelectCompany,
  onSelectAttendee,
}: Props) {
  const overview = useMemo(() => computeConferenceAnalytics(data), [data]);

  return (
    <AnalyticsDashboardShell
      accent="#E11D48"
      chartEmptyLabel="No attendee data"
      defaultMetricId="companies"
      metrics={[
        {
          id: "attendees",
          label: "Attendees",
          value: compactNumber(overview.attendeeCount),
          series: overview.coverageSeries,
          chartMode: "bars",
        },
        {
          id: "matched",
          label: "LinkedIn matches",
          value: compactNumber(overview.matchedCount),
          series: overview.coverageSeries,
          chartMode: "bars",
        },
        {
          id: "companies",
          label: "Companies",
          value: compactNumber(overview.companyCount),
          series: overview.topCompanies.slice(0, 8).map((c, i) => ({
            t: i,
            label: c.label,
            v: c.count,
          })),
          chartMode: "bars",
        },
        {
          id: "locations",
          label: "Locations",
          value: compactNumber(overview.locationCount),
          chart: (
            <LocationMapChart
              locations={overview.topLocations}
              accent="#E11D48"
              onSelect={onSelectLocation}
            />
          ),
        },
      ]}
      primary={{
        searchPlaceholder: "Search people…",
        title: "Top by followers",
        valueHeader: "Followers",
        empty: "No follower data",
        rows: overview.topByFollowers.slice(0, 8).map((person) => ({
          id: person.id,
          label: person.name,
          subtitle: [person.title, person.company].filter(Boolean).join(" · "),
          value: person.followers || person.connections,
          valueLabel: compactNumber(person.followers || person.connections),
          onClick: () => onSelectAttendee?.(person.id),
        })),
      }}
      secondary={{
        searchPlaceholder: "Search…",
        tabs: [
          {
            id: "companies",
            label: "Companies",
            valueHeader: "People",
            empty: "No company data",
            rows: overview.topCompanies.map((company) => ({
              id: company.label,
              label: company.label,
              value: company.count,
              valueLabel: compactNumber(company.count),
              onClick: onSelectCompany
                ? () => onSelectCompany(company.label)
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
        ],
      }}
      footer={
        <p className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[11px] text-white/45">
          Conference roster is a point-in-time Luma guest list enriched with
          LinkedIn people search — {overview.matchedCount} matched,{" "}
          {overview.unmatchedCount} unmatched, {overview.missingCount} missing.
          Time range does not apply.
        </p>
      }
    />
  );
}
