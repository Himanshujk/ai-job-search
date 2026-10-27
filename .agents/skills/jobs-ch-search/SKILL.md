---
name: jobs-ch-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs in Switzerland, or
  look up a specific job posting on jobs.ch — Switzerland's leading job board,
  covering all sectors and all four national languages. Invoke for phrases
  like: jobs.ch, Jobs Schweiz, Jobs Suisse, Stellenangebote, Stellenangebote
  Schweiz, offres d'emploi Suisse, offres d'emploi, tech jobs Switzerland, Go
  developer Zurich, backend engineer Geneva, software engineer Basel, jobs in
  Switzerland, visa Switzerland tech jobs, work permit Switzerland, relocate to
  Switzerland, Swiss job board, Arbeit in der Schweiz.
context: fork
allowed-tools: Bash(bun run skills/jobs-ch-search/cli/src/cli.ts *)
---

# jobs.ch Search Skill

Search live job listings from jobs.ch — Switzerland's leading job board,
covering all sectors and regions (German-, French-, and Italian-speaking
Switzerland, plus English-language postings). No authentication, no API key,
and **zero runtime dependencies** — it runs with just `bun`.

> This is a worked example of the repo's job-portal-skill pattern for a site
> where the search-results page is plain server-rendered HTML with no
> per-job structured data (only a `BreadcrumbList` JSON-LD block), while the
> job **detail** page embeds a real schema.org `JobPosting` JSON-LD that the
> CLI parses directly instead of scraping the rendered page — closest analog
> to tokyodev-search's split approach.

## When to use this skill

- Search for jobs at companies in Switzerland by keyword, across any sector
- Filter by city/region
- Get the full description, salary (when published), employment type, and
  apply link for a specific posting

## Commands

### Search job listings

```bash
bun run skills/jobs-ch-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — search terms. **jobs.ch runs semantic/AI
  search, not literal keyword matching** — verified live 2026-07-22: an
  adversarial nonsense query (`asdkjaslkdjqwoiuxzcv12345`) still returned 125
  results with titles like "Assistentin der Geschäftsleitung" and "Pharma-
  Assistent/in" — no textual connection to the query at all. For a realistic
  query (`golang`), most of the 257 matching titles didn't contain the literal
  word "golang" either (e.g. "Cobol Developer", "Senior Full Stack Developer
  (Ruby on Rails/Vue.js)"). Treat `--query` as steering a relevance ranking,
  not a strict filter — don't expect zero results just because a term is
  unusual, and don't be surprised by loosely-related matches.
- `--location <place>` / `-l <place>` — free-text city filter (e.g. `zurich`,
  `zürich`, `geneva`). Maps to jobs.ch's own `location=` query param (verified:
  narrows 257→73 results for `zurich` on top of a `golang` query).
- `--jobage <days>` — posted within N days. **No server-side param found** —
  several plausible param names (`publishedSince`, `postedSince`, `days`,
  `age`, `publication_date`, etc.) were tried live and none changed the result
  count. Implemented client-side instead, parsing the listing's relative
  "posted" text (`"3 weeks ago"`, `"Last week"`, `"Yesterday"`, `"5 hours
  ago"`, etc.) and filtering to the requested window — applied only to
  whichever page was actually fetched (not across the whole result set).
- `--page <n>` — 1-indexed page. **Real server-side pagination** — verified
  `page=2` returns a genuinely different set of postings than `page=1` (unlike
  some portals in this repo where `page` is silently ignored).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side), applied
  after the jobage filter.
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run skills/jobs-ch-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the job's UUID (e.g. `4d1e118f-25b2-4bde-9e0d-a29f5546d1fe`), as
returned by `search`. A full jobs.ch `/vacancies/detail/<uuid>/` URL (any
locale — `/en/`, `/de/`, `/fr/`) also works. Returns the full description,
employment type, work hours, industry, salary (when published), and a
same-site apply link.

## Usage examples

```bash
# Golang roles, table view
bun run skills/jobs-ch-search/cli/src/cli.ts search -q "golang developer" --format table

# Backend roles in Zurich
bun run skills/jobs-ch-search/cli/src/cli.ts search -q "backend engineer" -l zurich --format table

# Roles posted in the last week
bun run skills/jobs-ch-search/cli/src/cli.ts search -q "software engineer" --jobage 7 --format table

# Second page of results
bun run skills/jobs-ch-search/cli/src/cli.ts search -q "software engineer" --page 2 --format table

# Full details for a specific job
bun run skills/jobs-ch-search/cli/src/cli.ts detail 4d1e118f-25b2-4bde-9e0d-a29f5546d1fe --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- **jobs.ch's `/en/` locale keeps parsing simplest** and is what this CLI
  standardizes on, but postings themselves are written in whatever language
  the employer used (German, French, Italian, or English) — `/en/` only
  affects site chrome and URL structure, not job-description language.
  `/de/` and `/fr/` equivalents exist (`/de/stellenangebote/`,
  `/fr/offres-emplois/`) but aren't used by this CLI.
- **Search results carry no structured per-job data** — the only JSON-LD on
  `/en/vacancies/` is a `BreadcrumbList` (confirmed: exactly one `ld+json`
  block, matching the brief's "not per-job JobPosting data" hypothesis).
  Job cards are parsed from the rendered HTML instead (chunked per
  `data-cy="serp-item"`, so one malformed card can't break the rest).
- **Detail pages DO have real `JobPosting` JSON-LD** — full description,
  `datePosted` (real ISO datetime, unlike the listing's relative string),
  `employmentType` (already human-readable on jobs.ch, e.g. "Permanent
  position" — not a schema.org enum needing prettification), `workHours`,
  `industry`, `jobLocation.address`, and a same-site `potentialAction.target
  .urlTemplate` apply link.
- **Salary is rarely published.** `baseSalary` is present in every detail
  page's JSON-LD but its `value` sub-object is usually empty (verified across
  4 real postings, spanning different companies/roles) — `salaryMin`/
  `salaryMax`/`salaryCurrency` are `null` in that case, not a fabricated 0.
- **`jobLocation.address.addressRegion` actually holds the city name**, not a
  canton/state, in jobs.ch's own data (e.g. `"Dietikon"`, `"Zug"`, `"Bern"`) —
  a real quirk in how jobs.ch populates that schema.org field, not a parsing
  bug in this CLI.
- robots.txt (checked 2026-07-22): disallows `/api/`, `/*/login/`,
  `/*/register/`, `/*/auth/`, `/*/application/*`, and a
  `/en/vacancies/detail/*/*/*`-shaped line — **verified this last one does
  NOT match the real detail URL**. The real URL
  (`/en/vacancies/detail/<uuid>/`) has exactly one trailing slash after the
  uuid; the disallow pattern compiles to `^/en/vacancies/detail/.*/.*/.*`,
  which needs two literal `/` separators beyond the `detail/` prefix — the
  real URL's single slash can't satisfy that. Confirmed independently (not
  just trusted from the initial hypothesis) by counting slashes in both the
  pattern and a real fetched URL. `/en/vacancies/` and
  `/en/vacancies/detail/<uuid>/` are both effectively Allowed. No
  Claude-specific disallow entries found. No login/authentication required for
  either page.
