"use client";

import { useMemo, useState } from "react";
import type { ScrapeResult, SocialSourcePlatform } from "@/lib/types";
import {
  computeSocialAnalytics,
  type AnalyticsRangeId,
} from "@/lib/analytics";
import { compactNumber } from "@/lib/graphUtils";
import { resolveProfilePicUrl } from "@/lib/avatarUrl";
import AnalyticsDashboardShell from "@/components/analytics/AnalyticsDashboardShell";
import type { BreakdownRow } from "@/components/analytics/BreakdownCard";

interface Props {
  data: ScrapeResult;
  range: AnalyticsRangeId;
  platform: SocialSourcePlatform;
  onSelectUsername?: (username: string) => void;
  selectedUsername?: string | null;
}

const ACCENT: Record<SocialSourcePlatform, string> = {
  linkedin: "#0A66C2",
  instagram: "#E1306C",
  facebook: "#1877F2",
};

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
        className="h-7 w-7 rounded-full object-cover ring-1 ring-white/15"
      />
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white/70 ring-1 ring-white/10">
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

  const personRows = (
    people: typeof overview.topEngagers,
  ): BreakdownRow[] =>
    people.map((person) => ({
      id: person.username,
      label: person.fullName || `@${person.username}`,
      subtitle: person.position || `@${person.username}`,
      value: person.value,
      valueLabel: person.metricLabel,
      selected:
        selectedUsername?.toLowerCase() === person.username.toLowerCase(),
      onClick: onSelectUsername
        ? () => onSelectUsername(person.username)
        : undefined,
      leading: (
        <Avatar
          username={person.username}
          fullName={person.fullName}
          profilePicUrl={person.profilePicUrl}
          platform={platform}
        />
      ),
    }));

  return (
    <AnalyticsDashboardShell
      accent={ACCENT[platform]}
      chartEmptyLabel={
        overview.hasDatedEvents
          ? "No activity in this range"
          : "Few dated events in this snapshot"
      }
      metrics={[
        {
          id: "comments",
          label: "Comments",
          value: compactNumber(overview.comments),
          delta: overview.commentsDelta,
          series: overview.commentsSeries,
        },
        {
          id: "reactions",
          label: "Reactions",
          value: compactNumber(overview.reactions),
          delta: overview.reactionsDelta,
          series: overview.reactionsSeries,
        },
        {
          id: "engagers",
          label: "Engagers",
          value: compactNumber(overview.activeEngagers),
          delta: overview.engagersDelta,
          series: overview.engagersSeries,
        },
        {
          id: "posts",
          label: "Posts",
          value: compactNumber(overview.postsTouched),
          delta: overview.postsDelta,
          series: overview.postsSeries,
        },
      ]}
      primary={{
        tabs: [
          {
            id: "posts",
            label: "Posts",
            valueHeader: "Engagement",
            empty: "No posts touched in this range",
            rows: overview.topPosts.map((post) => ({
              id: post.id,
              label: post.label,
              subtitle:
                post.comments || post.reactions
                  ? `${post.comments} comments · ${post.reactions} reactions`
                  : undefined,
              value: post.value,
              valueLabel: compactNumber(post.value),
              leading: post.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.imageUrl}
                  alt=""
                  className="h-7 w-7 rounded-md object-cover ring-1 ring-white/15"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-[10px] text-white/45">
                  #
                </span>
              ),
            })),
          },
          {
            id: "new",
            label: "New profiles",
            valueHeader: "Activity",
            empty: "No new profiles in this range",
            rows: personRows(overview.newProfiles),
          },
        ],
      }}
      secondary={{
        title: "Top engagers",
        valueHeader: "Activity",
        empty: "No engagers in this range",
        rows: personRows(overview.topEngagers),
      }}
      tertiary={
        overview.reactionMix.length > 0
          ? {
              title: "Reaction mix",
              valueHeader: "Count",
              rows: overview.reactionMix.map((r) => ({
                id: r.id,
                label: r.label,
                value: r.value,
                valueLabel: compactNumber(r.value),
              })),
            }
          : undefined
      }
    />
  );
}
