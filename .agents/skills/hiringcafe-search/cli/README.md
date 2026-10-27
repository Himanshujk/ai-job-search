# hiringcafe-cli

CLI for searching jobs on hiringcafe.com's AI-aggregated job listings, for **any
country/region** (and remote), across any sector.

**Data source**: hiringcafe.com's own Next.js pages — every page embeds its search/job
data in a `__NEXT_DATA__` JSON blob, so no HTML scraping or separate API calls are needed.
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

> **Personal use only.** hiringcafe's `robots.txt` disallows the `searchState` query
> pattern this CLI depends on, for all bots (not just AI crawlers) — likely to avoid
> search engines indexing endless filter permutations. Keep volume low, don't use this
> commercially or for bulk data collection, and run it on your own responsibility.

## Installation

```bash
cd .agents/skills/hiringcafe-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search for job listings |
| `detail` | Fetch full detail for a single job listing |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Golang roles in Bengaluru, last 30 days
bun run src/cli.ts search -q "golang developer bengaluru" --jobage 30 --format table

# Fully remote backend roles
bun run src/cli.ts search -q "backend engineer" --remote remote --format table

# Full detail for one job
bun run src/cli.ts detail x7k2m9wq --format plain
```

See `../SKILL.md` for the full flag reference and the personal-use note.

## Search flags

| Flag | Alias | Description |
|------|-------|--------------|
| `--query` | `-q` | Keywords (title / skill / role). Include a city/country name here too — there's no separate location param. |
| `--jobage` | | Posted within N days, mapped to hiringcafe's nearest internal bucket. |
| `--remote` | | `remote` \| `hybrid` \| `onsite`. |
| `--page` | | 1-indexed page. |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |

## Portal quirks (see `../url-reference.md` for details)

- No location filter param — hiringcafe's structured `locations` filter requires
  geocoded lat/lng that this zero-dependency CLI can't produce, so location goes
  in `--query` instead (same pattern as `jobindex-search`).
- `--jobage` is quantized: hiringcafe's `dateFetchedPastNDays` field only accepts a
  fixed enum of internal bucket values, not literal day counts — anything else is
  silently ignored server-side (the filter is dropped, not an error). The CLI maps
  your requested day count to the nearest valid bucket.
- `detail <id>` works by requisition_id alone: `/job/job-<id>` 308-redirects to the
  canonical slugged URL regardless of what text comes before the id.
