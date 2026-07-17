import fs from "fs";
import path from "path";
import {
  buildSpotifyTasteResult,
  findRawProfile,
  normalizePlaylistDumps,
  type RawSpotifyProfile,
} from "../lib/importSpotifyRaw";

/**
 * Usage:
 *   npx tsx scripts/import-spotify-snapshot.ts <handle> <profiles.json> <self-playlists.json> [friend-playlists.json] [self-name] [friend-name]
 *
 * Example:
 *   npx tsx scripts/import-spotify-snapshot.ts sebastian-spotify \
 *     data/spotify_raw/me_igor_diego_profiles.json \
 *     data/spotify_raw/me_shmok_playlist.json \
 *     data/spotify_raw/diego_playlists.json \
 *     Sebastian Diego
 */
const args = process.argv.slice(2);
const handleArg = args[0]?.replace(/^@/, "").trim().toLowerCase();
const profilesPath = args[1];
const selfPlaylistsPath = args[2];
const maybeFriendPlaylists = args[3];
const rest = args.slice(4);

let friendPlaylistsPath: string | undefined;
let selfName = "Sebastian";
let friendName = "Diego";

if (maybeFriendPlaylists && maybeFriendPlaylists.endsWith(".json")) {
  friendPlaylistsPath = maybeFriendPlaylists;
  if (rest[0]) selfName = rest[0];
  if (rest[1]) friendName = rest[1];
} else if (maybeFriendPlaylists) {
  selfName = maybeFriendPlaylists;
  if (rest[0]) friendName = rest[0];
}

if (!handleArg || !profilesPath || !selfPlaylistsPath) {
  console.error(
    "Usage: npx tsx scripts/import-spotify-snapshot.ts <handle> <profiles.json> <self-playlists.json> [friend-playlists.json] [self-name] [friend-name]",
  );
  process.exit(1);
}

function readJson(filePath: string): unknown {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(abs, "utf-8"));
}

const profilesParsed = readJson(profilesPath);
if (!Array.isArray(profilesParsed)) {
  console.error("Profiles JSON must be an array");
  process.exit(1);
}

const profile = findRawProfile(
  profilesParsed as RawSpotifyProfile[],
  selfName,
);
if (!profile) {
  console.error(`No profile matching "${selfName}"`);
  process.exit(1);
}

const selfPlaylists = normalizePlaylistDumps(readJson(selfPlaylistsPath));

const friends = [];
if (friendPlaylistsPath) {
  const friendProfile = findRawProfile(
    profilesParsed as RawSpotifyProfile[],
    friendName,
  );
  if (!friendProfile) {
    console.error(`No friend profile matching "${friendName}"`);
    process.exit(1);
  }
  friends.push({
    profile: friendProfile,
    playlists: normalizePlaylistDumps(readJson(friendPlaylistsPath)),
  });
}

const result = buildSpotifyTasteResult(profile, selfPlaylists, {
  handle: handleArg.replace(/-spotify$/, "") || "sebastian",
  scrapedAt: Date.now(),
  friends,
});

const outDir = path.join(process.cwd(), "data", "snapshots");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${handleArg}.json`);
fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf-8");

console.log(
  `Spotify snapshot → ${result.profile.displayName}` +
    (result.friends.length
      ? ` + friends [${result.friends.map((f) => f.displayName).join(", ")}]`
      : ""),
);
console.log(
  `  ${result.stats.playlistCount} playlists, ${result.stats.trackCount} tracks, ${result.stats.genreCount} genres, ${result.stats.friendCount} friends`,
);
console.log(`Wrote ${outFile}`);
