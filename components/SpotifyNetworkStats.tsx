"use client";

import { motion } from "framer-motion";
import { Disc3, ListMusic, Music2, Users } from "lucide-react";
import type { SpotifyStats as Stats } from "@/lib/spotifyTypes";

interface Props {
  stats: Stats;
  topGenres?: { label: string; weight: number; color?: string }[];
  onSelectGenre?: (label: string) => void;
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-black/25 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/35">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 font-mono text-lg text-white">{value}</div>
    </div>
  );
}

export default function SpotifyNetworkStats({
  stats,
  topGenres = [],
  onSelectGenre,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur sm:p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="text-sm font-semibold text-white/80">Taste snapshot</div>
        <span className="rounded-full bg-[#1DB954]/15 px-2 py-0.5 text-[10px] font-medium text-[#1DB954]">
          Spotify
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <StatCard icon={Users} label="Friends" value={stats.friendCount} />
        <StatCard icon={ListMusic} label="Playlists" value={stats.playlistCount} />
        <StatCard icon={Music2} label="Tracks" value={stats.trackCount} />
        <StatCard icon={Disc3} label="Genres" value={stats.genreCount} />
        <StatCard icon={Users} label="Artists" value={stats.uniqueArtists} />
        <StatCard
          icon={ListMusic}
          label="Scraped"
          value={`${stats.playlistsWithTracks}/${stats.playlistCount}`}
        />
      </div>

      {topGenres.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">
            Top genres
          </div>
          <div className="flex flex-wrap gap-1.5">
            {topGenres.slice(0, 8).map((g) => (
              <button
                key={g.label}
                type="button"
                onClick={() => onSelectGenre?.(g.label)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: g.color ?? "#1DB954" }}
                />
                {g.label}
                <span className="tabular-nums text-white/35">{g.weight}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
