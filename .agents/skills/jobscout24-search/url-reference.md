# JobScout24 URL Reference

jobscout24.ch is an ASP.NET-rendered site (Azure-hosted, behind Azure Front
Door — `x-azure-ref` response header, no Cloudflare-style bot challenge seen).
Search results are plain server-rendered HTML; job detail pages additionally
embed a schema.org `JobPosting` (alongside a `BreadcrumbList`) as a JSON
*array* inside one `application/ld+json` script tag, which the CLI parses
directly instead of scraping the rendered HTML.

## Search

```
GET https://www.jobscout24.ch/en/jobs/?<params>
GET https://www.jobscout24.ch/en/jobs-in-{city-slug}/?<params>
```

### How this was found

The visible `<form id="SearchForm" method="post" action="/en/jobs/search/">`
on `/en/jobs/` carries an `__RequestVerificationToken` hidden field, which
looked like it might force a POST with anti-forgery protection. Investigation
(2026-07-22):

- `GET /en/jobs/search/?SearchWhat=golang` (the form's own POST-only action,
  hit via GET) → **HTTP 400**, empty body. Confirms that specific path really
  is POST-only.
- `GET /en/jobs/?SearchWhat=golang` (the *listing* page itself, not the form's
  action) → **HTTP 200**, `<title>Golang jobs - 4 vacancies on JobScout24</title>`,
  with real per-title matches (verified: titles containing "Golang" as a
  standalone word, e.g. "Senior Backend Engineer - Golang (f/m/d)"). **No
  token, cookie, or session required.**
- `GET /en/jobs/golang/` (category-style path, mirroring tokyodev's `/jobs/go`
  pattern) → also works, same result set.

So `/en/jobs/` itself is the real search endpoint; the `SearchForm`'s POST
action is presumably just used for whatever client-side JS enhancement the
site's own frontend does, not the only way in.

### Params

| Param | Meaning | Notes |
|-------|---------|-------|
| `SearchWhat` | Free-text keyword search | The verified working param. `?term=` (the jobs.ch/jobup.ch convention) does **not** work on this site — it silently returns the generic unfiltered/category nav page. |
| `p` | Page number, 1-indexed | Confirmed via the site's own "Next" pagination link: `/en/jobs/?SearchWhat=developer&amp;p=2`. Real server-side pagination — page 2 returns different job IDs than page 1 (verified). ~20 results per page (949 results → "Page 1 / 48"). An out-of-range page (e.g. `p=99` on a small result set) returns **HTTP 404**, not an empty 200 — the CLI treats that as zero results, not a fetch error. |
| `SearchWhere` | *(does not work)* | Tried as a query param — verified **zero effect**: `?SearchWhat=developer&SearchWhere=Zurich` returns a byte-identical set of job IDs to the unfiltered `?SearchWhat=developer` query. The real location filter is a path segment instead (see below). |
| `SortIndex` | Result sort order | `0`=Relevance (default), `1`=Currentness, `2`=Job title, `3`=Company name, `4`=Place of work. Not used by this CLI (jobage filtering is done client-side over whatever order the default relevance sort returns). |
| `Region` | Region checkbox filter (numeric IDs 1-13+, e.g. `1`=North West Switzerland) | Present on the form; not exposed by this CLI (city-based `--location` covers the common case more directly). |
| `isApprenticeship` | Apprenticeship-only toggle | Present on the form; not exposed by this CLI. |

### Location filtering — path segment, not a param

Confirmed working: `GET /en/jobs-in-{city-slug}/?SearchWhat=<query>`, e.g.
`/en/jobs-in-zurich/?SearchWhat=developer` → `<title>Developer jobs  in
Zürich - 423 vacancies on JobScout24</title>` (vs. 949 unfiltered — a real
narrowing). The bare `/en/jobs-in-{city}/` path (no `SearchWhat`) also works
standalone and returns that city's full job count.

City slugs are the lowercased, hyphenated, diacritic-stripped city name —
`zurich`, `basel`, `geneva` (resolves to "Genf", the German name jobscout24
uses internally — the slug itself stays the English spelling), `st-gallen`,
`lausanne`, `winterthur`, etc. all confirmed working. The CLI's
`slugifyLocation()` builds this from an arbitrary `--location` string
(`.normalize("NFD")` + strip combining marks + lowercase + hyphenate).

### Response structure

Total count: `<div class="result-stats fill" data-total-job-count="949">` —
the CLI's primary count source, with `<title>...N vacancies...</title>` /
`<title>...N vacancy...</title>` as a fallback regex.

Each result is a flat `<li class="job-list-item ...">` — **no company
grouping** (unlike tokyodev):

```html
<li class="job-list-item "
    data-job-id="10307367"
    data-job-detail-url="/en/job/{uuid}/"
    data-offer-id="jbs_50">
  <div class="upper-line">
    <a href="/en/job/{uuid}/" class="job-link-detail job-title" title="{Title}">{Title}</a>
  </div>
  <p class="job-attributes">
    <span>{Company}</span>, <span>{Location}</span>
  </p>
  <div class="lower-line ">
    <div class="job-tags">
      <ul>
        <li><span class="tag tag-readonly">{workload, e.g. "80% - 100%"}</span></li>  <!-- optional -->
        <li><span class="tag tag-readonly">{company-size tag}</span></li>            <!-- optional -->
      </ul>
    </div>
    <p class="job-date">{relative date, e.g. "5 d", "2 w", "New", "1+m"}</p>
  </div>
</li>
```

Some result sets include externally-aggregated postings after a
`<div class="web-jobs-separator">Further jobs from the web</div>` marker —
those `<li>` tags carry an extra `webjob` class (`class="job-list-item
webjob"`) but are otherwise identical in shape, and their `/en/job/{id}/`
detail pages return the same structure (real `JobPosting` JSON-LD, verified on
one such entry). The CLI (`parseJobCards` in `helpers.ts`) doesn't
special-case them.

The **job ID is a UUID** embedded in the `/en/job/{uuid}/` path — a single
opaque token, unlike tokyodev's `company-slug/job-slug` pair. `data-job-id` is
a *separate* numeric internal ID (seen elsewhere, e.g. in the
`{title-slug}/{numeric-id}/externalapply/` apply-redirect path) that the CLI
does not use or expose — the UUID from the href is the canonical id for
`detail`.

**No date or location field is missing from the listing** (both are present,
unlike tokyodev) — but the date is only ever a coarse relative bucket ("New",
"N d", "N w", "N+m"), never an exact date or timestamp. Exact `datePosted`
(ISO 8601) is only available via `detail`'s JSON-LD.

## Detail

```
GET https://www.jobscout24.ch/en/job/{id}/
```

Returns HTTP 404 for a nonexistent id (verified) — treated as not-found.

Every detail page embeds exactly one `application/ld+json` script (note: it
also carries a CSP `nonce` attribute, so the extraction regex allows arbitrary
script-tag attributes rather than matching a bare `type="application/ld+json"`):

```html
<script type="application/ld+json" nonce="...">[{...JobPosting...},{...BreadcrumbList...}]</script>
```

Unlike tokyodev/japan-dev (a single JSON-LD object), jobscout24 wraps it in a
**JSON array** containing both the `JobPosting` and a `BreadcrumbList` — the
CLI's `extractJobPosting()` parses the array and picks out the element with
`"@type": "JobPosting"`.

Notable `JobPosting` fields:
- `title`, `description` (raw HTML — strip tags, decode entities, keep
  paragraph breaks; frequently mixes German section headers with
  English/German body text depending on what the employer submitted)
- `datePosted` — full ISO-8601-ish datetime, e.g.
  `"2026-07-21T20:03:48.7600000"` (7-digit fractional seconds — a .NET
  `DateTime` serialization quirk; still parses fine with `Date.parse`/`new
  Date()`)
- `hiringOrganization.name`
- `jobLocation.address` — `addressLocality`, `addressRegion`,
  `addressCountry` (e.g. Zurich / CH / CH — region is often just the country
  code repeated, not a canton abbreviation, unlike the construction-trade
  example seen during investigation which did have a real canton code "BE")
- `employmentType` — schema.org enum, but as an **array**, e.g.
  `["FULL_TIME"]` or `["FULL_TIME","PART_TIME"]` (prettified by the CLI to
  `"Full Time"` / `"Full Time, Part Time"`)
- `industry`, `occupationalCategory` — free-text category fields, present on
  every posting checked
- No `baseSalary` field was observed on any posting fetched during
  investigation — Swiss job ads rarely disclose salary publicly, so this CLI
  doesn't model a salary field at all (unlike tokyodev/japan-dev)

### Apply link — intentionally not resolved

The detail page's "Apply online" button carries a
`data-redirect="/en/job/{title-slug}/{numeric-id}/externalapply/"` attribute.
This is **not** a stable, directly-fetchable URL — attempting to hit it
directly (without the exact session/cookie state the rendered page carries)
returned **HTTP 404** during investigation. The CLI does not construct,
guess, or follow this path; `detail.applyUrl` is always `null`, and the CLI
points users back at the canonical `/en/job/{id}/` page instead.

## Access notes

- `robots.txt` (checked 2026-07-22):
  ```
  User-agent: *
  Disallow: /app/
  Disallow: /aspnet_client/
  Disallow: /careers/
  Disallow: /companies/
  Disallow: /de/account/
  Disallow: /de/apply/
  Disallow: /de/cookies/
  Disallow: /de/customer/
  Disallow: /en/account/
  Disallow: /en/apply/
  Disallow: /en/cookies/
  Disallow: /en/customer/
  Disallow: /exportfeed/
  Disallow: /fr/account/
  Disallow: /fr/apply/
  Disallow: /fr/cookies/
  Disallow: /fr/customer/
  Disallow: /JS24Web/
  Disallow: /js24web/
  Disallow: /statistics/

  Sitemap: https://www.jobscout24.ch/sitemap/sitemap.xml.gz
  ```
  `/en/jobs/`, `/en/jobs-in-*/`, and `/en/job/{id}/` are all Allowed. No
  Claude-specific or general-AI-bot block found (unlike naukri.com).
- No login/authentication required for search or detail pages.
- The sitemap index (`/sitemap/sitemap.xml.gz`) links per-locale job-detail
  sitemaps (`sitemap.jobdetails_en_0.xml.gz` etc., ~15,000 URLs each) that were
  used during investigation to discover the `/en/job/{uuid}/` detail URL
  pattern and pull a real sample id — not used at runtime by the CLI itself.
- If parsing breaks, re-fetch `/en/jobs/?SearchWhat=<something-common>` and a
  `/en/job/{id}/` page and re-inspect the markup / JSON-LD shape.
