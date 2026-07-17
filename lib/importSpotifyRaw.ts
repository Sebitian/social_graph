import type {
  SpotifyGenre,
  SpotifyGenreEvidence,
  SpotifyGraphData,
  SpotifyGraphLink,
  SpotifyGraphNode,
  SpotifyPlaylistSummary,
  SpotifyProfile,
  SpotifyStats,
  SpotifyTasteResult,
  SpotifyTrack,
} from "./spotifyTypes";

/** Raw profile row from the Spotify profile scraper. */
export interface RawSpotifyProfile {
  source_url?: string;
  user_id?: string;
  display_name?: string;
  profile_image?: string;
  followers_count?: number;
  following_count?: number;
  total_public_playlists_count?: number;
  playlists?: Array<{
    title?: string;
    url?: string;
    image?: string;
    created_at_proxy?: string | null;
  }>;
}

/** Raw playlist dump from the Spotify playlist scraper. */
export interface RawSpotifyPlaylist {
  playlistId?: string;
  playlistName?: string;
  description?: string;
  ownerName?: string;
  ownerId?: string;
  ownerImage?: string;
  images?: string[];
  totalTracks?: number;
  tracks?: Array<{
    trackName?: string;
    trackId?: string;
    artists?: Array<{ artistName?: string; artistId?: string }>;
    plays?: string;
    trackDuration?: number;
    albumName?: string;
    albumId?: string;
    albumArt?: string;
    contentRating?: string;
    addedAt?: string;
    trackNumber?: number;
  }>;
}

const GENRE_COLORS = [
  "#1DB954",
  "#1ED760",
  "#2E77D0",
  "#E13300",
  "#AF2896",
  "#FF4632",
  "#509BF5",
  "#F59B23",
  "#B49BC8",
  "#148A08",
];

/** Artist / title keyword → genre label. Evidence-backed heuristic for v1. */
const ARTIST_GENRE: Record<string, string> = {
  miguel: "Alt R&B",
  "the weeknd": "Alt R&B",
  "sza": "Alt R&B",
  "frank ocean": "Alt R&B",
  "post malone": "Hip-Hop / Pop",
  "travis scott": "Hip-Hop",
  "yung pinch": "Hip-Hop",
  "kodak black": "Hip-Hop",
  "asap rocky": "Hip-Hop",
  "a$ap rocky": "Hip-Hop",
  future: "Hip-Hop",
  "lil wayne": "Hip-Hop",
  "wiz khalifa": "Hip-Hop",
  "kid cudi": "Hip-Hop",
  "saint jhn": "Hip-Hop / Pop",
  "trevor daniel": "Pop / R&B",
  "tones and i": "Pop",
  "tove lo": "Pop / Electronic",
  "david guetta": "Dance / Electronic",
  sia: "Pop",
  "robin schulz": "Dance / Electronic",
  "hippie sabotage": "Indie Electronic",
  inzo: "Indie Electronic",
  "maribou state": "Indie Electronic",
  masego: "Jazz / Soul",
  fkj: "Jazz / Soul",
  "norah jones": "Jazz / Soul",
  "def leppard": "Rock",
  "ozzy osbourne": "Rock",
  raign: "Cinematic Pop",
  "tai verdes": "Indie Pop",
  "chase atlantic": "Alt Pop",
  "surf mesa": "Dance / Electronic",
  "party favor": "Dance / Electronic",
  "rudimental": "Dance / Electronic",
  "sir sly": "Indie Rock",
  "blackbear": "Alt Pop",
  "poldoore": "Downtempo",
  "fliptrix": "Hip-Hop",
  "abhi the nomad": "Hip-Hop",
  "sebastian paul": "Indie Pop",
  "lord kael": "Indie Electronic",
  "rufi-o": "Indie Pop",
  "tyla yaweh": "Hip-Hop / Pop",
  "kiara": "Pop",
  kiiara: "Pop",
};

const TITLE_GENRE_HINTS: Array<{ pattern: RegExp; genre: string }> = [
  { pattern: /\b(high|drugs|smoke|weed|ganja)\b/i, genre: "Chill / Stoner" },
  { pattern: /\b(party|dance|monkey)\b/i, genre: "Dance / Electronic" },
  { pattern: /\b(funeral|hills|wicked|oblivion)\b/i, genre: "Dark Pop" },
  { pattern: /\b(sugar|pour some)\b/i, genre: "Rock" },
];

function playlistIdFromUrl(url: string): string {
  const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
  return match?.[1] ?? url;
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeArtist(name: string): string {
  return name.trim().toLowerCase();
}

function parseTracks(raw: RawSpotifyPlaylist): SpotifyTrack[] {
  return (raw.tracks ?? [])
    .filter((t) => t.trackId && t.trackName)
    .map((t) => ({
      trackName: t.trackName!,
      trackId: t.trackId!,
      artists: (t.artists ?? [])
        .filter((a) => a.artistName)
        .map((a) => ({
          artistName: a.artistName!,
          artistId: a.artistId,
        })),
      plays: t.plays,
      trackDuration: t.trackDuration,
      albumName: t.albumName,
      albumId: t.albumId,
      albumArt: t.albumArt,
      contentRating: t.contentRating,
      addedAt: t.addedAt,
      trackNumber: t.trackNumber,
    }));
}

function inferTrackGenres(track: SpotifyTrack): Array<{ genre: string; reason: string }> {
  const hits: Array<{ genre: string; reason: string }> = [];
  const seen = new Set<string>();

  for (const artist of track.artists) {
    const key = normalizeArtist(artist.artistName);
    const mapped = ARTIST_GENRE[key];
    if (mapped && !seen.has(mapped)) {
      seen.add(mapped);
      hits.push({ genre: mapped, reason: `artist:${artist.artistName}` });
    }
  }

  for (const hint of TITLE_GENRE_HINTS) {
    if (hint.pattern.test(track.trackName) && !seen.has(hint.genre)) {
      seen.add(hint.genre);
      hits.push({ genre: hint.genre, reason: `title:${track.trackName}` });
    }
  }

  if (hits.length === 0) {
    hits.push({ genre: "Eclectic", reason: "fallback:unclassified" });
  }

  return hits;
}

function buildGenresFromPlaylists(
  playlists: SpotifyPlaylistSummary[],
): SpotifyGenre[] {
  const bucket = new Map<
    string,
    {
      label: string;
      weight: number;
      playlistIds: Set<string>;
      evidence: SpotifyGenreEvidence[];
    }
  >();

  for (const playlist of playlists) {
    if (!playlist.tracks?.length) continue;
    for (const track of playlist.tracks) {
      for (const hit of inferTrackGenres(track)) {
        const id = slugify(hit.genre);
        let entry = bucket.get(id);
        if (!entry) {
          entry = {
            label: hit.genre,
            weight: 0,
            playlistIds: new Set(),
            evidence: [],
          };
          bucket.set(id, entry);
        }
        entry.weight += 1;
        entry.playlistIds.add(playlist.id);
        if (entry.evidence.length < 8) {
          entry.evidence.push({
            trackId: track.trackId,
            trackName: track.trackName,
            artistNames: track.artists.map((a) => a.artistName),
            reason: hit.reason,
          });
        }
      }
    }
  }

  return [...bucket.entries()]
    .map(([id, entry], index) => ({
      id,
      label: entry.label,
      weight: entry.weight,
      playlistIds: [...entry.playlistIds],
      evidence: entry.evidence,
      color: GENRE_COLORS[index % GENRE_COLORS.length],
    }))
    .sort((a, b) => b.weight - a.weight);
}

function buildGraph(
  profile: SpotifyProfile,
  friends: SpotifyProfile[],
  playlists: SpotifyPlaylistSummary[],
  genres: SpotifyGenre[],
): SpotifyGraphData {
  const selfId = `self:${profile.userId}`;
  const nodes: SpotifyGraphNode[] = [
    {
      id: selfId,
      label: profile.displayName,
      kind: "self",
      imageUrl: profile.profileImage,
      refId: profile.userId,
      weight: 1,
      color: "#1DB954",
    },
  ];
  const links: SpotifyGraphLink[] = [];
  const personNodeId = new Map<string, string>([[profile.userId, selfId]]);

  for (const friend of friends) {
    const nodeId = `friend:${friend.userId}`;
    personNodeId.set(friend.userId, nodeId);
    nodes.push({
      id: nodeId,
      label: friend.displayName,
      kind: "friend",
      imageUrl: friend.profileImage,
      refId: friend.userId,
      weight: 1,
      color: "#509BF5",
    });
    links.push({
      source: selfId,
      target: nodeId,
      kind: "self-friend",
      weight: 1,
    });
  }

  for (const playlist of playlists) {
    const nodeId = `playlist:${playlist.id}`;
    const ownerNode =
      personNodeId.get(playlist.ownerId) ?? selfId;
    nodes.push({
      id: nodeId,
      label: playlist.title,
      kind: "playlist",
      imageUrl: playlist.image,
      refId: playlist.id,
      ownerId: playlist.ownerId,
      hasTracks: playlist.hasTracks,
      trackCount: playlist.trackCount ?? playlist.tracks?.length,
      weight: playlist.hasTracks ? 1.2 : 1,
      color: playlist.hasTracks ? "#1ED760" : "#535353",
    });
    links.push({
      source: ownerNode,
      target: nodeId,
      kind: "profile-playlist",
      weight: 1,
    });
  }

  for (const genre of genres) {
    const nodeId = `genre:${genre.id}`;
    const linkedPlaylists = genre.playlistIds.filter((playlistId) =>
      playlists.some((p) => p.id === playlistId),
    );
    if (linkedPlaylists.length === 0) continue;

    nodes.push({
      id: nodeId,
      label: genre.label,
      kind: "genre",
      refId: genre.id,
      weight: genre.weight,
      color: genre.color,
    });
    for (const playlistId of linkedPlaylists) {
      links.push({
        source: `playlist:${playlistId}`,
        target: nodeId,
        kind: "playlist-genre",
        weight: genre.weight,
      });
    }
  }

  return { nodes, links };
}

function computeStats(
  profile: SpotifyProfile,
  friends: SpotifyProfile[],
  playlists: SpotifyPlaylistSummary[],
  genres: SpotifyGenre[],
): SpotifyStats {
  const artistSet = new Set<string>();
  let trackCount = 0;
  for (const playlist of playlists) {
    for (const track of playlist.tracks ?? []) {
      trackCount += 1;
      for (const artist of track.artists) {
        artistSet.add(normalizeArtist(artist.artistName));
      }
    }
  }

  return {
    playlistCount: playlists.length,
    playlistsWithTracks: playlists.filter((p) => p.hasTracks).length,
    trackCount,
    uniqueArtists: artistSet.size,
    genreCount: genres.length,
    followers: profile.followersCount,
    following: profile.followingCount,
    friendCount: friends.length,
  };
}

export function findRawProfile(
  profiles: RawSpotifyProfile[],
  displayNameOrId: string,
): RawSpotifyProfile | null {
  const needle = displayNameOrId.trim().toLowerCase();
  return (
    profiles.find(
      (p) =>
        p.display_name?.toLowerCase() === needle ||
        p.user_id?.toLowerCase() === needle ||
        p.display_name?.toLowerCase().includes(needle),
    ) ?? null
  );
}

export function normalizePlaylistDumps(
  dumps: unknown,
): RawSpotifyPlaylist[] {
  if (Array.isArray(dumps)) {
    return dumps.filter(
      (item): item is RawSpotifyPlaylist =>
        Boolean(item && typeof item === "object" && "playlistId" in item),
    );
  }
  if (dumps && typeof dumps === "object" && "playlistId" in dumps) {
    return [dumps as RawSpotifyPlaylist];
  }
  return [];
}

function toProfile(
  raw: RawSpotifyProfile,
  role: "self" | "friend",
  handle?: string,
): SpotifyProfile {
  const userId = raw.user_id ?? "unknown";
  const displayName = raw.display_name ?? "Spotify User";
  const derivedHandle =
    displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24) || userId.slice(0, 12);

  return {
    userId,
    displayName,
    username: handle ?? derivedHandle,
    profileImage: raw.profile_image,
    sourceUrl: raw.source_url ?? `https://open.spotify.com/user/${userId}`,
    followersCount: raw.followers_count ?? 0,
    followingCount: raw.following_count ?? 0,
    totalPublicPlaylists: raw.total_public_playlists_count ?? 0,
    role,
  };
}

type PlaylistIndex = {
  tracksByPlaylistId: Map<string, SpotifyTrack[]>;
  coverByPlaylistId: Map<string, string>;
  nameByPlaylistId: Map<string, string>;
  ownerByPlaylistId: Map<string, { ownerId: string; ownerName: string }>;
};

function indexPlaylistDumps(rawPlaylists: RawSpotifyPlaylist[]): PlaylistIndex {
  const tracksByPlaylistId = new Map<string, SpotifyTrack[]>();
  const coverByPlaylistId = new Map<string, string>();
  const nameByPlaylistId = new Map<string, string>();
  const ownerByPlaylistId = new Map<
    string,
    { ownerId: string; ownerName: string }
  >();

  for (const dump of rawPlaylists) {
    if (!dump.playlistId) continue;
    const tracks = parseTracks(dump);
    tracksByPlaylistId.set(dump.playlistId, tracks);
    if (dump.images?.[0]) coverByPlaylistId.set(dump.playlistId, dump.images[0]);
    if (dump.playlistName) nameByPlaylistId.set(dump.playlistId, dump.playlistName);
    if (dump.ownerId) {
      ownerByPlaylistId.set(dump.playlistId, {
        ownerId: dump.ownerId,
        ownerName: dump.ownerName ?? dump.ownerId,
      });
    }
  }

  return {
    tracksByPlaylistId,
    coverByPlaylistId,
    nameByPlaylistId,
    ownerByPlaylistId,
  };
}

function buildPlaylistsForPerson(
  person: SpotifyProfile,
  rawProfile: RawSpotifyProfile,
  index: PlaylistIndex,
  mode: "all-profile" | "scraped-only",
): SpotifyPlaylistSummary[] {
  const profileEntries = (rawProfile.playlists ?? []).filter((p) => p.url);
  const metaById = new Map(
    profileEntries.map((p) => [playlistIdFromUrl(p.url!), p] as const),
  );
  const playlists: SpotifyPlaylistSummary[] = [];
  const seen = new Set<string>();

  if (mode === "all-profile") {
    for (const p of profileEntries) {
      const id = playlistIdFromUrl(p.url!);
      const tracks = index.tracksByPlaylistId.get(id);
      seen.add(id);
      playlists.push({
        id,
        title: index.nameByPlaylistId.get(id) ?? p.title ?? "Untitled",
        url: p.url!,
        image: index.coverByPlaylistId.get(id) ?? p.image,
        trackCount: tracks?.length,
        tracks,
        hasTracks: Boolean(tracks && tracks.length > 0),
        ownerId: person.userId,
        ownerName: person.displayName,
      });
    }

    // Orphan dumps owned by this person but missing from the profile index.
    for (const [id, tracks] of index.tracksByPlaylistId) {
      if (seen.has(id)) continue;
      const dumpOwner = index.ownerByPlaylistId.get(id);
      if (dumpOwner && dumpOwner.ownerId !== person.userId) continue;
      seen.add(id);
      playlists.push({
        id,
        title: index.nameByPlaylistId.get(id) ?? id,
        url: `https://open.spotify.com/playlist/${id}`,
        image: index.coverByPlaylistId.get(id),
        trackCount: tracks.length,
        tracks,
        hasTracks: tracks.length > 0,
        ownerId: person.userId,
        ownerName: person.displayName,
      });
    }
    return playlists;
  }

  // scraped-only: only playlists present in the dump index for this friend.
  for (const [id, tracks] of index.tracksByPlaylistId) {
    const dumpOwner = index.ownerByPlaylistId.get(id);
    if (dumpOwner && dumpOwner.ownerId !== person.userId) continue;
    const profileMeta = metaById.get(id);
    playlists.push({
      id,
      title:
        index.nameByPlaylistId.get(id) ??
        profileMeta?.title ??
        id,
      url: profileMeta?.url ?? `https://open.spotify.com/playlist/${id}`,
      image: index.coverByPlaylistId.get(id) ?? profileMeta?.image,
      trackCount: tracks.length,
      tracks,
      hasTracks: tracks.length > 0,
      ownerId: person.userId,
      ownerName: person.displayName,
    });
  }

  return playlists;
}

export type SpotifyFriendInput = {
  profile: RawSpotifyProfile;
  playlists: RawSpotifyPlaylist[];
};

/**
 * Merge a primary profile + playlist scrapes, optionally with friend profiles
 * and their playlist scrapes, into one taste snapshot.
 */
export function buildSpotifyTasteResult(
  rawProfile: RawSpotifyProfile,
  rawPlaylists: RawSpotifyPlaylist[],
  options?: {
    scrapedAt?: number;
    handle?: string;
    friends?: SpotifyFriendInput[];
  },
): SpotifyTasteResult {
  const profile = toProfile(rawProfile, "self", options?.handle);
  const friends: SpotifyProfile[] = [];
  const allPlaylists: SpotifyPlaylistSummary[] = [];

  const selfIndex = indexPlaylistDumps(rawPlaylists);
  allPlaylists.push(
    ...buildPlaylistsForPerson(profile, rawProfile, selfIndex, "all-profile"),
  );

  for (const friendInput of options?.friends ?? []) {
    const friend = toProfile(friendInput.profile, "friend");
    friends.push(friend);
    const friendIndex = indexPlaylistDumps(friendInput.playlists);
    allPlaylists.push(
      ...buildPlaylistsForPerson(
        friend,
        friendInput.profile,
        friendIndex,
        "scraped-only",
      ),
    );
  }

  const genres = buildGenresFromPlaylists(allPlaylists);
  /** Top genres overall for stats; graph gets a thinner per-owner slice via buildGraph. */
  const graphGenres = genres.slice(0, 8);
  const graph = buildGraph(profile, friends, allPlaylists, graphGenres);
  const stats = computeStats(profile, friends, allPlaylists, genres);

  return {
    kind: "spotify",
    scrapedAt: options?.scrapedAt ?? Date.now(),
    pinned: true,
    cached: true,
    profile,
    friends,
    playlists: allPlaylists,
    genres,
    graph,
    taste: {
      source: "heuristic",
      topGenres: genres.slice(0, 8).map((g) => ({
        id: g.id,
        label: g.label,
        weight: g.weight,
      })),
      notes: "v1 genre labels from artist/title heuristics; replaceable by AI.",
    },
    stats,
  };
}
