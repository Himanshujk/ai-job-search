---
name: jobup-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs in Switzerland, or
  look up a specific job posting on jobup.ch — a major Swiss job board covering
  all industries and roles (not tech-specific). Invoke for phrases like: Jobs
  Schweiz, Stellenangebote, offres d'emploi Suisse, jobup.ch, jobs in
  Switzerland, Go developer Zurich, Go developer Geneva, backend engineer
  Basel, tech jobs Switzerland, visa Switzerland tech jobs, relocate to
  Switzerland, Swiss work permit jobs, emplois en Suisse romande, Arbeit in
  der Schweiz.
context: fork
allowed-tools: Bash(bun run skills/jobup-search/cli/src/cli.ts *)
---

# jobup.ch Search Skill

Search live job listings from jobup.ch — a major, general-purpose Swiss job
board (JobCloud group; same publisher as jobs.ch but a distinct site with its
own listing set and markup). No authentication, no API key, and **zero
runtime dependencies** — it runs with just `bun`.

> **Correction to the initial research assumption (2026-07-22):** it was
> assumed jobup.ch's search page carried only a breadcrumb JSON-LD block, no
> per-job structured data — verified false. The `/en/jobs/` listing page
> embeds a full schema.org `ItemList` of `JobPosting` objects, one per card,
> which this CLI parses directly as JSON rather than scraping Tailwind-soup
> HTML. The one real gap: the listing JSON-LD's `jobLocation.address`
> sometimes omits the city even when the rendered card clearly shows one — so
> `location` is backfilled from the HTML card's "Place of work" text when the
> JSON-LD lacks it. See `url-reference.md` for the full breakdown.

## When to use this skill

- Search for jobs anywhere in Switzerland by keyword (jobup.ch is a
  general-purpose board — all industries, not just tech)
- Filter by city/region, or by how recently a job was posted
- Get the full description, employment type, work hours, and (when disclosed)
  salary range of a specific posting

## Commands

### Search job listings

```bash
bun run skills/jobup-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search, mapped to jobup.ch's own
  `term` parameter. This is jobup's own **semantic search** — verified: even a
  nonsense string like `zzzqqqxxxnonexistentgibberish999888` still returns a
  handful of results (jobup shows its own "did you mean" infobox in that
  case) rather than a clean zero. Pass one real, distinctive keyword for
  precision.
- `--location <place>` / `-l <place>` — city/region filter, e.g. `Zurich`,
  `Geneva`, `Basel`. Verified as a genuine server-side param (`location=`) —
  narrows both the result count and the page `<title>`.
- `--jobage <days>` — posted within N days. Verified as a genuine server-side
  param (`publication-date=`) accepting **any positive integer**, not a fixed
  bucket (tested 1/2/3/5/7/10/14/21/30/60/90 — count scales smoothly).
- `--page <n>` — 1-indexed page. jobup.ch has **real server-side pagination**
  (~22 results/page) — this maps directly to its own `page` param, unlike
  some other portals in this repo that fake it client-side. An out-of-range
  page (e.g. `--page 999`) silently falls back to page 1's content rather
  than erroring or going empty.
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side), applied
  after the page fetch.
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run skills/jobup-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is jobup's own job UUID (e.g. `62b49136-23a4-4118-881c-59f91b7f01a4`), as
returned by `search`. You may also pass a full
`jobup.ch/en/jobs/detail/{uuid}/` URL. Returns the full description,
employment type, work hours, and (when disclosed) salary range.

## Usage examples

```bash
# Golang roles anywhere in Switzerland, table view
bun run skills/jobup-search/cli/src/cli.ts search -q "golang" --format table

# Backend roles in Zurich, posted in the last week
bun run skills/jobup-search/cli/src/cli.ts search -q "backend developer" -l Zurich --jobage 7 --format table

# Second page of results
bun run skills/jobup-search/cli/src/cli.ts search -q "software engineer" --page 2 --format table

# Full details for a specific job
bun run skills/jobup-search/cli/src/cli.ts detail 62b49136-23a4-4118-881c-59f91b7f01a4 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- **General-purpose board, not tech-specific.** jobup.ch covers all
  industries — searching `golang` or `software engineer` still works well
  since jobup's search is semantic/full-text, but expect a much broader mix
  than a curated tech board like tokyodev or japan-dev.
- **Primary parse source is JSON-LD, not HTML scraping.** The listing page's
  `ItemList` of `JobPosting` objects gives `title`, `id`, `company`,
  `employmentType`, and an exact ISO `datePosted` directly from valid JSON.
  Only `location` and `workload` are supplemented from the rendered HTML card
  (see `url-reference.md`).
- **Salary is almost never disclosed.** `salary` is always `null` on
  `search` (jobup never shows it on the listing). On `detail`,
  `salaryMin`/`salaryMax`/`salaryCurrency` are populated only when the
  posting's `baseSalary.value` actually has numeric bounds — most postings
  carry an empty `baseSalary.value` object.
- **No exposed "apply" URL.** No apply link appears anywhere in the rendered
  HTML (it's client-JS only), and robots.txt disallows `/en/application/*`
  (the application-flow pages) — so `detail.applyUrl` is always `null`; use
  the canonical job page URL and apply from there.
- **Multilingual site, English locale used throughout.** jobup.ch also has
  `/de/` and `/fr/` locales with the same job data — this CLI always uses
  `/en/` for simplest, consistent parsing (matching this repo's convention).
  Job titles/descriptions are often still in French or German even under
  `/en/` (the underlying posting's own language), which is expected — jobup
  translates its own UI chrome, not employer-authored content.
- robots.txt (checked 2026-07-22): disallows `/api/`, `/api_proxy/`,
  `/external/`, `/en|de|fr/application/*`, `/en|de|fr/login|auth|register/`,
  `/masks/`, `/javascript/`, and some enterprise/company-group pages — none of
  which this CLI touches. `/en/jobs/` and `/en/jobs/detail/...` are both
  Allowed. No Cloudflare bot-management challenge encountered (unlike
  tokyodev.com) — plain `fetch()` with a browser User-Agent works, no `curl`
  subprocess workaround needed. No login/authentication required for search
  or detail pages.
