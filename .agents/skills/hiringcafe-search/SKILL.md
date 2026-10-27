---
name: hiringcafe-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs in any location or
  market, find job listings, or look up a specific job posting on hiringcafe.com —
  in any country, city, or remotely. Invoke for open positions, vacancies, and
  hiring across any sector or role (software, data, design, marketing, finance,
  legal, operations, etc.). Trigger phrases: hiring cafe, hiringcafe, find a job,
  job search, search for jobs, job openings, vacancies, hiring, positions open,
  remote jobs, AI job search, "are there any X jobs in <place>", look up this job
  posting.
context: fork
allowed-tools: Bash(bun run skills/hiringcafe-search/cli/src/cli.ts *)
---

# HiringCafe Search Skill

Search live job listings from hiringcafe.com's AI-aggregated job board — hundreds
of thousands of postings pulled from company ATS platforms (Workday, Greenhouse,
Breezy, SmartRecruiters, etc.) across **any country/region** (and remote). No
authentication, no API key, and **zero runtime dependencies** — it runs with just
`bun`.

> This is a worked example of the repo's job-portal-skill pattern for a global
> aggregator: there's no dedicated JSON API, so the CLI parses the `__NEXT_DATA__`
> blob every hiringcafe.com page embeds — no HTML scraping needed.

## ⚠️ Personal use only

hiringcafe's `robots.txt` disallows the exact query pattern this skill depends on
(`/*?searchState=*`) for **all** bots — not a Claude-specific block, but a general
disallow that looks aimed at stopping search engines from indexing endless filter
combinations. Its Terms of Service don't otherwise mention scraping restrictions,
and the job-detail pages (`/job/...`) are explicitly Allowed. Still: **keep volume
low, don't use this commercially or for bulk data collection, and run it on your
own responsibility.**

## When to use this skill

- Search for job openings in a given location (any country/city) or remotely
- Filter by recency (posted today / last week / last month / etc.) or workplace
  type (remote/hybrid/onsite)
- Get the full description of a specific job listing

## Commands

### Search job listings

```bash
bun run skills/hiringcafe-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (title, skill, role). **Include a
  city or country name here too** — hiringcafe's location filter needs geocoded
  coordinates this zero-dependency CLI can't produce, so pass location as part of
  the query (e.g. `-q "golang developer bengaluru"`), same as `jobindex-search`.
- `--jobage <days>` — posted within N days. hiringcafe only accepts a fixed set of
  internal buckets (not literal day counts); the CLI maps your value to the
  nearest bucket at or above it. Omit for all-time.
- `--remote <mode>` — `remote`, `hybrid`, or `onsite` (workplace-type filter).
- `--page <n>` — page number (1-indexed).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run skills/hiringcafe-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the `requisition_id` from `search` results (e.g. `olea5aapgevu88cq`). You
may also pass a full hiringcafe `/job/...` URL. Returns the full description,
seniority, employment type, workplace type, and apply link.

## Usage examples

```bash
# Golang backend roles in Bengaluru, last month
bun run skills/hiringcafe-search/cli/src/cli.ts search -q "golang backend developer bengaluru" --jobage 30 --format table

# Fully remote backend engineer roles
bun run skills/hiringcafe-search/cli/src/cli.ts search -q "backend engineer" --remote remote --format table

# Product designer roles in Berlin
bun run skills/hiringcafe-search/cli/src/cli.ts search -q "product designer berlin" --format table

# Any role, fully remote, page 2
bun run skills/hiringcafe-search/cli/src/cli.ts search -q "paralegal" --remote remote --page 2 --format table

# Full details for a specific job
bun run skills/hiringcafe-search/cli/src/cli.ts detail olea5aapgevu88cq --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data comes from `hiringcafe.com`'s own server-rendered `__NEXT_DATA__` JSON — no
  credentials required, no separate API to reverse-engineer.
- Page size is ~40 results per page (site default); `--limit` caps client-side.
- `--jobage` values are quantized to hiringcafe's internal buckets — see
  `url-reference.md` for the full table. Any unmapped value is silently ignored
  by the server (not an error), so the CLI always resolves your input to a valid
  bucket (or -1 for "all-time").
- Job ids (`requisition_id`) are opaque alphanumeric tokens (e.g. `olea5aapgevu88cq`)
  — pass them as-is to `detail`. Detail lookups redirect (308) to the canonical
  URL by id alone, regardless of the slug text preceding it.
