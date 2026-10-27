# jobs-ch-cli

CLI for searching jobs on jobs.ch — Switzerland's leading job board (German,
French, Italian, and English postings; this CLI standardizes on the `/en/`
locale for consistent parsing).

**Data source**: jobs.ch's own server-rendered `/en/vacancies/` listing HTML
(search) plus the schema.org `JobPosting` JSON-LD embedded on every detail page
(detail) — no separate API calls needed for the latter.
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

## Installation

```bash
cd .agents/skills/jobs-ch-search/cli
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
# Golang developer roles
bun run src/cli.ts search -q "golang developer" --format table

# Backend roles in Zurich
bun run src/cli.ts search -q "backend engineer" -l zurich --format table

# Full detail for one job
bun run src/cli.ts detail 4d1e118f-25b2-4bde-9e0d-a29f5546d1fe --format plain
```

See `../SKILL.md` for the full flag reference.

## Search flags

| Flag | Alias | Description |
|------|-------|--------------|
| `--query` | `-q` | Semantic search (NOT literal keyword matching — see quirk below). |
| `--location` | `-l` | Free-text city filter, maps to jobs.ch's `location=` param. |
| `--jobage` | | Posted within N days. No server param found — filtered client-side against the listing's relative date text, applied to the fetched page only. |
| `--page` | | 1-indexed. Real server-side pagination. |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |

## Portal quirks (see `../url-reference.md` for details)

- **`--query` is semantic/AI search, not keyword matching.** Verified live: an
  adversarial nonsense query still returned 125 loosely-themed results with no
  textual overlap with the query string. Don't assume a zero-result count means
  "no matches for this literal term" — jobs.ch may return its nearest
  semantic neighbors instead.
- **No server-side "posted since" filter** — several plausible param names
  were tried live and none changed result counts. `--jobage` is implemented
  client-side against the listing's relative date string ("3 weeks ago",
  "Last week", etc.), applied only within the page fetched.
- **Swiss postings rarely publish salary data** — `baseSalary` is present in
  every detail page's JSON-LD but its `value` is usually an empty object
  (verified across 4 real postings); `salaryMin`/`salaryMax`/`salaryCurrency`
  are `null` in that case rather than a fabricated 0.
- `detail.applyUrl` comes directly from the JobPosting's own
  `potentialAction.target.urlTemplate` (a same-site `.../apply` URL) — this
  path is allowed by robots.txt (see quirk note in `url-reference.md`).
