# wearedevelopers-cli

CLI for searching developer jobs on **WeAreDevelopers.com**, a global tech job board
with especially strong European coverage.

**Data source**: WeAreDevelopers' own documented Markdown API (`/jobs.md`, `/jobs/{id}.md` — see https://www.wearedevelopers.com/agents.md). Not scraping.
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

> Be nice (the site's own policy): cache locally, don't bulk-mirror, keep request
> volume low.

## Installation

```bash
cd .agents/skills/wearedevelopers-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search for developer job listings (`--query` recommended, `--country` optional) |
| `detail` | Fetch full detail for a single job listing |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Golang backend roles, all countries, last 14 days
bun run src/cli.ts search -q "golang backend" --jobage 14 --format table

# Same search, Germany only
bun run src/cli.ts search -q "golang backend" --country DE --format table

# Full detail for one job
bun run src/cli.ts detail ext/2066501-senior-backend-engineer-golang --format plain
```

See `../SKILL.md` for the full flag reference and `../url-reference.md` for the API's
documented response shape.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Keywords (title / skill / role / company). Recommended. |
| `--country` | | `AT` \| `BE` \| `DE` \| `ES` \| `FR` \| `IT` \| `LT` \| `NL` \| `RS` \| `UK` \| `US` \| `VN` \| `all`. Default `all`. |
| `--jobage` | | Posted within N days — filtered client-side (no server-side param exists). |
| `--page` | | 1-indexed page (~24 results/page). |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |
