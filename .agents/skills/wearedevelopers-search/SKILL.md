---
name: wearedevelopers-search
version: 1.0.0
description: >
  Use this skill when the user wants to search for developer/tech jobs on
  WeAreDevelopers (wearedevelopers.com) — a global, English-language developer
  job board with especially strong European coverage (Austria, Belgium,
  Germany, Spain, France, Italy, Lithuania, Netherlands, Serbia, UK, US,
  Vietnam, or all countries). Trigger phrases: WeAreDevelopers, wearedevelopers.com,
  developer jobs Europe, tech jobs Germany/Spain/Austria/etc, search WeAreDevelopers,
  find jobs on WeAreDevelopers.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/wearedevelopers-search/cli/src/cli.ts *)
---

# WeAreDevelopers Search Skill

Search live job listings from WeAreDevelopers' own **official machine-readable Markdown
API** (documented at https://www.wearedevelopers.com/agents.md — every page on the site
supports a `.md` suffix or `Accept: text/markdown`). This is not scraping: it's a
publicly documented, agent-friendly response format. No authentication, no API key, and
**zero runtime dependencies** — it runs with just `bun`.

## Be nice (the site's own policy, from `/agents.md`)

- ✅ Use content for search, learning, recommendations
- ✅ Cache locally, summarize, cite with attribution
- ❌ Don't bulk-mirror or republish as your own
- 🐌 Rate limit: be reasonable, keep volume low (a handful of requests per run, not a crawl)

## When to use this skill

- Search developer/tech job openings by keyword, optionally filtered by country
- Filter by recency (posted within the last N days) — filtered client-side, see Notes
- Get the full description of a specific job listing

## Commands

### Search job listings

```bash
bun run .agents/skills/wearedevelopers-search/cli/src/cli.ts search --query "<text>" [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (title, skill, role, company). Recommended.
- `--country <code>` — one of `AT` `BE` `DE` `ES` `FR` `IT` `LT` `NL` `RS` `UK` `US` `VN` `all`. Default `all` (the site auto-detects by geo-IP when omitted, which is inconsistent across forks — this CLI always passes an explicit value).
- `--jobage <days>` — posted within N days, filtered **client-side** from each posting's `Published` date (the portal has no server-side date param). Omit for all postings.
- `--page <n>` — page number (1-indexed, ~24 results per page from the portal).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side, applied after `--jobage` filtering).
- `--format json|table|plain` — default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/wearedevelopers-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

`id` is the path segment after `/jobs/` from a search result's URL (e.g.
`ext/2066501-senior-backend-engineer-golang`). You may also pass the full
`https://www.wearedevelopers.com/jobs/...` URL. Returns company, location, contract
type, skills, salary (when the portal has it), full description, and the external
apply link.

## Usage examples

```bash
# Golang backend roles, all countries, posted in the last 14 days
bun run .agents/skills/wearedevelopers-search/cli/src/cli.ts search -q "golang backend" --jobage 14 --format table

# Same search, Germany only
bun run .agents/skills/wearedevelopers-search/cli/src/cli.ts search -q "golang backend" --country DE --format table

# Senior Go roles, Spain
bun run .agents/skills/wearedevelopers-search/cli/src/cli.ts search -q "senior golang" --country ES --format table

# Full detail for a specific listing
bun run .agents/skills/wearedevelopers-search/cli/src/cli.ts detail ext/2066501-senior-backend-engineer-golang --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing IDs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- Data source: WeAreDevelopers' documented Markdown API (`GET /jobs.md`, `GET /jobs/{id}.md`) — see `url-reference.md`. Not HTML scraping.
- `robots.txt` allows `/jobs` paths (only `/admin` and `/auth` are disallowed).
- No posting-age query param exists on the portal; `--jobage` is applied client-side against each result's `Published: <Month DD, YYYY>` field. A result with no parseable date is kept (never silently dropped) rather than assumed stale.
- Salary, experience, and contract-type fields are present only when the underlying posting (many are aggregated from Indeed/BuscoJobs/etc.) supplies them — `null` otherwise, never fabricated.
- Country filtering is coarse (whole-country only, no city/region param) — put a city name in `--query` if you need finer targeting; results aren't guaranteed to honor it since the portal's job search combines full-text and semantic matching.
- The portal may rate-limit; the CLI retries 429/5xx with exponential backoff. Keep volume low per the site's own "Be nice" policy above.
