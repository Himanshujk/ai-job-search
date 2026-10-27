---
name: japandev-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for tech jobs in Japan, find
  English-friendly job listings, check visa sponsorship for a role in Japan, or look up
  a specific job posting on japan-dev.com. Invoke for phrases like "Japan dev jobs",
  "jobs in Tokyo", "Go developer Japan", "visa sponsorship Japan", "remote jobs in
  Japan", "English-speaking tech jobs Japan", "backend engineer Tokyo", relocate to
  Japan, or "are there any X jobs in Japan/Tokyo". Covers software/tech roles only —
  japan-dev.com is a curated board for developers and tech folks, not a general job
  board.
context: fork
allowed-tools: Bash(bun run skills/japandev-search/cli/src/cli.ts *)
---

# Japan Dev Search Skill

Search live job listings from japan-dev.com — a hand-picked board of English-friendly
tech jobs in Japan, with per-listing visa-sponsorship, remote-work, and salary data.
No authentication, no API key, and **zero runtime dependencies** — it runs with just
`bun`.

> **Coverage note (important — corrected 2026-07-22):** japan-dev.com embeds a public
> Algolia search-only key in every page, which looks like the obvious way to query it —
> but that direct endpoint returns a frozen snapshot stuck at Sep 2024, while the site's
> own `/jobs` page shows postings from today. This CLI instead parses the live data each
> page embeds server-side (Nuxt's `__NUXT_DATA__` payload), which is what real visitors
> see. The tradeoff: `/jobs` always renders the same "latest postings" set (~60 jobs)
> regardless of query string — no URL param changes what it returns, since true
> filtering only happens client-side after JS loads (via that same stale Algolia
> widget). So `search` fetches that fixed live set once per call and filters it
> **client-side** — this covers "what's currently posted," not a full historical
> archive. `robots.txt` is fully open for job paths — no personal-use restriction found.

## When to use this skill

- Search for tech job openings **currently posted** in Japan (Tokyo, Osaka, Fukuoka) or remote-from-Japan
- Filter by visa sponsorship, remote-work level, or recency, within that live set
- Get the full description, salary range, and requirements for a specific listing

## Commands

### Search job listings

```bash
bun run skills/japandev-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search against title, skills, and company.
  **Every word must match (AND)** — one distinctive word is safer than a long phrase,
  since the live set is only ~60 jobs (e.g. `-q golang` beats `-q "golang backend developer"`).
- `--location <place>` / `-l <place>` — office-location match: `Tokyo`, `Osaka`, `Fukuoka`, or `Remote`.
- `--jobage <days>` — posted within N days, filtered client-side against `published_at`.
- `--remote <mode>` — `remote`, `hybrid`, or `onsite` (maps onto japan-dev's `remote_level` field).
- `--visa <yes|no>` — filter by whether the employer sponsors visas from overseas.
- `--remote-or-visa` — match if EITHER `--remote` OR `--visa` matches, instead of requiring
  both (e.g. "remote OR visa-sponsored"). Requires both `--remote` and `--visa` to be given.
- `--page <n>` — page number (1-indexed, 20 results per page).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run skills/japandev-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is `<company-slug>/<job-slug>` from `search` results (e.g.
`zeals/zeals-site-reliability-engineer-uri285`) — self-sufficient, no separate lookup
needed. A full `japan-dev.com/jobs/...` URL also works.

## Usage examples

```bash
# Golang backend roles currently posted, anywhere in Japan
bun run skills/japandev-search/cli/src/cli.ts search -q "golang" --format table

# Roles that sponsor visas from overseas, fully remote
bun run skills/japandev-search/cli/src/cli.ts search -q "engineer" --visa yes --remote remote --format table

# Roles that are EITHER fully remote OR visa-sponsored (not both required)
bun run skills/japandev-search/cli/src/cli.ts search -q "engineer" --visa yes --remote remote --remote-or-visa --format table

# Site reliability roles in Tokyo
bun run skills/japandev-search/cli/src/cli.ts search -q "reliability" -l Tokyo --format table

# Full details for a specific job (id from a prior search)
bun run skills/japandev-search/cli/src/cli.ts detail zeals/zeals-site-reliability-engineer-uri285 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- japan-dev.com is a **curated, hand-picked board** — the live set this CLI can see is
  ~60 currently-posted jobs, not a full historical archive (see the coverage note above
  for why). It's software/tech-specific and English-first — "No Japanese Required" is
  one of its own headline filters.
- Data source: each page's own embedded `__NUXT_DATA__` payload (Nuxt's devalue flat-array
  format) for `search`, plus the detail page's schema.org `JobPosting` JSON-LD for the
  full description and employment type. `details`/`requirements`/`benefits` are always
  null in the live payload too — the description genuinely only lives in the JobPosting block.
- `--query` requires every word to match (title + skills + company), case-insensitive.
  This is a deliberate client-side implementation, not a portal feature — the more
  words you add, the narrower the match, since there's no true relevance ranking here.
- `--location` is an exact case-insensitive match against the job's office-location
  string; anything not present in the live set just returns 0 results.
- Detail lookups sometimes get a richer employment-type value from the JobPosting block
  than from the live payload alone (a japan-dev.com quirk — the detail page's own data
  omits `contract_type` more often than the listing page's copy of the same job); this
  CLI prefers JobPosting's `employmentType` for that reason.
- No login/authentication required for search or detail pages.
