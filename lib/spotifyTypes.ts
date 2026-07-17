/** Spotify taste / playlist graph types (separate from social ScrapeResult). */

export type SpotifyNodeKind = "self" | "friend" | "playlist" | "genre";

export interface SpotifyArtistRef {
  artistName: string;
  artistId?: string;
}

export interface SpotifyTrack {
  trackName: string;
  trackId: string;
  artists: SpotifyArtistRef[];
  /**
   * Spotify global stream count for the track (not personal listens).
   * Scraper field name is `plays`.
   */
  plays?: string;
  trackDuration?: number;
  albumName?: string;
  albumId?: string;
  albumArt?: string;
  contentRating?: string;
  addedAt?: string;
  trackNumber?: number;
}

export interface SpotifyPlaylistSummary {
  id: string;
  title: string;
  url: string;
  image?: string;
  trackCount?: number;
  /** Present when a playlist scrape was merged in. */
  tracks?: SpotifyTrack[];
  hasTracks: boolean;
  ownerId: string;
  ownerName: string;
}

export interface SpotifyProfile {
  userId: string;
  displayName: string;
  username: string;
  profileImage?: string;
  sourceUrl: string;
  followersCount: number;
  followingCount: number;
  totalPublicPlaylists: number;
  role: "self" | "friend";
}

export interface SpotifyGenreEvidence {
  trackId: string;
  trackName: string;
  artistNames: string[];
  reason: string;
}

export interface SpotifyGenre {
  id: string;
  label: string;
  weight: number;
  playlistIds: string[];
  evidence: SpotifyGenreEvidence[];
  color: string;
}

export interface SpotifyGraphNode {
  id: string;
  label: string;
  kind: SpotifyNodeKind;
  imageUrl?: string;
  /** Playlist id, genre id, or person userId when applicable. */
  refId?: string;
  weight?: number;
  color?: string;
  hasTracks?: boolean;
  trackCount?: number;
  ownerId?: string;
}

export interface SpotifyGraphLink {
  source: string;
  target: string;
  kind: "self-friend" | "profile-playlist" | "playlist-genre";
  weight?: number;
}

export interface SpotifyGraphData {
  nodes: SpotifyGraphNode[];
  links: SpotifyGraphLink[];
}

export interface SpotifyTasteStub {
  /** Placeholder for future AI enrichment. */
  source: "heuristic" | "ai_inference";
  topGenres: { id: string; label: string; weight: number }[];
  notes?: string;
}

export interface SpotifyStats {
  playlistCount: number;
  playlistsWithTracks: number;
  trackCount: number;
  uniqueArtists: number;
  genreCount: number;
  followers: number;
  following: number;
  friendCount: number;
}

export interface SpotifyTasteResult {
  kind: "spotify";
  scrapedAt: number;
  pinned?: boolean;
  cached?: boolean;
  demo?: boolean;
  profile: SpotifyProfile;
  friends: SpotifyProfile[];
  playlists: SpotifyPlaylistSummary[];
  genres: SpotifyGenre[];
  graph: SpotifyGraphData;
  taste?: SpotifyTasteStub;
  stats: SpotifyStats;
}

export function isSpotifyTasteResult(value: unknown): value is SpotifyTasteResult {
  if (!value || typeof value !== "object") return false;
  return (value as { kind?: string }).kind === "spotify";
}

/** Parse scraper `plays` string into a number (global Spotify streams). */
export function parsePlayCount(plays?: string): number | null {
  if (!plays) return null;
  const n = Number(String(plays).replace(/,/g, "").trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Compact stream count for UI (e.g. 258.6M). */
export function formatPlayCount(plays?: string): string {
  const n = parsePlayCount(plays);
  if (n == null) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
