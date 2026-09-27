# Getting started

Back to the [README](../README.md).

Starling is a Next.js app. Local development works with **no API keys** — it serves mock data and the committed `/demo` snapshots.

## Prerequisites

- Node.js 20+
- npm

## Install and run

```bash
git clone https://github.com/<you>/social_graph.git
cd social_graph
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`.env.example` documents every variable. Leave them empty for demo mode. Chat needs `TOKENROUTER_API_KEY`; live Instagram scrapes need `APIFY_TOKEN` (currently unused — the project is snapshot/demo-first).

## What to open first

1. **Landing** (`/`) — enter one or more handles and click **Map network**. Empty platforms are ignored. With no Apify token, search pages use deterministic mock data.
2. **Live walkthrough** (`/demo`) — the full product: platform tabs, Person/Company, Analytics, Chat, Profile. Frozen snapshots, not a live scrape.
3. **Mock graph** (`/graph/wanderlust`) — same Map UI against generated Instagram-style data.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run lint` | ESLint |
| `npm run import-raw-snapshot -- <handle> <file.json>` | Instagram comments or LinkedIn HarvestAPI → snapshot |
| `npm run import-company-snapshot -- <handle> <file.json>` | LinkedIn employee search → company snapshot |
| `npm run import-conference-snapshot -- <handle> <file.json>` | Luma guest list + LinkedIn people search → conference snapshot |

Instagram, Facebook, TikTok, and Spotify each have a dedicated `scripts/import-*-snapshot.ts` with their own flags. Full commands: [snapshots.md](snapshots.md).

## Environment (optional)

| Variable | Needed for |
| --- | --- |
| _(none)_ | Landing, `/demo`, mock `/graph/[handle]` |
| `TOKENROUTER_API_KEY` | Chat tab answers |
| `SNAPSHOT_PIN_SECRET` | Pinning new snapshots (`POST /api/snapshot`); required in production |
| `BLOB_READ_WRITE_TOKEN` | Store pins in Vercel Blob |
| `KV_REST_API_*` | Chat quotas + scrape cache across serverless instances |
| `APIFY_TOKEN` | Live Instagram scrape — leave unset unless you have credits |
| `NEXT_PUBLIC_SITE_URL` | OG tags and share URLs |

Chat quotas (`CHAT_MESSAGES_PER_VISITOR`, etc.) are on by default. Set `CHAT_QUOTA=0` only for unlimited local testing.

Production deploy: [vercel.md](vercel.md).
