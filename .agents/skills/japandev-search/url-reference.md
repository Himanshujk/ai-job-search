# Japan Dev URL Reference

Investigated 2026-07-22, corrected same day after a bug was found in the original
version of this CLI (see below).

## The Algolia dead end (don't repeat this)

japan-dev.com's pages embed a public, search-only Algolia key in
`window.__NUXT__.config.public.algolia`:

```
applicationId: 8S3J8C7YSA
apiKey:        9ebc037e3e423ff4aa80a065944a2b5b   (search-only key)
index:         Job_production
```

This looks like the obvious integration point, and the first version of this CLI
called it directly. **Don't do that** — calling
`POST https://8S3J8C7YSA-dsn.algolia.net/1/indexes/Job_production/query` with this
key returns a snapshot frozen at **Sep 2024** (241 hits, confirmed via an empty-query
`hitsPerPage:1000` request, re-checked minutes apart with identical results). Meanwhile
the site's own `/jobs` page — fetched at the exact same time — embeds postings dated
today. Matching the site's exact request shape (`hitsPerPage:60, page:0`) made no
difference, and no alternate index name (`Job`, `Job_production_v2`, `jobs`, etc.) was
reachable with the same key (`404 Index ... does not exist` for all of them). So the
direct endpoint is genuinely scoped to older/different data than what real visitors
see — not a caching artifact. **Do not build a "search" feature on this endpoint.**

## The real data source: `__NUXT_DATA__`

Every page (`/jobs` and each job's own detail page) is server-rendered by Nuxt 3 and
embeds its live data in:

```html
<script id="__NUXT_DATA__" type="application/json">[ ... ]</script>
```

This is Nuxt's **devalue flat-array** serialization format: the script content is a
single JSON array (call it `pool`). Any place a "real" nested value would normally
appear, the serializer instead stores a plain integer — the index of the pool slot
that actually holds that value. To resolve a value at `pool[i]`:

- If `pool[i]` is a string/number/boolean/null → that's the leaf value, use it as-is.
- If `pool[i]` is a plain array of integers → each integer is itself a ref; resolve
  every element the same way to get the real array.
- If `pool[i]` is a plain object whose values are integers → each value is a ref;
  resolve every property the same way to get the real object.
- If `pool[i]` is a 2-element array whose first element is a string like
  `"ShallowReactive"`, `"Reactive"`, `"ShallowRef"`, or `"Ref"` → it's a Vue reactivity
  wrapper; unwrap by resolving `pool[i][1]`. (`Set`/`Map` wrappers also appear in this
  payload for unrelated app state — e.g. empty `likedJobs`/`appliedJobs` — but never
  wrap job data, so this CLI doesn't special-case them.)

This CLI's `derefSlot()` in `helpers.ts` implements exactly this, capped at a recursion
depth of 12 as a safety net (job records never nest anywhere near that deep).

### Finding job records in the pool

Scan every pool slot for a **plain object** (not yet resolved) that has all three of
`sponsors_visas`, `employment_type`, and `title` as keys — this fingerprint reliably
identifies a job record. Each job also has an Algolia-style `_highlightResult` /
`_snippetResult` mirror copy embedded nearby with the **exact same key set** (since it's
copied from the underlying Algolia hit shape) — but every value in those copies is
wrapped as `{value: "..."}` instead of being a plain string. `toLiveJob()` rejects any
candidate whose resolved `title`/`slug` aren't plain strings, which naturally filters
out these decoys without needing to specifically detect `_highlightResult`.

A single `/jobs` fetch (no query string needed or supported — see below) yields ~60
real job records this way.

### Per-job fields (same shape on `/jobs` and on detail pages, with gaps — see below)

| Field | Notes |
|-------|-------|
| `title`, `slug` | Job title and its own slug (not company-prefixed by itself). |
| `company.name`, `company.slug`, `company_name` | `company.slug` builds the detail URL: `/jobs/<company.slug>/<slug>`. `company_name` is a flat convenience duplicate of `company.name`. |
| `location` | e.g. `"Tokyo"`, `"Remote"`. |
| `published_at` | ISO 8601 — the field this CLI's `--jobage` filters against. |
| `job_post_date` | Human string (`"Jul 22, 2026"`) — fallback display date. |
| `salary_min`, `salary_max`, `has_salary_data` | Numbers in JPY/year; **check `has_salary_data` — min/max are sometimes present but stale/meaningless when this is `false`.** |
| `sponsors_visas` | `sponsors_visas_yes` / `_no` / `_unknown`. |
| `remote_level` | `remote_level_none` / `_around_office` / `_partial` / `_full_japan` / `_full_worldwide`. |
| `seniority_level` | `seniority_level_new_grad` / `_junior` / `_mid_level` / `_senior` / `_unknown`. |
| `english_level`, `japanese_level` | Already human-readable strings (e.g. `"Not Required"`), unlike the other enum fields above. |
| `employment_type` | Raw enum, e.g. `employment_type_full_time` — **not used by this CLI**; see the gap below. |
| `contract_type` | Human string, e.g. `"Full-time"` — **often absent on detail pages**, see below. |
| `skill_names` | Array of strings, e.g. `["Go", "Docker"]` — **often absent on detail pages**, see below. |
| `application_url` | Direct external apply link (often an ATS like Greenhouse). |

### A real gap: detail pages embed a sparser record than listing pages

Fetching `/jobs` and fetching that same job's own `/jobs/<company>/<slug>` page both
embed a job record via `__NUXT_DATA__`, but the detail page's copy is missing
`contract_type`, `english_level`, `japanese_level`, and `skill_names` even when the
listing page's copy of the identical job has them populated (confirmed directly:
same job, same fetch session, different completeness). There's no known workaround
short of also having the listing-page copy on hand (which `detail` doesn't assume,
since a user can call `detail` directly with an id from anywhere). This CLI instead
pulls `employmentType` from the JobPosting JSON-LD (see below), which detail pages do
have reliably; `skills`/`englishLevel`/`japaneseLevel` are simply `null` on
detail-only lookups.

### No query-string filtering, no page param

Tried and confirmed **not** to change the embedded payload: `?query=<text>`,
`?page=2`. The page always renders the same fixed live set. True search/filtering is
client-side-only, via the (stale) Algolia widget — unreachable from a plain HTTP CLI.
So `search` fetches `/jobs` once and does all filtering (`--query`, `--location`,
`--remote`, `--visa`, `--jobage`) itself, in `helpers.ts`'s `matches*` functions.

## Detail page

```
GET https://japan-dev.com/jobs/<company-slug>/<job-slug>
```

Embeds exactly one live job record (same shape/gaps as above) plus a schema.org
`JobPosting` block:

```html
<script type="application/ld+json">{"@context":"https://schema.org/","@type":"JobPosting", ...}</script>
```

Notable `JobPosting` fields used by this CLI:
- `description` — raw HTML; strip tags, decode entities, keep paragraph breaks.
- `employmentType` — schema.org SCREAMING_SNAKE (`"FULL_TIME"`); prettify to `"Full Time"`.
  Preferred over the live payload's `contract_type` since detail pages often lack the latter.

A nonexistent job path 404s cleanly (`htmlFetch` returns `""`, treated as not-found).

## Resolving a `detail` lookup

`id` from `search` is always `<company-slug>/<job-slug>` — self-sufficient. `normalizeJobId`
accepts that bare pair or extracts it from a full/partial `/jobs/<company>/<job>` URL.
No secondary lookup needed; the detail URL is built directly and fetched once.

## Access notes

- `robots.txt` (fetched 2026-07-22): `User-agent: *` with no disallow on job or search
  paths — only two unrelated blog/PDF entries are disallowed. Fully open for this CLI's usage.
- No login/authentication required for `/jobs` or job detail pages.
- If japan-dev.com restructures its Nuxt build, re-fetch `/jobs` and grep for
  `id="__NUXT_DATA__"`, then look for an object with `sponsors_visas` + `employment_type`
  + `title` keys to re-locate the job-record shape.
