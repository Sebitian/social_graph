"use client";

import { useMemo, useState } from "react";
import { Heart, MessageCircle, Users, FileText } from "lucide-react";
import type { ScrapeResult, SocialSourcePlatform } from "@/lib/types";
import {
  computeSocialAnalytics,
  type AnalyticsRangeId,
} from "@/lib/analytics";
import { compactNumber } from "@/lib/graphUtils";
import { resolveProfilePicUrl } from "@/lib/avatarUrl";
import MetricTile from "@/components/analytics/MetricTile";
import AnalyticsSection, {
  AnalyticsRow,
} from "@/components/analytics/AnalyticsSection";

interface Props {
  data: ScrapeResult;
  range: AnalyticsRangeId;
  platform: SocialSourcePlatform;
  onSelectUsername?: (username: string) => void;
  selectedUsername?: string | null;
}

function Avatar({
  username,
  fullName,
  profilePicUrl,
  platform,
}: {
  username: string;
  fullName?: string;
  profilePicUrl?: string;
  platform: SocialSourcePlatform;
}) {
  const [failed, setFailed] = useState(false);
  const src = resolveProfilePicUrl(username, profilePicUrl, platform);
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-8 w-8 rounded-full object-cover ring-1 ring-white/15"
      />
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white/70 ring-1 ring-white/10">
      {(fullName || username).charAt(0).toUpperCase()}
    </span>
  );
}

export default function SocialAnalyticsBody({
  data,
  range,
  platform,
  onSelectUsername,
  selectedUsername,
}: Props) {
  const overview = useMemo(
    () => computeSocialAnalytics(data, range),
    [data, range],
  );

  const emptyPeriod =
    range !== "all" &&
    overview.comments === 0 &&
    overview.reactions === 0 &&
    overview.activeEngagers === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        <MetricTile
          label="Comments"
          value={compactNumber(overview.comments)}
          icon={<MessageCircle className="h-4 w-4" />}
          series={overview.commentSeries}
        />
        <MetricTile
          label="Reactions"
          value={compactNumber(overview.reactions)}
          icon={<Heart className="h-4 w-4" />}
        />
        <MetricTile
          label="Active"
          value={compactNumber(overview.activeEngagers)}
          icon={<Users className="h-4 w-4" />}
          hint="Engagers in range"
        />
        <MetricTile
          label="Posts"
          value={compactNumber(overview.postsTouched)}
          icon={<FileText className="h-4 w-4" />}
          hint="Touched in range"
        />
      </div>

      {emptyPeriod ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs text-white/45">
          No activity in this range
          {!overview.hasDatedEvents
            ? " — this snapshot has few dated events"
            : ""}
          .
        </p>
      ) : null}

      <AnalyticsSection
        title="Top engagers"
        subtitle={`${overview.topEngagers.length}`}
        empty={
          overview.topEngagers.length === 0
            ? "No engagers in this range"
            : null
        }
      >
        {overview.topEngagers.map((person) => (
          <AnalyticsRow
            key={person.username}
            leading={
              <Avatar
                username={person.username}
                fullName={person.fullName}
                profilePicUrl={person.profilePicUrl}
                platform={platform}
              />
            }
            title={person.fullName || `@${person.username}`}
            subtitle={person.position || `@${person.username}`}
            trailing={person.metricLabel}
            selected={
              selectedUsername?.toLowerCase() === person.username.toLowerCase()
            }
            onClick={
              onSelectUsername
                ? () => onSelectUsername(person.username)
                : undefined
            }
          />
        ))}
      </AnalyticsSection>

      <AnalyticsSection
        title="New profiles"
        subtitle={`${overview.newProfiles.length}`}
        empty={
          overview.newProfiles.length === 0
            ? "No new profiles in this range"
            : null
        }
      >
        {overview.newProfiles.map((person) => (
          <AnalyticsRow
            key={person.username}
            leading={
              <Avatar
                username={person.username}
                fullName={person.fullName}
                profilePicUrl={person.profilePicUrl}
                platform={platform}
              />
            }
            title={person.fullName || `@${person.username}`}
            subtitle={person.position || `@${person.username}`}
            trailing={person.metricLabel}
            selected={
              selectedUsername?.toLowerCase() === person.username.toLowerCase()
            }
            onClick={
              onSelectUsername
                ? () => onSelectUsername(person.username)
                : undefined
            }
          />
        ))}
      </AnalyticsSection>
    </div>
  );
}
