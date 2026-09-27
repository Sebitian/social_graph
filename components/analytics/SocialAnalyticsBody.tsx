"use client";

import { useEffect, useMemo, useState } from "react";
import type { ScrapeResult, SocialSourcePlatform } from "@/lib/types";
import {
  computeAudienceStats,
  computeSocialAnalytics,
  type AnalyticsPersonRow,
  type AnalyticsPostRow,
  type AnalyticsRangeId,
} from "@/lib/analytics";
import { compactNumber } from "@/lib/graphUtils";
import { formatPosition, isUsefulPosition } from "@/lib/position";
import AnalyticsDashboardShell, {
  type DashboardMetric,
} from "@/components/analytics/AnalyticsDashboardShell";
import AnalyticsAvatar from "@/components/analytics/AnalyticsAvatar";
import AudienceStatsBar from "@/components/analytics/AudienceStatsBar";
import EngagerTable from "@/components/analytics/EngagerTable";
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

function roleSubtitle(person: AnalyticsPersonRow): string {
  const formatted = formatPosition(person.position);
  if (formatted) return formatted;
  if (person.position && isUsefulPosition(person.position)) return person.position;
  return `@${person.username}`;
}

function normalizeRole(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function uniqueRoleOptions(
  people: AnalyticsPersonRow[],
  field: "title" | "company",
): { key: string; label: string }[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const person of people) {
    const raw = person[field]?.trim();
    if (!raw) continue;
    if (field === "title" && raw.length > 48) continue;
    const key = normalizeRole(raw);
    const prev = counts.get(key);
    if (prev) {
      prev.count += 1;
      if (raw.length < prev.label.length) prev.label = raw;
    } else {
      counts.set(key, { label: raw, count: 1 });
    }
  }
  return [...counts.entries()]
    .sort(
      (a, b) =>
        b[1].count - a[1].count || a[1].label.localeCompare(b[1].label),
    )
    .slice(0, 24)
    .map(([key, { label }]) => ({ key, label }));
}

function personMatchesRoleFilter(
  person: AnalyticsPersonRow,
  filter: string,
): boolean {
  if (filter === "all") return true;
  const [kind, ...rest] = filter.split(":");
  const key = rest.join(":");
  if (kind === "title") return normalizeRole(person.title ?? "") === key;
  if (kind === "company") return normalizeRole(person.company ?? "") === key;
  return true;
}

function postRows(
  posts: AnalyticsPostRow[],
  usePostMetrics: boolean,
): BreakdownRow[] {
  return posts.map((post) => {
    const parts: string[] = [];
    if (post.plays) parts.push(`${compactNumber(post.plays)} views`);
    if (post.reactions) {
      parts.push(
        `${compactNumber(post.reactions)} ${usePostMetrics ? "likes" : "reactions"}`,
      );
    }
    if (post.comments) {
      parts.push(
        `${compactNumber(post.comments)} comment${post.comments === 1 ? "" : "s"}`,
      );
    }
    if (post.shares) {
      parts.push(`${compactNumber(post.shares)} shares`);
    }
    return {
      id: post.id,
      label: post.label,
      subtitle: parts.length ? parts.join(" · ") : post.postType || undefined,
      value: post.value,
      valueLabel: compactNumber(post.value),
      leading: post.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.imageUrl}
          alt=""
          className="h-7 w-7 rounded-md object-cover ring-1 ring-[#161A17]/10"
        />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#E7E0D4] text-[10px] text-[#5E665F]">
          #
        </span>
      ),
    };
  });
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
  const audience = useMemo(
    () => computeAudienceStats(data, platform, range),
    [data, platform, range],
  );
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    // Reset role filter when the analysed profile or range changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRoleFilter("all");
  }, [range, data.scrapedAt, data.profile.username]);

  const newPeople = overview.newPeople;
  const titleOptions = useMemo(
    () => uniqueRoleOptions(newPeople, "title"),
    [newPeople],
  );
  const companyOptions = useMemo(
    () => uniqueRoleOptions(newPeople, "company"),
    [newPeople],
  );
  const showRoleFilter =
    platform === "linkedin" &&
    (titleOptions.length > 1 || companyOptions.length > 0);

  const filteredNewPeople = useMemo(() => {
    const filter = showRoleFilter ? roleFilter : "all";
    return newPeople.filter((person) => personMatchesRoleFilter(person, filter));
  }, [newPeople, roleFilter, showRoleFilter]);

  const personRows = (
    people: AnalyticsPersonRow[],
  ): BreakdownRow[] =>
    people.map((person) => ({
      id: person.username,
      label: person.fullName || `@${person.username}`,
      subtitle: roleSubtitle(person),
      value: person.value,
      valueLabel: person.metricLabel,
      selected:
        selectedUsername?.toLowerCase() === person.username.toLowerCase(),
      onClick: onSelectUsername
        ? () => onSelectUsername(person.username)
        : undefined,
      leading: (
        <AnalyticsAvatar
          username={person.username}
          fullName={person.fullName}
          profilePicUrl={person.profilePicUrl}
          platform={platform}
        />
      ),
    }));

  const usePostMetrics = overview.hasPostMetrics;
  const showPlays = usePostMetrics && overview.postPlays > 0;
  const instagramSplit = platform === "instagram" && usePostMetrics;

  const metrics: DashboardMetric[] = instagramSplit
    ? [
        {
          id: "feed-posts",
          label: "Posts",
          value: compactNumber(overview.feed.count),
          series: overview.feed.countSeries,
        },
        {
          id: "feed-likes",
          label: "Post likes",
          value: compactNumber(overview.feed.likes),
          series: overview.feed.likesSeries,
        },
        {
          id: "feed-comments",
          label: "Post comments",
          value: compactNumber(overview.feed.comments),
          series: overview.feed.commentsSeries,
        },
        {
          id: "reel-count",
          label: "Reels",
          value: compactNumber(overview.reels.count),
          series: overview.reels.countSeries,
        },
        {
          id: "reel-views",
          label: "Views",
          value: compactNumber(overview.reels.views),
          series: overview.reels.viewsSeries,
        },
        {
          id: "reel-likes",
          label: "Reel likes",
          value: compactNumber(overview.reels.likes),
          series: overview.reels.likesSeries,
        },
        {
          id: "reel-comments",
          label: "Reel comments",
          value: compactNumber(overview.reels.comments),
          series: overview.reels.commentsSeries,
        },
      ]
    : showPlays
    ? [
        {
          id: "plays",
          label: "Plays",
          value: compactNumber(overview.postPlays),
          series: overview.postPlaysSeries,
        },
        {
          id: "likes",
          label: "Likes",
          value: compactNumber(overview.postLikes || overview.reactions),
          series: overview.postLikesSeries.length
            ? overview.postLikesSeries
            : overview.reactionsSeries,
        },
        {
          id: "comments",
          label: "Comments",
          value: compactNumber(overview.comments),
          series: overview.commentsSeries,
        },
        {
          id: "posts",
          label: "Posts",
          value: compactNumber(overview.postsTouched),
          series: overview.postsSeries,
        },
      ]
    : [
        {
          id: "comments",
          label: "Comments",
          value: compactNumber(overview.comments),
          delta: overview.commentsDelta,
          series: overview.commentsSeries,
        },
        {
          id: "reactions",
          label: usePostMetrics ? "Likes" : "Reactions",
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
      ];

  return (
    <AnalyticsDashboardShell
      accent={ACCENT[platform]}
      audience={<AudienceStatsBar items={audience.items} />}
      top={
        <EngagerTable
          people={overview.topEngagers}
          platform={platform}
          selectedUsername={selectedUsername}
          onSelectUsername={onSelectUsername}
          limit={10}
        />
      }
      defaultMetricId={
        instagramSplit
          ? overview.reels.views > 0
            ? "reel-views"
            : "feed-likes"
          : undefined
      }
      chartEmptyLabel={
        showPlays
          ? overview.hasDatedEvents
            ? "No posts published in this range"
            : "Few dated posts in this snapshot"
          : overview.hasDatedEvents
            ? "No activity in this range"
            : "Few dated events in this snapshot"
      }
      metrics={metrics}
      primary={{
        searchPlaceholder: "Search name, role, company…",
        tabs: [
          {
            id: "new",
            label: "New people",
            valueHeader: "Activity",
            searchPlaceholder: "Search name, role, company…",
            empty:
              roleFilter !== "all"
                ? "No new people in this role"
                : "No new people in this range",
            rows: personRows(filteredNewPeople),
            toolbar: showRoleFilter ? (
              <label className="block">
                <span className="sr-only">Filter by position or company</span>
                <select
                  value={
                    titleOptions.some((o) => `title:${o.key}` === roleFilter) ||
                    companyOptions.some((o) => `company:${o.key}` === roleFilter)
                      ? roleFilter
                      : "all"
                  }
                  onChange={(event) => setRoleFilter(event.target.value)}
                  className="w-full rounded-lg border border-[#D5CDBF] bg-[#F3EEE4] px-2.5 py-1.5 text-[11px] text-[#161A17] outline-none focus:border-[#161A17]/30"
                >
                  <option value="all">All positions</option>
                  {titleOptions.length > 0 ? (
                    <optgroup label="Position">
                      {titleOptions.map((option) => (
                        <option key={`title:${option.key}`} value={`title:${option.key}`}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {companyOptions.length > 0 ? (
                    <optgroup label="Company">
                      {companyOptions.map((option) => (
                        <option key={`company:${option.key}`} value={`company:${option.key}`}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
              </label>
            ) : undefined,
          },
          {
            id: "posts",
            label: "Posts",
            valueHeader: "Engagement",
            searchPlaceholder: "Search posts…",
            empty: "No posts in this range",
            rows: postRows(
              instagramSplit ? overview.feedPosts : overview.topPosts,
              usePostMetrics,
            ),
          },
          ...(instagramSplit
            ? [
                {
                  id: "reels",
                  label: "Reels",
                  valueHeader: "Engagement",
                  searchPlaceholder: "Search reels…",
                  empty: "No reels in this range",
                  rows: postRows(overview.reelPosts, usePostMetrics),
                },
              ]
            : []),
        ],
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
