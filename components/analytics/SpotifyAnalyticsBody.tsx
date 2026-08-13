"use client";

import { useMemo } from "react";
import type { SpotifyTasteResult } from "@/lib/spotifyTypes";
import {
  computeSpotifyAnalytics,
  type AnalyticsRangeId,
} from "@/lib/analytics";
import { compactNumber } from "@/lib/graphUtils";
import AnalyticsDashboardShell from "@/components/analytics/AnalyticsDashboardShell";

interface Props {
  data: SpotifyTasteResult;
  range: AnalyticsRangeId;
  onSelectGenre?: (label: string) => void;
}

export default function SpotifyAnalyticsBody({
  data,
  range,
  onSelectGenre,
}: Props) {
  const overview = useMemo(
    () => computeSpotifyAnalytics(data, range),
    [data, range],
  );

  return (
    <AnalyticsDashboardShell
      accent="#1DB954"
      chartEmptyLabel={
        overview.hasDatedEvents
          ? "No tracks added in this range"
          : "Add dates missing from snapshot"
      }
      metrics={[
        {
          id: "tracks",
          label: "Tracks",
          value: compactNumber(overview.tracksAdded),
          delta: overview.tracksDelta,
          series: overview.tracksSeries,
        },
        {
          id: "artists",
          label: "Artists",
          value: compactNumber(overview.artistsTouched),
          delta: overview.artistsDelta,
          series: overview.artistsSeries,
        },
        {
          id: "playlists",
          label: "Playlists",
          value: compactNumber(overview.playlistsActive),
          delta: overview.playlistsDelta,
          series: overview.playlistsSeries,
        },
      ]}
      primary={{
        searchPlaceholder: "Search playlists…",
        tabs: [
          {
            id: "playlists",
            label: "Playlists",
            valueHeader: "Tracks",
            empty: "No playlists active in this range",
            searchPlaceholder: "Search playlists…",
            rows: overview.topPlaylists.map((pl) => ({
              id: pl.id,
              label: pl.name,
              value: pl.tracks,
              valueLabel: compactNumber(pl.tracks),
            })),
          },
          {
            id: "genres",
            label: "Genres",
            valueHeader: "Weight",
            empty: "No genres in this range",
            searchPlaceholder: "Search genres…",
            rows: overview.topGenres.map((genre) => ({
              id: genre.label,
              label: genre.label,
              value: genre.weight,
              valueLabel: String(genre.weight),
              onClick: onSelectGenre
                ? () => onSelectGenre(genre.label)
                : undefined,
              leading: (
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: genre.color ?? "#1DB954" }}
                />
              ),
            })),
          },
        ],
      }}
      secondary={{
        title: "Top artists",
        valueHeader: "Tracks",
        empty: "No artists in this range",
        searchPlaceholder: "Search artists…",
        rows: overview.topArtists.map((artist) => ({
          id: artist.name,
          label: artist.name,
          value: artist.tracks,
          valueLabel: compactNumber(artist.tracks),
        })),
      }}
      tertiary={
        overview.friends.length > 0
          ? {
              title: "Friends",
              valueHeader: "In graph",
              rows: overview.friends.map((f) => ({
                id: f.id,
                label: f.name,
                value: f.value,
                valueLabel: "·",
              })),
            }
          : undefined
      }
    />
  );
}
