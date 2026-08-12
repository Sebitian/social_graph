"use client";

import { useMemo } from "react";
import { Video } from "lucide-react";
import type { TikTokResult } from "@/lib/tiktokTypes";
import { formatTikTokCount } from "@/lib/tiktokTypes";
import {
  computeTikTokAnalytics,
  type AnalyticsRangeId,
} from "@/lib/analytics";
import AnalyticsDashboardShell from "@/components/analytics/AnalyticsDashboardShell";

interface Props {
  data: TikTokResult;
  range: AnalyticsRangeId;
  onSelectVideoId?: (id: string) => void;
  onSelectHashtag?: (label: string) => void;
}

export default function TikTokAnalyticsBody({
  data,
  range,
  onSelectVideoId,
  onSelectHashtag,
}: Props) {
  const overview = useMemo(
    () => computeTikTokAnalytics(data, range),
    [data, range],
  );

  return (
    <AnalyticsDashboardShell
      accent="#25F4EE"
      chartEmptyLabel={
        overview.hasDatedEvents
          ? "No videos in this range"
          : "Video dates missing from snapshot"
      }
      metrics={[
        {
          id: "followers",
          label: "Followers",
          value: formatTikTokCount(data.profile.followerCount ?? 0),
          series: [
            {
              t: data.scrapedAt || Date.now(),
              label: "Total",
              v: data.profile.followerCount ?? 0,
            },
          ],
          chartMode: "bars" as const,
        },
        {
          id: "plays",
          label: "Plays",
          value: formatTikTokCount(overview.plays),
          delta: overview.playsDelta,
          series: overview.playsSeries,
        },
        {
          id: "likes",
          label: "Likes",
          value: formatTikTokCount(overview.likes),
          delta: overview.likesDelta,
          series: overview.likesSeries,
        },
        {
          id: "shares",
          label: "Shares",
          value: formatTikTokCount(overview.shares),
          delta: overview.sharesDelta,
          series: overview.sharesSeries,
        },
        {
          id: "videos",
          label: "Videos",
          value: String(overview.videosPosted),
          delta: overview.videosDelta,
          series: overview.videosSeries,
        },
      ]}
      defaultMetricId="followers"
      primary={{
        tabs: [
          {
            id: "videos",
            label: "Videos",
            valueHeader: "Plays",
            empty: "No videos in this range",
            rows: overview.topVideos.map((video) => ({
              id: video.id,
              label: video.text || "Untitled video",
              subtitle: `${formatTikTokCount(video.diggCount)} likes`,
              value: video.playCount,
              valueLabel: formatTikTokCount(video.playCount),
              onClick: onSelectVideoId
                ? () => onSelectVideoId(video.id)
                : undefined,
              leading: video.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={video.coverUrl}
                  alt=""
                  className="h-7 w-7 rounded-md object-cover ring-1 ring-white/15"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-white/50">
                  <Video className="h-3.5 w-3.5" />
                </span>
              ),
            })),
          },
          {
            id: "hashtags",
            label: "Hashtags",
            valueHeader: "Videos",
            empty: "No hashtags in this range",
            rows: overview.topHashtags.map((tag) => ({
              id: tag.label,
              label: `#${tag.label}`,
              subtitle: formatTikTokCount(tag.plays) + " plays",
              value: tag.weight,
              valueLabel: String(tag.weight),
              onClick: onSelectHashtag
                ? () => onSelectHashtag(tag.label)
                : undefined,
              leading: (
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: tag.color ?? "#FE2C55" }}
                />
              ),
            })),
          },
        ],
      }}
      secondary={{
        title: "Top by likes",
        valueHeader: "Likes",
        empty: "No videos in this range",
        rows: [...overview.topVideos]
          .sort((a, b) => b.diggCount - a.diggCount)
          .map((video) => ({
            id: `likes-${video.id}`,
            label: video.text || "Untitled video",
            subtitle: `${formatTikTokCount(video.playCount)} plays`,
            value: video.diggCount,
            valueLabel: formatTikTokCount(video.diggCount),
            onClick: onSelectVideoId
              ? () => onSelectVideoId(video.id)
              : undefined,
            leading: video.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={video.coverUrl}
                alt=""
                className="h-7 w-7 rounded-md object-cover ring-1 ring-white/15"
              />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-white/50">
                <Video className="h-3.5 w-3.5" />
              </span>
            ),
          })),
      }}
    />
  );
}
