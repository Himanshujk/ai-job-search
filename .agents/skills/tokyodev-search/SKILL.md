---
name: tokyodev-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for tech jobs in Japan, or
  look up a specific job posting on tokyodev.com — TokyoDev is an English-language
  job board for software engineering and product roles at companies in Japan
  (mostly Tokyo, some fully remote). Invoke for phrases like: TokyoDev, jobs in
  Japan, jobs in Tokyo, Go developer Japan, backend engineer Tokyo, tech jobs
  Japan, remote jobs Japan, no-Japanese-required jobs, apply from abroad Japan,
  Japan visa sponsorship jobs, hiring in Tokyo.
context: fork
allowed-tools: Bash(bun run skills/tokyodev-search/cli/src/cli.ts *)
---

# TokyoDev Search Skill

Search live job listings from tokyodev.com — an English-language tech job board
focused on Japan (mostly Tokyo, plus companies offering fully remote or
apply-from-abroad roles). No authentication, no API key, and **zero runtime
dependencies** — it runs with just `bun`.

> This is a worked example of the repo's job-portal-skill pattern for a site
> that mixes both parsing techniques: search results are plain server-rendered
> HTML (grouped by company, so the CLI parses two levels of chunks — company
> then job), while job detail pages embed a schema.org `JobPosting` as JSON-LD
> that the CLI parses directly instead of scraping the rendered page.

## When to use this skill

- Search for tech jobs at companies in Japan by keyword (title, skill, stack —
  it's genuine full-text search over the description, not just tag matching)
- Filter by remote-work policy, or by how much Japanese the role requires
- Get the full description, salary range, and location of a specific posting

## Commands

### Search job listings

```bash
bun run skills/tokyodev-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search. This is real full-text search
  over title, tags, *and* the job description body (verified: a stack keyword
  like "kubernetes" that appears nowhere in a posting's title still matches).
  **Multi-word queries are OR'd, not AND'd** — verified: `-q "golang xyzzyunlikely"`
  (a nonsense second word) returns the exact same count as `-q "golang"` alone,
  and `-q "golang manager"` returns roughly `manager`-alone's count, not a small
  intersection. For a precise search, pass **one distinctive keyword** and use
  `--remote`/`--japanese` for additional narrowing rather than stacking more
  keywords into `--query`.
- `--jobage <days>` — **not supported.** TokyoDev's search results carry no
  posting date at all (only the detail page does, via schema.org `datePosted`).
  The flag is accepted for interface compatibility but has no effect.
- `--remote <mode>` — `remote`, `hybrid`, or `onsite` (maps to TokyoDev's
  fully/partially/no-remote filter).
- `--japanese <level>` — `none`, `basic`, `conversational`, `business`, or
  `fluent` — filters by the Japanese-language requirement. Useful since many
  users of this skill are looking specifically for `none` (no Japanese
  required) roles.
- `--page <n>` — 1-indexed page. **TokyoDev has no server-side pagination** —
  a single `/jobs` request returns every matching posting. This CLI paginates
  client-side, 20 results per page (see Notes).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side), applied
  after the page slice.
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run skills/tokyodev-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is `<company-slug>/<job-slug>` (e.g. `moneyforward/backend-engineer-golang`),
as returned by `search`. You may also pass a full tokyodev
`/companies/.../jobs/...` URL. Returns the full description, salary range,
employment type, location, and posting date.

## Usage examples

```bash
# Golang backend roles, any Japanese level, table view
bun run skills/tokyodev-search/cli/src/cli.ts search -q "golang backend developer" --format table

# Backend engineer roles that don't require Japanese, fully remote
bun run skills/tokyodev-search/cli/src/cli.ts search -q "backend engineer" --japanese none --remote remote --format table

# Site reliability engineer roles, second page of results
bun run skills/tokyodev-search/cli/src/cli.ts search -q "site reliability engineer" --page 2 --format table

# Full details for a specific job
bun run skills/tokyodev-search/cli/src/cli.ts detail moneyforward/backend-engineer-golang --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- **No posting dates on search results.** TokyoDev's listing page shows no date
  at all — `date` is always `null` on `search` results. The detail page does
  have a real `datePosted` (from its JSON-LD), so `detail` returns it.
- **No location on search results either** — TokyoDev doesn't show a city on
  the listing cards (everything is implicitly "Japan"). `detail` returns a
  real city/region/country from the posting's structured data (e.g.
  `"Minato-ku, Tokyo, JP"`).
- **No server-side pagination.** `GET /jobs?page=2` returns byte-identical
  content to `?page=1` — TokyoDev renders every matching job on one page
  (verified 2026-07-22, up to 154 postings unfiltered). This CLI slices the
  full result set into pages of 20 client-side so `--page` still does
  something useful.
- **Full-text search, not just category matching.** `--query` searches the
  job description body, not only titles/tags — verified with a stack keyword
  ("kubernetes") that matched postings where it only appeared in the body.
- **Salary** comes as a formatted string on search results (e.g. `"¥7M ~
  ¥12M"`, TokyoDev's own tag text) and as raw numeric `salaryMin`/`salaryMax`/
  `salaryCurrency` (JPY) on `detail`, from the posting's structured data.
- **No exposed "apply" URL.** The real external application link only appears
  after following `/c/<company>/j/<job>/applications/new`, and `/c/` is
  disallowed by robots.txt — so `detail.applyUrl` is always `null`; use the
  canonical job page URL and apply from there.
- robots.txt (checked 2026-07-22): `Allow: /` for all bots, only disallowing
  `/c/`, `/frames/`, `/ja/frames/` (and blocking `Amazonbot` entirely) — none
  of which this CLI touches. No login/authentication required for search or
  detail pages, and no terms-of-service page was found restricting automated
  access, so no personal-use warning is included here (keeping volume
  reasonable is still good practice for any scraping tool).
