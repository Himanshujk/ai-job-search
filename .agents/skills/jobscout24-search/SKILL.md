---
name: jobscout24-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs in Switzerland, or
  look up a specific job posting on jobscout24.ch — a general-purpose Swiss job
  board (all industries, not just tech). Invoke for phrases like "Jobs Schweiz",
  "Stellenangebote", "offres d'emploi Suisse", "jobs in Switzerland", "Go developer
  Zurich", "Zurich jobs", "Geneva jobs", "Basel jobs", "visa Switzerland tech
  jobs", "Swiss job board", "arbeiten in der Schweiz", "emploi Genève".
context: fork
allowed-tools: Bash(bun run skills/jobscout24-search/cli/src/cli.ts *)
---

# JobScout24 Search Skill

Search live job listings from jobscout24.ch — a general Swiss job board (all
industries, published in German/French/English) — via its `/en/` locale. No
authentication, no API key, and **zero runtime dependencies** — it runs with
just `bun`.

> **Search mechanism note (important — corrects an earlier `?term=` guess):**
> the on-page search `<form id="SearchForm">` posts to `/en/jobs/search/` and
> carries an `__RequestVerificationToken`, which looked like it might require a
> POST with an anti-forgery token. It doesn't, for reads — a plain
> `GET /en/jobs/?SearchWhat=<query>` (the *listing* path, not the form's
> POST-only `/en/jobs/search/` action) returns real, correct results with no
> token or session needed (verified: `?SearchWhat=golang` returns "Golang jobs
> - 4 vacancies", with genuine per-title matches). Location filtering is **not**
> a query param, though — `?SearchWhere=Zurich` has zero effect (verified
> byte-identical result set to the unfiltered query); the real location filter
> is a path segment, `/en/jobs-in-{city-slug}/`.

## When to use this skill

- Search for jobs in Switzerland by keyword (any industry — trades,
  healthcare, finance, IT, etc., not just tech)
- Filter by city/region
- Get the full description, employment type, and category of a specific
  posting

## Commands

### Search job listings

```bash
bun run skills/jobscout24-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search via jobscout24's own
  `SearchWhat` search field.
- `--location <place>` / `-l <place>` — city/region, e.g. `Zurich`, `Geneva`,
  `Basel`, `St. Gallen`. Maps to the `/en/jobs-in-{city-slug}/` path (verified
  working; the `SearchWhere` query param does **not** work).
- `--jobage <days>` — **approximate, client-side only.** jobscout24 exposes no
  exact date or day-count filter on search results at all — only a coarse
  relative label per listing ("New", "5 d", "2 w", "1+m"). This flag parses
  that label into an approximate day count and filters after the fact; treat
  it as "roughly within N days," not exact.
- `--page <n>` — 1-indexed. Maps to jobscout24's own `p` param (real
  server-side pagination, ~20 results/page — confirmed via the site's own
  "Next" link, e.g. `/en/jobs/?SearchWhat=developer&p=2`).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side, applied
  after paging and jobage filtering).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run skills/jobscout24-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the opaque UUID segment from a job's `/en/job/{id}/` URL, as returned
by `search`. A full jobscout24 job URL also works.

## Usage examples

```bash
# Golang roles anywhere in Switzerland, table view
bun run skills/jobscout24-search/cli/src/cli.ts search -q "golang" --format table

# Backend developer roles in Zurich specifically
bun run skills/jobscout24-search/cli/src/cli.ts search -q "backend developer" -l Zurich --format table

# Roles posted roughly within the last week
bun run skills/jobscout24-search/cli/src/cli.ts search -q "developer" --jobage 7 --format table

# Full details for a specific job
bun run skills/jobscout24-search/cli/src/cli.ts detail e1cc5e14-e51d-43db-8816-3dc039a268fb --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- **General job board, not tech-specific.** jobscout24.ch covers all
  industries — trades, healthcare, retail, finance, etc. — so keyword
  precision matters more here than on a curated tech board; a broad query like
  `-q "developer"` can return 900+ results.
- **Postings are often German or French even under `/en/`.** The `/en/`
  locale translates the site chrome, but individual job descriptions are
  published in whatever language the employer wrote them in (many are German,
  some are genuinely English if the employer wrote it that way — verified on
  both a German trades posting and an English tech posting fetched via the
  same `/en/job/{id}/` path). Don't assume `/en/` means an English job
  description.
- **`--jobage` is a coarse, client-side approximation.** There is no exact
  posting-date or day-count filter on this site's search at all — the listing
  only ever shows a bucketed relative label ("New", "N d", "N w", "N+m"). This
  CLI maps that to an approximate day count for filtering; a job labeled
  `"1+m"` is treated as ≥30 days old.
- **`--location` must be a path segment, not a query param.** `SearchWhere=`
  in the query string is silently ignored by the server (verified — returns
  byte-identical results to the unfiltered search). Use `/en/jobs-in-{city}/`
  instead, which this CLI builds automatically from `--location`.
- **"Further jobs from the web" entries are included.** Some result pages mix
  in externally-aggregated postings after a "Further jobs from the web"
  separator (flagged with a `webjob` CSS class internally) — their
  `/en/job/{id}/` detail pages work identically to native postings, so no
  special-casing was needed.
- **No exposed "apply" URL.** The real "Apply online" button redirects
  through a tracked, session-scoped `/en/job/{title-slug}/{numeric-id}/externalapply/`
  path to the actual employer/ATS site — this isn't a stable URL you can
  construct or fetch directly (verified: guessing the path returns 404
  without the exact session token the rendered page carries). `detail.applyUrl`
  is always `null`; use the canonical job page URL and apply from there.
- robots.txt (checked 2026-07-22): disallows `/app/`, `/aspnet_client/`,
  `/careers/`, `/companies/`, `/{de,en,fr}/{account,apply,cookies,customer}/`,
  `/exportfeed/`, `/JS24Web/` (+ lowercase variant), `/statistics/` — none of
  which this CLI touches (`/en/jobs/`, `/en/jobs-in-*/`, and `/en/job/{id}/`
  are all Allowed). No login/authentication required for search or detail
  pages, and no anti-forgery token or CSRF protection blocks the plain GET
  requests this CLI makes.
