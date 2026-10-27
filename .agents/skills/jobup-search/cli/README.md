# jobup-cli

CLI for searching jobs on jobup.ch — a major Swiss job board (JobCloud group,
same publisher as jobs.ch but a distinct site/listing set).

**Data source**: jobup.ch's own embedded schema.org `JobPosting` JSON-LD — a
full `ItemList` of postings on the `/en/jobs/` search page (search), plus a
richer per-posting `JobPosting` block on `/en/jobs/detail/{id}/` (detail).
Location and workload on `search` are supplemented from the rendered HTML card
where the JSON-LD's address is incomplete.
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

## Installation

```bash
cd .agents/skills/jobup-search/cli
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
# Golang roles anywhere in Switzerland
bun run src/cli.ts search -q "golang" --format table

# Backend roles in Zurich, posted in the last week
bun run src/cli.ts search -q "backend developer" -l Zurich --jobage 7 --format table

# Full detail for one job
bun run src/cli.ts detail 62b49136-23a4-4118-881c-59f91b7f01a4 --format plain
```

See `../SKILL.md` for the full flag reference.

## Search flags

| Flag | Alias | Description |
|------|-------|--------------|
| `--query` | `-q` | jobup.ch's own "term" search — semantic, not strict keyword matching. |
| `--location` | `-l` | City/region filter — real server-side `location` param. |
| `--jobage` | | Posted within N days — real server-side `publication-date` param (any positive integer). |
| `--page` | | 1-indexed. Real server-side pagination (~22/page) — no client-side slicing needed. |
| `--limit` | `-n` | Cap results emitted (client-side). |
| `--format` | | `json` \| `table` \| `plain`. |

## Portal quirks (see `../url-reference.md` for details)

- The listing page's JSON-LD is the primary parse source, not HTML-card
  scraping — verified live 2026-07-22 to carry a full `JobPosting` per card,
  contrary to the initial assumption for this skill.
- `--query` is jobup.ch's own semantic search — a nonsense term still returns
  some results (verified) rather than a clean zero; jobup shows its own
  "did you mean" infobox in that case. Pass a real, distinctive keyword.
- `salary` is always `null` on `search` (never shown on the listing) and only
  occasionally populated on `detail` (`salaryMin`/`salaryMax`/`salaryCurrency`
  — most postings' `baseSalary.value` is an empty object).
- `detail.applyUrl` is always `null` — no apply link exists in the rendered
  HTML at all (client-JS only), and robots.txt disallows `/en/application/*`.
