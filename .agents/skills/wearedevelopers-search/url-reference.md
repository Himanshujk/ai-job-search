# WeAreDevelopers.com Jobs URL Reference

This skill uses WeAreDevelopers' **official, documented, agent-friendly Markdown API**,
not HTML scraping. Every page on the site is available as clean markdown by appending
`.md` to its URL or sending `Accept: text/markdown`. Full docs live at
https://www.wearedevelopers.com/agents.md (fetched 2026-08-19; re-fetch if this file
looks stale).

## Search

```
GET https://www.wearedevelopers.com/jobs.md
```

Query params:

| Param | Meaning | Example |
|-------|---------|---------|
| `q` | Free-text query (title, skill, role, company) | `golang backend` |
| `country` | Country filter | `AT`, `BE`, `DE`, `ES`, `FR`, `IT`, `LT`, `NL`, `RS`, `UK`, `US`, `VN`, or `all` |
| `page` | 1-indexed page number | `2` |

No posting-age parameter exists. The CLI filters client-side on each result's
`Published:` date.

If `country` is omitted the portal auto-detects by geo-IP — inconsistent depending on
where the request originates, so the CLI always passes an explicit value (`all` by
default).

### Response shape

```
> Markdown version of [...]. Every page supports `.md`...

---

# Developer Jobs

<N> jobs found matching "<query>"

## <Job Title>

- **Company:** <company>
- **Location:** <location>[ (Remote available)]
- **Experience:** <level>          (optional)
- **Salary:** <amount or range>    (optional)
- **Contract:** <contract type>
- **Published:** <Month DD, YYYY>
- [View job](<https://www.wearedevelopers.com/jobs/{id}>)
- [Apply](<external apply URL>)    (optional)

## <Job Title 2>
...

[Next page](https://www.wearedevelopers.com/jobs?country=...&page=2&q=...)

## Filter by Country
- [Austria](...)
- ...
```

Parse by splitting on `\n## ` headings; stop consuming job entries once a heading's
text is exactly `Filter by Country` (that section is a country-link index, not a
result). `id` for a result is the URL path segment after `/jobs/`, e.g.
`ext/2066501-senior-backend-engineer-golang`.

## Detail

```
GET https://www.wearedevelopers.com/jobs/{id}.md
```

`{id}` is the path segment used above (already includes any `ext/` prefix the portal
uses for externally-sourced postings).

### Response shape

```
> Markdown version of [...]

---

# <Job Title>

- **Company:** <company>
- **Location:** <location>
- **Contract:** <contract type>
- **Skills:** <comma-separated list>
- **Salary:** <amount or range>     (optional)
- **Experience:** <level>            (optional)
- **Published:** <Month DD, YYYY>
- **Apply:** <external apply URL>

## About the Role

<truncated preview of the description>

## Description

<full description text>

## Related Videos
- [...]

## Related Articles
- [...]
```

Prefer the `## Description` section (full text) over `## About the Role` (a shorter
preview); fall back to `About the Role` only if `Description` is absent. Ignore
`Related Videos` / `Related Articles`.

## Notes

- `robots.txt` (fetched 2026-08-19) allows `/jobs` and `/jobs.md` — only `/admin` and
  `/auth` are disallowed.
- The site's own fair-use policy (`/agents.md`, "Be nice" section): cache locally,
  summarize, cite with attribution; don't bulk-mirror or republish as your own; rate
  limit reasonably. This CLI is built for on-demand personal job search, not bulk
  collection.
- Aggregated/external postings (Indeed, BuscoJobs, etc.) sometimes carry noisy leftover
  text in the full `Description` body (e.g. truncated "related jobs" sidebar snippets
  from the original source page) — treat the structured bullet fields (Company,
  Location, Salary, Contract, Published) as authoritative over anything embedded deep
  in the free-text description.
- Page size is server-controlled (~24 results/page as observed), not a fixed documented
  constant — don't hardcode an expected count.
