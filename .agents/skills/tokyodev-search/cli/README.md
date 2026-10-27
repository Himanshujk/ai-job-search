# tokyodev-cli

CLI for searching jobs on tokyodev.com — an English-language tech job board
focused on Japan (mostly Tokyo, plus fully remote and apply-from-abroad roles).

**Data source**: tokyodev.com's own server-rendered `/jobs` listing HTML (search)
plus the schema.org `JobPosting` JSON-LD embedded on every detail page (detail) —
no separate API calls needed for the latter.
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

## Installation

```bash
cd .agents/skills/tokyodev-search/cli
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
# Golang backend roles
bun run src/cli.ts search -q "golang backend developer" --format table

# Fully remote backend roles, no Japanese required
bun run src/cli.ts search -q "backend engineer" --remote remote --japanese none --format table

# Full detail for one job
bun run src/cli.ts detail moneyforward/backend-engineer-golang --format plain
```

See `../SKILL.md` for the full flag reference.

## Search flags

| Flag | Alias | Description |
|------|-------|--------------|
| `--query` | `-q` | Full-text search (title, tags, and description body). |
| `--jobage` | | **Not supported** — search results carry no date at all. Accepted, ignored. |
| `--remote` | | `remote` \| `hybrid` \| `onsite`. |
| `--japanese` | | `none` \| `basic` \| `conversational` \| `business` \| `fluent`. |
| `--page` | | 1-indexed. Client-side pagination (20/page) — TokyoDev has no server-side pagination. |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |

## Portal quirks (see `../url-reference.md` for details)

- No location or posting date on search results — both are `null` there;
  `detail` recovers real values (city/region and `datePosted`) from the
  detail page's structured data.
- No server-side pagination — `?page=2` returns the same content as `?page=1`.
  The CLI paginates client-side over the full parsed result set.
- `--query` is genuine full-text search over the job description, not just
  category/tag matching — but multi-word values are OR'd, not AND'd. Pass one
  distinctive keyword for precision.
- `detail.applyUrl` is always `null` — the real external apply link lives under
  `/c/...`, which robots.txt disallows crawling.
