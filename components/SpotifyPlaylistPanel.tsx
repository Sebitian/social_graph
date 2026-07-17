"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, ListMusic, Music2, Users, X } from "lucide-react";
import type {
  SpotifyGenre,
  SpotifyGraphNode,
  SpotifyPlaylistSummary,
  SpotifyProfile,
  SpotifyTrack,
} from "@/lib/spotifyTypes";
import { formatPlayCount } from "@/lib/spotifyTypes";

function formatDuration(ms?: number): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return "—";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatAddedAt(addedAt?: string): string | null {
  if (!addedAt) return null;
  const ms = Date.parse(addedAt);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function artistLine(track: SpotifyTrack): string {
  return track.artists.map((a) => a.artistName).join(", ");
}

type TrackSort = "playlist" | "streams";

interface Props {
  node: SpotifyGraphNode | null;
  playlists: SpotifyPlaylistSummary[];
  genres: SpotifyGenre[];
  friends?: SpotifyProfile[];
  onClose: () => void;
  onSelectPlaylist?: (playlistId: string) => void;
}

export default function SpotifyPlaylistPanel({
  node,
  playlists,
  genres,
  friends = [],
  onClose,
  onSelectPlaylist,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [sort, setSort] = useState<TrackSort>("playlist");

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    setSort("playlist");
  }, [node?.id]);

  const playlist = useMemo(() => {
    if (!node || node.kind !== "playlist" || !node.refId) return null;
    return playlists.find((p) => p.id === node.refId) ?? null;
  }, [node, playlists]);

  const genre = useMemo(() => {
    if (!node || node.kind !== "genre" || !node.refId) return null;
    return genres.find((g) => g.id === node.refId) ?? null;
  }, [node, genres]);

  const friend = useMemo(() => {
    if (!node || node.kind !== "friend" || !node.refId) return null;
    return friends.find((f) => f.userId === node.refId) ?? null;
  }, [node, friends]);

  const friendPlaylists = useMemo(() => {
    if (!friend) return [];
    return playlists.filter((p) => p.ownerId === friend.userId);
  }, [friend, playlists]);

  const sortedTracks = useMemo(() => {
    const tracks = playlist?.tracks ?? [];
    if (sort !== "streams") return tracks;
    return [...tracks].sort((a, b) => {
      const ap = Number(String(a.plays ?? "0").replace(/,/g, "")) || 0;
      const bp = Number(String(b.plays ?? "0").replace(/,/g, "")) || 0;
      return bp - ap;
    });
  }, [playlist?.tracks, sort]);

  const open =
    Boolean(node) &&
    (node?.kind === "playlist" ||
      node?.kind === "genre" ||
      node?.kind === "friend");

  const panel = (
    <AnimatePresence>
      {open && node ? (
        <motion.aside
          key={node.id}
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-white/10 bg-[#121212] shadow-2xl sm:max-w-lg"
        >
          <div className="flex items-start gap-3 border-b border-white/10 bg-gradient-to-b from-[#1DB954]/25 to-transparent px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
            {playlist?.image || node.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={playlist?.image ?? node.imageUrl}
                alt=""
                className="h-20 w-20 shrink-0 rounded object-cover shadow-lg ring-1 ring-white/10"
              />
            ) : (
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded shadow-lg ring-1 ring-white/10"
                style={{ backgroundColor: node.color ?? "#1DB954" }}
              >
                {node.kind === "genre" ? (
                  <Music2 className="h-8 w-8 text-black/70" />
                ) : node.kind === "friend" ? (
                  <Users className="h-8 w-8 text-white/80" />
                ) : (
                  <ListMusic className="h-8 w-8 text-white/70" />
                )}
              </div>
            )}
            <div className="min-w-0 flex-1 pt-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                {node.kind === "genre"
                  ? "Genre"
                  : node.kind === "friend"
                    ? "Friend"
                    : "Playlist"}
              </div>
              <h2 className="truncate text-xl font-bold text-white">
                {playlist?.title ??
                  genre?.label ??
                  friend?.displayName ??
                  node.label}
              </h2>
              {playlist ? (
                <p className="mt-1 text-xs text-white/50">
                  {playlist.ownerName}
                  {" · "}
                  {playlist.hasTracks
                    ? `${playlist.tracks?.length ?? playlist.trackCount ?? 0} songs`
                    : "Tracks not loaded yet"}
                </p>
              ) : genre ? (
                <p className="mt-1 text-xs text-white/50">
                  Weight {genre.weight} · {genre.playlistIds.length} playlist
                  {genre.playlistIds.length === 1 ? "" : "s"}
                </p>
              ) : friend ? (
                <p className="mt-1 text-xs text-white/50">
                  {friendPlaylists.length} loaded playlist
                  {friendPlaylists.length === 1 ? "" : "s"}
                  {" · "}
                  {friend.followersCount} followers
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {friend ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {friend.sourceUrl && (
                <a
                  href={friend.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-[#1DB954] hover:underline"
                >
                  Open profile
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">
                Playlists
              </div>
              <ul className="space-y-2 pb-8">
                {friendPlaylists.map((pl) => (
                  <li key={pl.id}>
                    <button
                      type="button"
                      onClick={() => onSelectPlaylist?.(pl.id)}
                      className="flex w-full items-center gap-3 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-left transition hover:bg-white/10"
                    >
                      {pl.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={pl.image}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-white/10">
                          <ListMusic className="h-5 w-5 text-white/40" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-white">
                          {pl.title}
                        </div>
                        <div className="text-xs text-white/45">
                          {pl.hasTracks
                            ? `${pl.tracks?.length ?? pl.trackCount ?? 0} songs`
                            : "Not loaded"}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : playlist ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-2">
                {playlist.url ? (
                  <a
                    href={playlist.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1DB954] hover:underline"
                  >
                    Open in Spotify
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span />
                )}
                {playlist.hasTracks && (
                  <div className="inline-flex rounded-md border border-white/10 bg-black/30 p-0.5">
                    <button
                      type="button"
                      onClick={() => setSort("playlist")}
                      className={`rounded px-2 py-1 text-[10px] ${
                        sort === "playlist"
                          ? "bg-white/15 text-white"
                          : "text-white/45"
                      }`}
                    >
                      Order
                    </button>
                    <button
                      type="button"
                      onClick={() => setSort("streams")}
                      className={`rounded px-2 py-1 text-[10px] ${
                        sort === "streams"
                          ? "bg-white/15 text-white"
                          : "text-white/45"
                      }`}
                    >
                      Streams
                    </button>
                  </div>
                )}
              </div>

              {!playlist.hasTracks || !playlist.tracks?.length ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
                  <ListMusic className="h-10 w-10 text-white/25" />
                  <p className="text-sm text-white/55">Tracks not loaded yet</p>
                  <p className="max-w-xs text-xs text-white/35">
                    Scrape this playlist and re-import the Spotify snapshot to
                    unlock the full track list.
                  </p>
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <p className="px-4 pt-2 text-[10px] leading-relaxed text-white/35">
                    Streams = global Spotify play counts for the track, not how
                    many times {playlist.ownerName} listened.
                  </p>
                  <div className="sticky top-0 z-10 mt-2 grid grid-cols-[2rem_minmax(0,1fr)_3.25rem_3.25rem] gap-2 border-b border-white/5 bg-[#121212]/95 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-white/35 backdrop-blur">
                    <span>#</span>
                    <span>Title</span>
                    <span className="text-right">Streams</span>
                    <span className="text-right">Time</span>
                  </div>
                  <ul className="px-2 pb-8">
                    {sortedTracks.map((track, index) => {
                      const added = formatAddedAt(track.addedAt);
                      return (
                        <li
                          key={track.trackId}
                          className="grid grid-cols-[2rem_minmax(0,1fr)_3.25rem_3.25rem] items-center gap-2 rounded-md px-2 py-2 hover:bg-white/5"
                        >
                          <span className="text-center text-xs tabular-nums text-white/35">
                            {index + 1}
                          </span>
                          <div className="flex min-w-0 items-center gap-3">
                            {track.albumArt ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={track.albumArt}
                                alt=""
                                className="h-10 w-10 shrink-0 rounded object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-white/10">
                                <Music2 className="h-4 w-4 text-white/40" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-white">
                                {track.trackName}
                                {track.contentRating === "EXPLICIT" ? (
                                  <span className="ml-1 rounded bg-white/15 px-1 text-[9px] font-semibold text-white/50">
                                    E
                                  </span>
                                ) : null}
                              </div>
                              <div className="truncate text-xs text-white/45">
                                {artistLine(track)}
                                {added ? ` · added ${added}` : ""}
                              </div>
                            </div>
                          </div>
                          <span
                            className="text-right text-xs tabular-nums text-white/55"
                            title={
                              track.plays
                                ? `${track.plays} global Spotify streams`
                                : undefined
                            }
                          >
                            {formatPlayCount(track.plays)}
                          </span>
                          <span className="text-right text-xs tabular-nums text-white/40">
                            {formatDuration(track.trackDuration)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          ) : genre ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-white/40">
                From playlists
              </div>
              <div className="mb-5 flex flex-wrap gap-2">
                {genre.playlistIds.map((id) => {
                  const pl = playlists.find((p) => p.id === id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onSelectPlaylist?.(id)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                      {pl?.title ?? id}
                    </button>
                  );
                })}
              </div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">
                Sample tracks
              </div>
              <ul className="space-y-2">
                {genre.evidence.map((ev) => (
                  <li
                    key={`${ev.trackId}-${ev.reason}`}
                    className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2"
                  >
                    <div className="truncate text-sm text-white">
                      {ev.trackName}
                    </div>
                    <div className="truncate text-xs text-white/45">
                      {ev.artistNames.join(", ")}
                    </div>
                    <div className="mt-1 text-[10px] text-white/30">
                      {ev.reason}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(panel, document.body);
}
