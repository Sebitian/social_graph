# Architecture

Back to the [README](../README.md).

Starling is a Next.js App Router app. Pages load snapshots or mock data on the server; `GraphResult` is the client shell that owns platform switching and the four footer tabs.

```mermaid
flowchart LR
  home["/ HeroInput"] --> graph["/graph/handle"]
  demo["/demo"] --> pinned["loadPinnedDemo"]
  graph --> result["GraphResult"]
  pinned --> result
  result --> map["Map visualizers"]
  result --> analytics["AnalyticsPanel"]
  result --> chat["ChatPanel"]
  result --> profile["ProfilePanel"]
```

## Routes

| Path | Role |
| --- | --- |
| `/` | Marketing landing, handle form, static feature copy |
| `/demo` | Diandra multi-platform pinned bundle |
| `/graph/[handle]` | Search/live page — currently mock data via `getNetwork` |
| `/graph/[handle]/pinned` | Disk or Blob snapshot; Diandra redirects to `/demo` |
| `/api/scrape` | Graph JSON (pinned snapshot or mock/live) |
| `/api/snapshot` | Pin a snapshot (`x-pin-secret`) |
| `/api/chat` | Streaming Chat (TokenRouter + tools + quotas) |
| `/api/company`, `/api/spotify` | Companion snapshot JSON |
| `/api/avatar/*` | Avatar proxy so canvas can draw portraits |

## UI components

### Shell

| Component | Job |
| --- | --- |
| `HeroInput` | Landing form — one field per platform, submits the first filled handle |
| `GraphResult` | Orchestrator: platform, Person/Company, footer tab, selection, fullscreen |
| `GraphFooterTabs` | Map / Analytics / Chat / Profile |
| `GraphHowToRead` | Three-step legend for people graphs |
| `GraphNodeSearch` | Filter/highlight nodes on the map |
| `InstagramModeControls` | Person vs Company (+ person picker) for Instagram and LinkedIn |
| `LoadingSpinner`, `ShareCard`, `ScrapeBudgetSelector` | Loading, OG/share, scrape caps (search flow) |

### Map visualizers

| Component | Used when |
| --- | --- |
| `GraphVisualizer` | LinkedIn person, Instagram, Facebook — `react-force-graph-2d` |
| `CompanyGraphVisualizer` | LinkedIn company hub-and-spoke |
| `CompanyRosterTable` | Employee table instead of the graph |
| `ConferenceGraphVisualizer` | Luma event → companies → attendees |
| `TikTokGraphVisualizer` | Account → videos → hashtags |
| `SpotifyGraphVisualizer` | You → playlists → genres ← friend |

### Detail panels

Opened from a node click:

- `PersonPanel` — comments, reactions, proximity explanation
- `CompanyEmployeePanel` — title, location, tenure, school
- `TikTokVideoPanel` — video stats
- `SpotifyPlaylistPanel` — tracks in a playlist

Stats rails: `NetworkStats`, `CompanyNetworkStats`, `TikTokNetworkStats`, `SpotifyNetworkStats`.

### Analytics (`components/analytics/`)

`AnalyticsPanel` switches platform and range, then renders:

- `SocialAnalyticsBody` / `CompanyAnalyticsBody` / `TikTokAnalyticsBody` / `SpotifyAnalyticsBody`
- Shared chrome: `AnalyticsDashboardShell`, `KpiStrip`, `MetricTile`, `AnalyticsChart`, `TimeRangeControl`, `LocationMapChart`, `SchoolLogoChart`, `EmploymentTimelineChart`, `EmployeeRankChart`

### Chat (`components/chat/`)

`ChatPanel` streams from `/api/chat`. Helpers: markdown, mention chips, data tables, time charts, voice (`useChatVoice`).

## `lib/` — data and domain

| Module | Role |
| --- | --- |
| `types.ts`, `companyTypes.ts`, `conferenceTypes.ts`, `spotifyTypes.ts`, `tiktokTypes.ts` | Snapshot shapes |
| `graphUtils.ts` | Build people graphs, proximity rings, clusters, stats |
| `analytics.ts` | Time-ranged KPIs per platform |
| `snapshot.ts` | Read/write JSON on disk or Vercel Blob |
| `loadPinnedDemo.tsx` | Assemble the `/demo` companion bundle |
| `paths.ts` | `DEMO_HANDLE`, companion snapshot names |
| `scrape.ts` / `mock.ts` | Search path; mock when Apify is unset |
| `import*Raw.ts` | Turn Apify/HarvestAPI dumps into snapshots |
| `chat/` | Tools, quotas, TokenRouter provider, system prompt |
| `cache.ts`, `blob.ts`, `avatarUrl.ts` | KV cache, Blob, portrait proxying |

## Demo data

`/demo` is **not** one file. `loadPinnedDemo` merges:

| Snapshot | Platform |
| --- | --- |
| `data/snapshots/diandra.json` | LinkedIn person |
| `kossof-instagram.json` + `kossof-instagram-people.json` | Instagram company + salon staff |
| `aiman-instagram.json` | Aiman Naqvi Instagram, separate job |
| `kossof-facebook.json` | Facebook page |
| `kossof-tiktok.json` | TikTok |
| `sebastian-spotify.json` | Spotify |
| `formationbio.json` | LinkedIn company roster |

Standalone: `data/snapshots/romanian.json` is a conference attendee graph at `/graph/romanian/pinned` (not part of `/demo`).

How those files are built: [snapshots.md](snapshots.md).
