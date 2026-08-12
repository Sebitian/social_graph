"use client";

import { useMemo } from "react";
import { Disc3, ListMusic, Music2, Users } from "lucide-react";
import type { SpotifyTasteResult } from "@/lib/spotifyTypes";
import {
  computeSpotifyAnalytics,
  type AnalyticsRangeId,
} from "@/lib/analytics";
import { compactNumber } from "@/lib/graphUtils";
import MetricTile from "@/components/analytics/MetricTile";
import AnalyticsSection, {
  AnalyticsRow,
} from "@/components/analytics/AnalyticsSection";

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

  const emptyPeriod =
    range !== "all" && overview.tracksAdded === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        <MetricTile
          label="Tracks added"
          value={compactNumber(overview.tracksAdded)}
          icon={<Music2 className="h-4 w-4" />}
          series={overview.trackSeries}
        />
        <MetricTile
          label="Artists"
          value={compactNumber(overview.artistsTouched)}
          icon={<Disc3 className="h-4 w-4" />}
          hint="Touched in range"
        />
        <MetricTile
          label="Playlists"
          value={compactNumber(overview.playlistsActive)}
          icon={<ListMusic className="h-4 w-4" />}
          hint="Active in range"
        />
        <MetricTile
          label="Friends"
          value={compactNumber(overview.friendCount)}
          icon={<Users className="h-4 w-4" />}
          hint="Lifetime snapshot"
        />
      </div>

      {emptyPeriod ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs text-white/45">
          No tracks added in this range
          {!overview.hasDatedEvents
            ? " — add dates missing from snapshot"
            : ""}
          .
        </p>
      ) : null}

      <AnalyticsSection
        title="Top artists"
        subtitle={`${overview.topArtists.length}`}
        empty={
          overview.topArtists.length === 0
            ? "No artists in this range"
            : null
        }
      >
        {overview.topArtists.map((artist) => (
          <AnalyticsRow
            key={artist.name}
            title={artist.name}
            trailing={`${artist.tracks} track${artist.tracks === 1 ? "" : "s"}`}
          />
        ))}
      </AnalyticsSection>

      <AnalyticsSection
        title="Top genres"
        subtitle={`${overview.topGenres.length}`}
        empty={
          overview.topGenres.length === 0 ? "No genres in this range" : null
        }
      >
        {overview.topGenres.map((genre) => (
          <AnalyticsRow
            key={genre.label}
            leading={
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: genre.color ?? "#1DB954" }}
              />
            }
            title={genre.label}
            trailing={`w ${genre.weight}`}
            onClick={
              onSelectGenre ? () => onSelectGenre(genre.label) : undefined
            }
          />
        ))}
      </AnalyticsSection>
    </div>
  );
}
