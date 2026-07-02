# social_graph

Instagram interaction graph — visualize who comments on your posts, cluster friend groups, and share pinned snapshots without re-scraping.

## Local dev

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without `APIFY_TOKEN`, demo data is used (`/graph/wanderlust`).

## Pinned snapshots (no scrape data in git)

Scraped JSON lives in **Vercel Blob** (production) or gitignored `data/snapshots/` (local).

```bash
# Import raw comment export → local snapshot
npm run import-raw-snapshot -- jp_jppap data/raw/jp_jppap-comments.json

# After deploy, push to production Blob
npm run import-raw-snapshot -- jp_jppap data/raw/jp_jppap-comments.json --push https://your-app.vercel.app
```

Share link: `/graph/<handle>/pinned`

## Deploy on Vercel

1. Import this repo on [Vercel](https://vercel.com)
2. Add **Blob** storage (connects `BLOB_READ_WRITE_TOKEN`)
3. Set `NEXT_PUBLIC_SITE_URL` and `SNAPSHOT_PIN_SECRET`
4. Upload snapshot with `--push` (see above)

Optional: `APIFY_TOKEN` + Vercel KV for live scrapes.
