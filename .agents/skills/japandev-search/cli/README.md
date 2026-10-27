# japandev-cli

CLI for searching jobs on japan-dev.com — a curated board of hand-picked,
**English-friendly tech jobs in Japan**, with per-listing visa-sponsorship, remote-work,
and salary data.

**Data source**: japan-dev.com's own live page data — every page (the `/jobs` listing
and each job's detail page) embeds its data server-side in a Nuxt `__NUXT_DATA__`
payload, which this CLI parses directly. (An earlier version of this CLI called the
site's public Algolia key directly instead — that endpoint turned out to be frozen at
Sep 2024 while the real site is current; see `../url-reference.md` for the full story
and don't repeat that mistake.) The full description comes from each detail page's
schema.org `JobPosting` JSON-LD.
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

## Installation

```bash
cd .agents/skills/japandev-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|--------------|
| `search` | Search for job listings |
| `detail` | Fetch full detail for a single job listing |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Golang roles currently posted, anywhere in Japan
bun run src/cli.ts search -q "golang" --format table

# Roles that sponsor visas from overseas, fully remote
bun run src/cli.ts search -q "engineer" --visa yes --remote remote --format table

# Roles that are EITHER fully remote OR visa-sponsored (not both required)
bun run src/cli.ts search -q "engineer" --visa yes --remote remote --remote-or-visa --format table

# Full detail for one job
bun run src/cli.ts detail zeals/zeals-site-reliability-engineer-uri285 --format plain
```

See `../SKILL.md` for the full flag reference.

## Search flags

| Flag | Alias | Description |
|------|-------|--------------|
| `--query` | `-q` | Keywords (title / skill / company). Every word must match (AND) — use one distinctive word. |
| `--location` | `-l` | Office location, exact case-insensitive match: `Tokyo`, `Osaka`, `Fukuoka`, `Remote`. |
| `--jobage` | | Posted within N days — filtered client-side against `published_at`. |
| `--remote` | | `remote` \| `hybrid` \| `onsite`. |
| `--visa` | | `yes` \| `no` — visa sponsorship from overseas. |
| `--remote-or-visa` | | OR `--remote` and `--visa` instead of AND-ing them (e.g. "remote OR visa-sponsored"). Requires both to be set. |
| `--page` | | 1-indexed page (20 per page). |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |

## Portal quirks (see `../url-reference.md` for full details)

- **Coverage is limited to ~60 currently-posted jobs**, not a full historical archive —
  the site's `/jobs` page always renders the same fixed "latest" set regardless of any
  query string; there's no server-reachable way to search or paginate beyond it. `search`
  fetches that set once and filters it client-side (`--query`, `--location`, `--remote`,
  `--visa`, `--jobage` are all applied here, not sent to the server).
- `--query` is AND-only across title/skills/company — a long phrase narrows fast on a
  ~60-job set; prefer one distinctive word.
- `detail <id>` sometimes recovers a richer `employmentType` from the job's JobPosting
  JSON-LD than from its own live payload — japan-dev.com's detail pages often omit
  `contract_type`/`english_level`/`japanese_level`/`skill_names` even when the listing
  page's copy of the same job has them. Those last three come back `null` on `detail`
  when that happens; there's no workaround short of the listing page happening to still
  have the job.
- Full description lives only in the JobPosting JSON-LD on the job's own page — never
  in the live payload's `details`/`requirements`/`benefits` fields (always null there).
