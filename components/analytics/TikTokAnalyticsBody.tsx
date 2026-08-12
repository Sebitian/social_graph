"use client";

import { useMemo } from "react";
import { Eye, Heart, Share2, Video } from "lucide-react";
import type { TikTokResult } from "@/lib/tiktokTypes";
import { formatTikTokCount } from "@/lib/tiktokTypes";
import {
  computeTikTokAnalytics,
  type AnalyticsRangeId,
} from "@/lib/analytics";
import MetricTile from "@/components/analytics/MetricTile";
import AnalyticsSection, {
  AnalyticsRow,
} from "@/components/analytics/AnalyticsSection";

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

  const emptyPeriod =
    range !== "all" && overview.videosPosted === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        <MetricTile
          label="Plays"
          value={formatTikTokCount(overview.plays)}
          icon={<Eye className="h-4 w-4" />}
          series={overview.playSeries}
        />
        <MetricTile
          label="Likes"
          value={formatTikTokCount(overview.likes)}
          icon={<Heart className="h-4 w-4" />}
        />
        <MetricTile
          label="Shares"
          value={formatTikTokCount(overview.shares)}
          icon={<Share2 className="h-4 w-4" />}
        />
        <MetricTile
          label="Videos"
          value={String(overview.videosPosted)}
          icon={<Video className="h-4 w-4" />}
          hint="Posted in range"
        />
      </div>

      {emptyPeriod ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs text-white/45">
          No videos in this range
          {!overview.hasDatedEvents
            ? " — video dates missing from snapshot"
            : ""}
          .
        </p>
      ) : null}

      <AnalyticsSection
        title="Top videos"
        subtitle={`${overview.topVideos.length}`}
        empty={
          overview.topVideos.length === 0 ? "No videos in this range" : null
        }
      >
        {overview.topVideos.map((video) => (
          <AnalyticsRow
            key={video.id}
            leading={
              video.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={video.coverUrl}
                  alt=""
                  className="h-8 w-8 rounded-md object-cover ring-1 ring-white/15"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-white/50">
                  <Video className="h-3.5 w-3.5" />
                </span>
              )
            }
            title={video.text || "Untitled video"}
            subtitle={`${formatTikTokCount(video.playCount)} plays`}
            trailing={formatTikTokCount(video.diggCount)}
            onClick={
              onSelectVideoId ? () => onSelectVideoId(video.id) : undefined
            }
          />
        ))}
      </AnalyticsSection>

      <AnalyticsSection
        title="Top hashtags"
        subtitle={`${overview.topHashtags.length}`}
        empty={
          overview.topHashtags.length === 0
            ? "No hashtags in this range"
            : null
        }
      >
        {overview.topHashtags.map((tag) => (
          <AnalyticsRow
            key={tag.label}
            leading={
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: tag.color ?? "#FE2C55" }}
              />
            }
            title={`#${tag.label}`}
            subtitle={`${tag.weight} video${tag.weight === 1 ? "" : "s"}`}
            trailing={formatTikTokCount(tag.plays)}
            onClick={
              onSelectHashtag ? () => onSelectHashtag(tag.label) : undefined
            }
          />
        ))}
      </AnalyticsSection>
    </div>
  );
}
