# jobscout24-cli

CLI for searching jobs on jobscout24.ch — a general-purpose Swiss job board
(all industries, published in German/French/English), accessed via its `/en/`
locale.

**Data source**: jobscout24.ch's own server-rendered `/en/jobs/` listing HTML
(search) plus the schema.org `JobPosting` JSON-LD embedded on every detail page
(detail) — no separate API calls needed for the latter.
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

## Installation

```bash
cd .agents/skills/jobscout24-search/cli
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

# Backend developer roles in Zurich
bun run src/cli.ts search -q "backend developer" -l Zurich --format table

# Full detail for one job
bun run src/cli.ts detail e1cc5e14-e51d-43db-8816-3dc039a268fb --format plain
```

See `../SKILL.md` for the full flag reference.

## Search flags

| Flag | Alias | Description |
|------|-------|--------------|
| `--query` | `-q` | Keyword search via jobscout24's own `SearchWhat` param. |
| `--location` | `-l` | City/region, e.g. `Zurich`. Maps to the `/en/jobs-in-{city-slug}/` path — the `SearchWhere` query param verified to have no effect. |
| `--jobage` | | **Approximate, client-side only** — jobscout24 has no exact date filter, only a coarse relative label ("New"/"N d"/"N w"/"N+m") per listing. |
| `--page` | | 1-indexed. Real server-side pagination via jobscout24's own `p` param. |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |

## Portal quirks (see `../url-reference.md` for details)

- The visible search form posts to `/en/jobs/search/` and looks like it might
  need its `__RequestVerificationToken` — it doesn't; a plain `GET
  /en/jobs/?SearchWhat=<query>` works with no token or session.
- Location filtering is a path segment (`/en/jobs-in-{city}/`), not a query
  param — `SearchWhere=` in the query string is silently ignored.
- Job ids are opaque UUIDs from the `/en/job/{uuid}/` path, not slug pairs.
- `detail.applyUrl` is always `null` — the real apply button redirects
  through a session-scoped, non-fetchable tracked link.
- No salary field is modeled — Swiss postings rarely disclose salary
  publicly, and none was observed in the JSON-LD during investigation.
