# NCPoliSearch

Nonpartisan, plain-language tracker for North Carolina General Assembly legislation. Built for the [NC Youth Legislative Council](https://ncylc.org). Live at **https://www.ncpolisearch.com**.

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind
- **Data files** in `data/` — the whole dataset lives in the repo as JSON (no database at runtime)
- **LegiScan API** — source of bill/legislator/vote data
- **Anthropic API** (`claude-haiku-4-5`) — generates the plain-language bill summaries and pro/con arguments
- **Vercel** — hosting and auto-deploy
- **GitHub Actions** — the daily data update

## Local setup

```bash
npm install
```

The site itself needs no secrets to run — all data is in `data/`. To run the data update locally, create `.env.local` in the project root with:

```
ANTHROPIC_API_KEY=sk-ant-...
LEGISCAN_API_KEY=...
```

Ask a current NCYLC admin for the real values — they're never committed to this repo.

```bash
npm run dev
```

Open http://localhost:3000.

## Deployment

**There is no manual deploy step.** This repo is connected to Vercel's GitHub integration: every push to `main` triggers an automatic production build and deploy. To ship a change, just merge/push to `main`.

The Vercel project lives under the **NCYLC Vercel account** (not a personal account). The site needs no environment variables to run — the API keys live in GitHub (see below), not Vercel.

## How data stays up to date

All site data is committed to this repo:

- `data/bills/<billId>.json` — one file per bill: details, AI summary/arguments/topic, sponsors (in LegiScan's official order), and every roll call with each member's vote.
- `data/legislators.json` — every legislator on file, including their photo path.
- `public/elections/2026-general/<raceId>.json` and `public/maps/precincts/<raceId>.geojson` — precinct-by-precinct votes (by voting method) and precinct shapes for each NC House/Senate race, used by the race pages (`/results/<raceId>`) and Find my precinct. The vote files are written by `scripts/update-election-results.ts`; the shapes are built once by `scripts/build-precinct-maps.ts` from the State Board's precinct shapefile.
- `data/elections/2026-general-turnout.json` — registered voters per NC House/Senate district, the same district in 2024, and statewide turnout for 2022–2026, built once by `scripts/build-turnout.ts` from the State Board's voter_stats and results files. Turnout = votes cast in a race / registered voters.
- `data/elections/2026-general.json` — State Board of Elections results for the 2026 general election (the constitutional amendments and all 170 legislative races). Powers the ballot results page and the re-elected / lost / leaving badges on legislator profiles.
- `lib/legislator-emails.json` — official @ncleg.gov emails (refresh with `npx tsx scripts/backfill-emails.ts --write`).

The GitHub Action `.github/workflows/update-data.yml` runs daily at 11:00 UTC (and can be run by hand from the Actions tab). It runs `scripts/update-data.ts`, which:

1. Asks LegiScan which bills are new or changed (comparing each file's `changeHash`) and rewrites only those files, keeping their existing AI analysis.
2. Writes AI analysis (`claude-haiku-4-5`) for up to 10 of the newest bills that still lack it.
3. Refreshes the 2026 election results from the State Board (`scripts/update-election-results.ts`) until they're certified. Once the State Board certifies, run `npx tsx scripts/update-election-results.ts --certified` once and commit; after that it stops updating.
4. Commits any changed files. That push makes Vercel redeploy the site with the new data.

It needs two repository secrets: `LEGISCAN_API_KEY` and `ANTHROPIC_API_KEY` (Settings → Secrets and variables → Actions). If Vercel ever stops deploying the bot's commits, add a Vercel Deploy Hook URL as `VERCEL_DEPLOY_HOOK` and the workflow will call it.

Run it locally with `npx tsx scripts/update-data.ts` (add `--no-summarize` to skip the AI step, or `--refresh <billId,...>` to force specific bills to re-download).

At build time (and before `npm run dev`), `scripts/build-data-index.ts` turns `data/` into compact lookup files in `.data-index/` (git-ignored) that the per-request pages read. Most pages — home, about, map, every bill page — are fully pre-built at deploy time.

## Project structure

```
app/            Next.js App Router pages + API routes (bills, legislators, map, ballot, compare)
components/     Shared UI (BillCard, FeaturedBillCard, DistrictMap, etc.)
data/           The dataset: one JSON file per bill + legislators.json
lib/            Data access (lib/bills.ts, lib/legislators.ts, lib/data/), LegiScan client, AI summarization, PDF text extraction
scripts/        update-data.ts and update-election-results.ts (daily), build-data-index.ts, backfill-emails.ts, backfill-photos.ts
```

Notable details for future changes:

- **Legislator counts**: `data/legislators.json` can hold more people than actual seats (mid-session replacements leave both the departed and incoming member on file). The roster, homepage count, and district map all resolve the *current* member per district with `currentMembers` in `lib/legislators.ts`.
- **PDF parsing on Vercel**: `lib/billtext.ts` imports `lib/pdf-polyfill.ts` before `pdf-parse`, because `pdf-parse` (via pdf.js) expects a browser `DOMMatrix` global that Vercel's serverless Node runtime doesn't provide. Don't remove that import — the AI-analysis step of the daily update will crash at load without it.
- **What renders per request**: only `/bills`, `/legislators`, `/legislators/[id]`, `/compare`, and two small search APIs (they read `searchParams`). They read `.data-index/` from memory; `next.config.mjs` ships that folder with the server functions.
- **Name matching**: LegiScan, ncleg.gov, and the State Board ballot spell names differently ("Patricia Cotham" / "Tricia Ann Cotham", "Zack Forde-Hawkins" / "Zack Hawkins"). `lib/names.ts` holds the shared loose matching used for both emails and election results.
- **New members**: when new legislators join (e.g. January 2027), re-run `npx tsx scripts/backfill-emails.ts --write` and `npx tsx scripts/backfill-photos.ts` so they get an email and photo. The roster prefers members ncleg.gov currently lists when two people are on file for one seat.
- **History**: the site ran on Neon Postgres until October 2026, when the data moved into `data/`.

## License / ownership

Maintained by NC Youth Legislative Council. Code lives at `github.com/ncyouthlegislativecouncil/ncpolisearch`; hosting is on the NCYLC Vercel account so the project can be handed off between student maintainers without depending on any one person's accounts.
