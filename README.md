# social_graph

Instagram / LinkedIn interaction graph — visualize who comments on your posts, cluster friend groups, and share pinned snapshots without re-scraping.

## Local dev

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without `APIFY_TOKEN`, demo data is used (`/graph/wanderlust`). Pinned LinkedIn demo: [`/graph/diandra/pinned`](http://localhost:3000/graph/diandra/pinned).

## Pinned snapshots (no scrape data in git by default)

Scraped JSON lives in **Vercel Blob** (production) or gitignored `data/snapshots/` (local). The Diandra LinkedIn snapshot is committed for a shareable pinned demo.

```bash
# Import raw export → local snapshot (Instagram comments or LinkedIn HarvestAPI dataset)
npm run import-raw-snapshot -- diandra data/raw/diandra_linkedin_scrape_71226.json

# After deploy, push to production Blob
npm run import-raw-snapshot -- diandra data/raw/diandra_linkedin_scrape_71226.json --push https://your-app.vercel.app
```

Share link: `/graph/<handle>/pinned`

## Deploy on Vercel

1. Import this repo on [Vercel](https://vercel.com)
2. Add **Blob** storage (connects `BLOB_READ_WRITE_TOKEN`)
3. Set `NEXT_PUBLIC_SITE_URL` and `SNAPSHOT_PIN_SECRET`
4. Upload snapshot with `--push` (see above)

Optional: `APIFY_TOKEN` + Vercel KV for live scrapes.
