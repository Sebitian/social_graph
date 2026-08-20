# Snapshots

Back to the [README](../README.md).

Pinned pages never call Apify. They read JSON from `data/snapshots/` (git or local) or Vercel Blob. The search route `/graph/[handle]` uses mock data unless `APIFY_TOKEN` is set.

## Demo bundle

These files are committed so `/demo` works on a fresh clone and on Vercel without Blob:

| File | Loaded as |
| --- | --- |
| `diandra.json` | LinkedIn person (canonical demo handle) |
| `kossof-instagram.json` | Instagram company |
| `kossof-instagram-people.json` | Instagram employees (Person dropdown) |
| `kossof-facebook.json` | Facebook |
| `kossof-tiktok.json` | TikTok |
| `sebastian-spotify.json` | Spotify |
| `formationbio.json` | LinkedIn company |

Standalone (also committed): `romanian.json` — conference / Luma guest list at `/graph/romanian/pinned`.

Older extras: `jppap.json` (comment-only Instagram), `nousresearch.json` (older company dump). Other `data/snapshots/*.json` files are gitignored.

Raw Apify/HarvestAPI dumps live under `data/linkedin_raw`, `data/insta_raw`, `data/facebook_raw`, `data/tiktok_raw`, `data/spotify_raw`, `data/conference_attendees` and are import sources, not what the UI reads.

## Import a new snapshot

```bash
# LinkedIn profile posts or Instagram comment array
npm run import-raw-snapshot -- myhandle path/to/export.json

# LinkedIn company employees
npm run import-company-snapshot -- formationbio path/to/employees.json

# Conference / Luma guest list + LinkedIn people-search export
npm run import-conference-snapshot -- romanian path/to/attendees.json --name "Romanian Conference"

# Facebook: posts + optional page + follows
npx tsx scripts/import-facebook-snapshot.ts kossof-facebook posts.json [page.json] [follows.json]

# TikTok: posts + optional profile
npx tsx scripts/import-tiktok-snapshot.ts kossof-tiktok posts.json [profile.json]

# Spotify: profiles + self playlists + optional friend playlists
npx tsx scripts/import-spotify-snapshot.ts sebastian-spotify profiles.json self-playlists.json [friend-playlists.json]
```

Instagram company and employee importers take `--profile` / `--posts` / `--reels` flags — see the header comments in `scripts/import-instagram-snapshot.ts` and `scripts/import-instagram-people-snapshot.ts`.

Each importer writes `data/snapshots/<handle>.json`. Open `/graph/<handle>/pinned` locally to verify.

## Pin to production

After deploy, push a snapshot the git repo does not already contain:

```bash
npm run import-raw-snapshot -- myhandle path/to/export.json --push https://your-app.vercel.app
```

That hits `POST /api/snapshot` with `x-pin-secret` = `SNAPSHOT_PIN_SECRET` and stores the JSON in Vercel Blob as `snapshots/<handle>.json`.

`SNAPSHOT_PIN_SECRET` is required in production. Blob is only needed for **new** pins; `/demo` already ships in git.

## Live scrape (optional)

`getNetwork` in `lib/scrape.ts` is the search path. With `APIFY_TOKEN` unset it returns deterministic mocks (`lib/mock.ts`). Do not enable live Apify unless you have credits. Prefer importing an existing export instead of scraping Instagram, Facebook, or TikTok live.

Deploy and env details: [vercel.md](vercel.md).
