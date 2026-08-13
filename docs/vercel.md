# Deploy on Vercel

The app is a Next.js 16 project. The committed demo snapshots (`/demo`) work **without** Apify, KV, or Blob. Chat, pinning new snapshots, and live scrapes need extra env vars.

Live reference: [social-graph-nu.vercel.app/demo](https://social-graph-nu.vercel.app/demo)

## 1. Import the project

1. Open [vercel.com/new](https://vercel.com/new) and import this GitHub repo.
2. Framework Preset should be **Next.js** (auto-detected).
3. Root directory: leave default. Build command `next build`, output default.
4. Click **Deploy** once so the project exists. The demo page should already load from git (`data/snapshots/*.json`).

Set env vars **before** the next deploy if you want Chat / Blob / a custom site URL.

## 2. Environment variables

Project → **Settings → Environment Variables**. Add them for **Production** (and Preview if you want the same behavior on PR deploys). `NEXT_PUBLIC_*` values are inlined at **build** time — change them, then redeploy.

### Required for a real production URL

| Name | Example | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://your-app.vercel.app` | Used for OG metadata and pin/share URLs. Use your custom domain once it is attached. |
| `SNAPSHOT_PIN_SECRET` | random 32+ char string | Authorizes `POST /api/snapshot`. **Required in production** — without it, pinning is rejected. Generate with `openssl rand -hex 24`. |

### Chat tab (TokenRouter)

| Name | Example | Notes |
| --- | --- | --- |
| `TOKENROUTER_API_KEY` | from [tokenrouter.com](https://www.tokenrouter.com/) | Server-only. Never put this in the browser or share it. |
| `TOKENROUTER_BASE_URL` | `https://api.tokenrouter.io/v1` | Optional; this is the default. |
| `TOKENROUTER_MODEL` | `auto:balance` | Optional; this is the default. |
| `CHAT_MESSAGES_PER_VISITOR` | `5` | Demo questions per visitor per UTC day. |
| `CHAT_MESSAGES_PER_IP` | `20` | Cap per IP so cookie-clearing does not help much. |
| `CHAT_MESSAGES_GLOBAL_PER_DAY` | `200` | Kill switch for the whole site. |
| `CHAT_COOLDOWN_SECONDS` | `8` | Pause between questions. |

Chat streams for several seconds (`maxDuration = 60` on `/api/chat`). Hobby is enough for that.

**Do not give visitors your API key.** The browser only talks to `/api/chat`. Quotas are on by default (cookie + IP + global + 8s cooldown, plus duplicate/short-message checks). Connect **KV** so those counts survive across serverless instances — without KV, limits are per-instance and weaker.

Set `CHAT_QUOTA=0` only for unlimited local testing.

### Vercel Blob (pin new snapshots)

1. Project → **Storage → Create Database → Blob**.
2. Connect it to this project. Vercel injects `BLOB_READ_WRITE_TOKEN` automatically.
3. Redeploy.

Pinned JSON is stored privately as `snapshots/<handle>.json`. The `/demo` bundle is already in git, so Blob is only needed to **pin new handles** after deploy.

### Vercel KV (Chat quotas + optional scrape cache)

1. Storage → **Create Database → KV (Redis)**.
2. Connect it. Vercel injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Optional: `CACHE_TTL_SECONDS` (default `86400`).

Connect KV for the public demo so Chat quotas are shared across instances. Without it, each serverless isolate has its own counter. KV also caches live Apify scrapes if you turn those on.

### Live scraping (optional — currently unused)

The project is in **demo mode**. Do **not** set `APIFY_TOKEN` unless you have credits and want `/graph/[handle]` to hit Apify.

| Name | Notes |
| --- | --- |
| `APIFY_TOKEN` | Enables live Instagram scraping. Unset → mock/demo data. |
| `NEXT_PUBLIC_FREE_*` / `NEXT_PUBLIC_MAX_*` | Scrape budget caps. Defaults in `.env.example` are fine. |

`/api/scrape` sets `maxDuration = 300`. That needs a **Vercel Pro** function limit. Demo, Chat, and pinned pages do not.

## 3. Recommended Production set

Minimum for `/demo` + Chat + correct links:

```
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
SNAPSHOT_PIN_SECRET=<openssl rand -hex 24>
TOKENROUTER_API_KEY=<from tokenrouter.com>
TOKENROUTER_BASE_URL=https://api.tokenrouter.io/v1
TOKENROUTER_MODEL=auto:balance
CHAT_MESSAGES_PER_VISITOR=5
CHAT_MESSAGES_PER_IP=20
CHAT_MESSAGES_GLOBAL_PER_DAY=200
CHAT_COOLDOWN_SECONDS=8
```

Plus Blob if you will pin extra snapshots. Skip `APIFY_TOKEN`.

## 4. After env vars

Redeploy: **Deployments → ⋯ → Redeploy** (or push a commit). Confirm:

- `/` loads
- `/demo` shows the multi-platform graph (LinkedIn, Instagram, Facebook, TikTok, Spotify, Company)
- Profile tab lists the public source links
- Chat answers if `TOKENROUTER_API_KEY` is set

## 5. Custom domain

1. Project → **Settings → Domains** → add the domain.
2. Update `NEXT_PUBLIC_SITE_URL` to `https://your-domain.com`.
3. Redeploy.

## 6. Push a snapshot to production Blob

Only needed for handles **not** already committed under `data/snapshots/`.

```bash
# Local snapshot first (example)
npm run import-raw-snapshot -- diandra data/linkedin_raw/profile/diandra_linkedin_scrape_71226.json

# Upload to the deployed app (uses SNAPSHOT_PIN_SECRET)
SNAPSHOT_PIN_SECRET=xxx npx tsx scripts/push-snapshot.ts diandra https://your-app.vercel.app
```

Or:

```bash
npm run import-raw-snapshot -- <handle> <raw.json> --push https://your-app.vercel.app
```

The pin route checks the `x-pin-secret` header against `SNAPSHOT_PIN_SECRET`.

## 7. What each service is for

| Service | Used by | If missing |
| --- | --- | --- |
| Git snapshots | `/demo`, `/graph/<handle>/pinned` for committed files | Those pages 404 |
| Blob | New pins, production snapshot store | Disk snapshots in the deployment still work; new pins stay local-only |
| KV | Scrape cache **and Chat demo quotas** | Quotas fall back to in-memory (weak on Vercel) |
| TokenRouter | Chat tab | Chat UI shows a config error |
| Apify | Live `/graph/[handle]` | Deterministic mock data |

## Checklist

- [ ] Repo imported, Next.js preset, first deploy succeeds
- [ ] `NEXT_PUBLIC_SITE_URL` set to the canonical https origin
- [ ] `SNAPSHOT_PIN_SECRET` set in Production
- [ ] `TOKENROUTER_API_KEY` set if Chat should work
- [ ] Blob connected if you will pin extra snapshots
- [ ] KV connected for Chat quotas (and live-scrape cache if you use Apify)
- [ ] `APIFY_TOKEN` left empty unless you have credits
- [ ] Redeploy after changing `NEXT_PUBLIC_*`
- [ ] `/demo` and Chat verified on the production URL
