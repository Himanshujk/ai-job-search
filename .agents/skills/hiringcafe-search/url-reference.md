# HiringCafe URL Reference

hiringcafe.com has no dedicated public JSON API. Every page (search results and job
detail) is a Next.js page that embeds its data server-side in a
`<script id="__NEXT_DATA__" type="application/json">` blob. The CLI fetches the
page HTML and parses that blob directly — no separate endpoint, no HTML scraping.

> **Personal use only** — see the SKILL.md warning on the `robots.txt` disallow of
> the `searchState` query pattern used below. Keep volume low.

## Search

```
GET https://hiringcafe.com/?searchState=<url-encoded JSON>&page=<n>
```

`searchState` is a JSON object merged over server defaults; unknown keys are
dropped silently (not an error). Keys used by this CLI:

| Key | Meaning | Example |
|-----|---------|---------|
| `searchQuery` | Free-text query (title, skill, role, and — since there's no location param — city/country) | `"golang developer bengaluru"` |
| `defaultToUserLocation` | If `true` (site default), results are scoped to the requester's geo-IP country. The CLI always sets `false` for deterministic, unscoped results. | `false` |
| `dateFetchedPastNDays` | Posting-age filter — **not a literal day count**, see table below. `-1` means unbounded/all-time. | `121` |
| `workplaceTypes` | Array of workplace-type strings | `["Remote"]`, `["Hybrid"]`, `["Onsite"]` |
| `page` (top-level query param, not inside `searchState`) | 1-indexed page number | `2` |

Response: parse `__NEXT_DATA__.props.pageProps`:
- `ssrHits` — array of job objects (same shape as the detail page's `job`, see below)
- `ssrTotalCount` — total matching jobs
- `ssrPage` — echoed page number
- `ssrPageSize` — page size (~40)

### `dateFetchedPastNDays` bucket table

Discovered by inspecting the site's own client JS bundle (`dateSelectionOptions`
array) — these are **opaque internal codes**, not real day counts. Passing any
value outside this set is silently ignored server-side (filter dropped entirely,
full unbounded result returned) rather than erroring, which is what makes this
easy to miss when testing ad hoc.

| Label | Bucket value | Approx. real days (CLI's `--jobage` mapping) |
|-------|-------------|-----------------------------------------------|
| Past 24 hours | 2 | 1 |
| 3 days | 4 | 3 |
| 1 week | 14 | 7 |
| 2 weeks | 21 | 14 |
| 3 weeks | 29 | 21 |
| 1 month | 61 | 30 |
| 2 months | 91 | 60 |
| 3 months (server default if omitted) | 121 | 90 |
| 4 months | 151 | 120 |
| 5 months | 181 | 150 |
| 6 months | 211 | 180 |
| 1 year | 750 | 365 |
| 2 years | 1080 | 730 |
| 3 years | 1440 | 1095 |
| (unbounded) | -1 | n/a — CLI default when `--jobage` is omitted |

## Detail

```
GET https://hiringcafe.com/job/<any-slug-text>-<requisition_id>
```

The server resolves purely by the trailing `requisition_id` (an opaque alphanumeric
token, e.g. `olea5aapgevu88cq`) and 308-redirects to the canonical slugged URL
regardless of what precedes it — `GET /job/x-olea5aapgevu88cq` redirects correctly.
Follow redirects (the CLI's fetch does this by default).

Response: parse `__NEXT_DATA__.props.pageProps.job` (absent/`null` if the job is
gone/invalid — treat as not-found). Notable fields:
- `job_information.title`, `job_information.description` (raw HTML — strip tags,
  decode entities, keep paragraph breaks)
- `v5_processed_job_data.company_name`, `.formatted_workplace_location`,
  `.workplace_type` (`Remote`/`Hybrid`/`Onsite`), `.commitment` (employment type,
  e.g. `["Full Time"]`), `.seniority_level`
- `enriched_company_data.name` — fallback company name if `company_name` is absent
- `apply_url` — direct link to the original ATS application page
- `requisition_id` — same token used to build the canonical URL

## Access notes

- `robots.txt`: `Disallow: /*?searchState=*` for `User-agent: *` (all bots) — the
  exact mechanism used for search. `/job/...` detail pages are Allowed. `robots.txt`
  also blocks `meta-externalagent` and `Applebot-Extended` site-wide (AI-training
  crawlers), unrelated to this CLI's usage.
- No login/authentication required for search or detail pages.
- No official developer API found — this reverse-engineers the site's own SSR data
  contract, which may change if hiringcafe restructures its Next.js app. If parsing
  breaks, re-fetch a search/detail page and re-inspect `__NEXT_DATA__.props.pageProps`.
