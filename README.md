# social_graph

Instagram / LinkedIn interaction graph — visualize who comments on your posts, cluster friend groups, and share pinned snapshots without re-scraping.

## Local dev

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without `APIFY_TOKEN`, demo data is used (`/graph/wanderlust`). Multi-platform demo: [`/demo`](http://localhost:3000/demo).

## Pinned snapshots (no scrape data in git by default)

Scraped JSON lives in **Vercel Blob** (production) or gitignored `data/snapshots/` (local). The Diandra LinkedIn snapshot is committed for a shareable pinned demo.

```bash
# Import raw export → local snapshot (Instagram comments or LinkedIn HarvestAPI dataset)
npm run import-raw-snapshot -- diandra data/linkedin_raw/profile/diandra_linkedin_scrape_71226.json

# After deploy, push to production Blob
npm run import-raw-snapshot -- diandra data/linkedin_raw/profile/diandra_linkedin_scrape_71226.json --push https://your-app.vercel.app
```

Share link: `/demo` (Diandra) or `/graph/<handle>/pinned` (other handles)

## Deploy on Vercel

Step-by-step (env vars, Blob, KV, Chat / TokenRouter): **[docs/vercel.md](docs/vercel.md)**

Short version:

1. Import this repo on [Vercel](https://vercel.com/new) (Next.js is auto-detected).
2. Set `NEXT_PUBLIC_SITE_URL` and `SNAPSHOT_PIN_SECRET`.
3. Set `TOKENROUTER_API_KEY` so the Chat tab works.
4. Optional: add **Blob** (new pinned snapshots) and **KV** (live-scrape cache).
5. Leave `APIFY_TOKEN` unset unless you have Apify credits — `/demo` is snapshot-only.

Redeploy after changing any `NEXT_PUBLIC_*` variable.
