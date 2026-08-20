# NCPoliSearch

Nonpartisan, plain-language tracker for North Carolina General Assembly legislation. Built for the [NC Youth Legislative Council](https://ncylc.org). Live at **https://ncpolisearch.vercel.app**.

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind
- **Neon** (serverless Postgres) via **Drizzle ORM**
- **LegiScan API** — source of bill/legislator/vote data
- **Anthropic API** (`claude-haiku-4-5`) — generates the plain-language bill summaries and pro/con arguments
- **Vercel** — hosting, auto-deploy, and the daily cron job

## Local setup

```bash
npm install
```

Create `.env.local` in the project root with:

```
DATABASE_URL=postgresql://...        # Neon connection string
ANTHROPIC_API_KEY=sk-ant-...
LEGISCAN_API_KEY=...
CRON_SECRET=any-random-string        # only needed to hit /api/cron/poll locally
```

Ask a current NCYLC admin (or check the Environment Variables tab on the Vercel project) for the real values — they're never committed to this repo.

```bash
npm run dev
```

Open http://localhost:3000.

## Deployment

**There is no manual deploy step.** This repo is connected to Vercel's GitHub integration: every push to `main` triggers an automatic production build and deploy. To ship a change, just merge/push to `main`.

The Vercel project lives under the **NCYLC Vercel account** (not a personal account). The same 4 env vars above must be set there (Production, Preview, and Development) under **Project → Settings → Environment Variables** — if you rotate an API key, update it there too.

## How data stays up to date

`app/api/cron/poll/route.ts` runs automatically once a day (see `vercel.json` for the schedule), protected by `Authorization: Bearer <CRON_SECRET>`. Each run:

1. Polls LegiScan for new/changed NC bills and upserts them (`lib/poll.ts`).
2. Generates AI summaries for the newest bills that don't have one yet (`lib/summarize.ts`), using `claude-haiku-4-5`. Capped at 10 bills/run to stay inside the serverless time limit — a large backlog catches up over a few days automatically.

You can also run these manually against production data:

```bash
npm run poll         # fetch new/changed bills from LegiScan
npm run summarize    # backfill AI summaries for the whole pending queue (resumable, logs a running cost estimate)
```

## Project structure

```
app/            Next.js App Router pages + API routes (bills, legislators, map, ballot, compare)
components/     Shared UI (BillCard, FeaturedBillCard, DistrictMap, etc.)
lib/            Data access (lib/bills.ts, lib/legislators.ts), LegiScan client, AI summarization, PDF text extraction
db/             Drizzle schema (db/schema.ts) + migrations
scripts/        One-off/CLI scripts: poll, summarize, backfill, vote backfill, photo backfill
```

Notable details for future changes:

- **Legislator counts**: the `legislators` table can hold more rows than actual seats (mid-session replacements leave both the departed and incoming member on file). Queries that report a legislator count or roster (`getLegislators` in `lib/legislators.ts`, `getHomeStats` in `lib/bills.ts`) filter to the *current* member per district — keep both in sync if you touch this logic.
- **PDF parsing on Vercel**: `lib/billtext.ts` imports `lib/pdf-polyfill.ts` before `pdf-parse`, because `pdf-parse` (via pdf.js) expects a browser `DOMMatrix` global that Vercel's serverless Node runtime doesn't provide. Don't remove that import — the cron route will crash at load without it.
- **Homepage caching**: `app/page.tsx` sets `export const revalidate = 3600` (ISR) so stats and featured bills refresh hourly. The `/bills` and `/legislators` pages render dynamically instead because they read `searchParams`.

## License / ownership

Maintained by NC Youth Legislative Council. Code lives at `github.com/ncyouthlegislativecouncil/ncpolisearch`; hosting is on the NCYLC Vercel account so the project can be handed off between student maintainers without depending on any one person's accounts.
