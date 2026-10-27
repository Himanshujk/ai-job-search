# jobs.ch URL Reference

jobs.ch is a server-rendered React app. Search results are plain
server-rendered HTML with only a `BreadcrumbList` JSON-LD block (no per-job
structured data); job detail pages additionally embed a real schema.org
`JobPosting` as JSON-LD, which the CLI parses directly instead of scraping the
rendered page.

## Search

```
GET https://www.jobs.ch/en/vacancies/?<params>
```

Params discovered by fetching `/en/vacancies/?term=golang` and inspecting the
rendered markup and links (no public API docs found):

| Param | Meaning | Example values | Verified |
|-------|---------|-----------------|----------|
| `term` | Search terms. **Semantic/AI search, not literal keyword matching** — see quirk below. | `golang`, `backend engineer` | Yes — 257 results for `golang`, most titles not containing the literal word |
| `location` | Free-text city filter | `zurich`, `zürich` (URL-encoded `z%C3%BCrich` also seen in the site's own links) | Yes — narrowed 257→73 combined with `term=golang` |
| `page` | 1-indexed page, **real server-side pagination** | `2`, `3`, ... `13`+ (seen in the site's own paginator links for a 257-result set at ~22/page) | Yes — `page=2` returns a disjoint set of UUIDs vs `page=1` |

No working "posted since" / date-filter param was found. Candidates tried
live and rejected (none changed the result count from the unfiltered
baseline): `publishedSince`, `publicationDate`, `days`, `age`, `postedSince`,
`publication_date=P7D`. The site's own "Published since" filter button exists
in the UI but its param name isn't embedded in the initial server-rendered
HTML (likely fetched via a separate client-side call to `/api/...`, which
robots.txt disallows crawling anyway) — so this CLI implements `--jobage`
client-side instead (see below).

### Semantic search quirk (important)

jobs.ch's own feature-flag list (embedded in the page's SSR state) includes
`"semantic-search"`, `"force-semantic-search"`, and `"semantic-sponsored"` —
consistent with what live testing showed: `term=` does **not** do literal
substring/keyword matching.

- A realistic query (`term=golang`) returned 257 results, but most titles
  (`"Cobol Developer"`, `"Senior Full Stack Developer (Ruby on Rails/Vue.js)"`,
  `"DevOps Plattform Engineer-AI Platforms"`, ...) don't contain the literal
  word "golang" — only 2 of 22 sampled titles did.
- An adversarial nonsense query (`term=asdkjaslkdjqwoiuxzcv12345`) still
  returned 125 results (`"Assistentin der Geschäftsleitung"`, `"ASSC"`,
  `"Pharma-Assistent/in"`, ...) — no textual relationship to the query
  whatsoever.

Treat `--query` as a relevance-ranking signal, not a strict filter. Pass one
distinctive, realistic term; don't expect zero results for a bad query, and
don't be surprised by loosely-related matches near the tail of a result page.

### Response structure

The results-count summary is a `<span>` with a distinguishing class:

```html
<span class="c_gray.700 textStyle_caption1">257 jobs</span>
```

matched with `/<span class="c_gray\.700 textStyle_caption1">([0-9,]+) jobs?<\/span>/`.
**Do not use a bare `/\d+ jobs?/` regex** — an adversarial query containing
digits (e.g. one ending in `12345`) can produce a false-positive match
elsewhere on the page (verified live: `12345 jobs` matched 4 times from
unrelated page content before the count span was reached, due to the query
string itself appearing near the literal word "jobs" in feature-flag/tracking
JSON). Scoping to the specific span class avoids this.

Each result card is a `<div data-cy="serp-item">` block:

```html
<div data-cy="serp-item" ...>
  <a data-cy="job-link" id="vacancy-link-{uuid}" title="{Job Title}"
     href="/en/vacancies/detail/{uuid}/" ...>
    <div data-cy="vacancy-serp-item" ...>
      <p class="mb_s0 textStyle_caption1 max-w_[min-content] white-space_nowrap">{relative date}</p>
      <!-- e.g. "3 weeks ago", "Last week", "Yesterday", "5 hours ago" -->
      <span class="... fw_bold ...">{Job Title again}</span>
      <!-- three labelled rows, in this fixed order, verified across 22 real cards: -->
      <span class="[visually-hidden]">Place of work<!-- -->:</span><p class="...">{City}</p>
      <span class="[visually-hidden]">Workload<!-- -->:</span><p class="...">{e.g. "80 – 100%"}</p>
      <span class="[visually-hidden]">Contract type<!-- -->:</span><p class="...">{e.g. "Permanent position"}</p>
      <!-- avatar image, then company name: -->
      <p class="mb_s12 lastOfType:mb_s0 textStyle_caption1 c_gray.700 fw_bold">{Company Name}</p>
    </div>
  </a>
</div>
```

The CLI (`parseJobCards` in `helpers.ts`) splits the page on
`data-cy="serp-item"` to get per-card chunks, parsing each independently so
one malformed card can't break the rest (same pattern as
tokyodev-search/linkedin-search's `parseJobCards`). The company-name `<p>` is
matched via its distinguishing `c_gray.700 fw_bold` classes, which
disambiguate it from the plain-value `<p>` tags used for the three labelled
rows above it.

Verified live 2026-07-22 against a `term=golang` search (22 cards, page 1):
all 22 parsed cleanly with all three labelled rows present and in the same
order; one card's employer was "Undisclosed employer" (a real jobs.ch value,
not a parsing gap); several titles/company names contained HTML entities
(e.g. `ti&amp;m AG`, `Software R&amp;D Engineer`) that decode correctly.

### Pagination

`GET /en/vacancies/?term=golang&page=2` returns a genuinely different set of
job UUIDs than `?term=golang` (page 1) — real server-side pagination
(verified 2026-07-22, ~22 results per page). Unlike tokyodev.com and
japan-dev.com (both fully client-side, no server pagination), jobs.ch's
`--page` maps directly to the real `page` param — no client-side slicing
needed.

## Detail

```
GET https://www.jobs.ch/en/vacancies/detail/{uuid}/
```

Returns HTTP 404 for a nonexistent uuid (verified with an all-zeros uuid) —
treat as not-found, no redirect games to worry about.

Every detail page embeds (at least) two `application/ld+json` scripts: a
`BreadcrumbList` first, then a `JobPosting`. The CLI's
`extractJobPostingJsonLd` scans all script blocks and returns the first one
whose `@type` is `JobPosting`, rather than assuming a fixed script index.

Notable `JobPosting` fields (parsed directly — no HTML scraping needed for detail):
- `title`, `description` (raw HTML — strip tags, decode entities, keep paragraph breaks)
- `datePosted` — real ISO-8601 datetime, e.g. `"2026-07-03T08:47:23+02:00"` (unlike the listing's relative-string date)
- `hiringOrganization.name`
- `jobLocation.address` — `streetAddress`, `postalCode`, `addressRegion`, `addressCountry`.
  **Quirk: `addressRegion` actually holds the city name** (e.g. `"Dietikon"`,
  `"Zug"`, `"Bern"`), not a canton/state, in every sample fetched — a real
  jobs.ch data-modeling choice, not a parsing bug.
- `employmentType` — **already a human-readable string** on jobs.ch (e.g.
  `"Permanent position"`), unlike tokyodev's/japan-dev's schema.org
  `SCREAMING_SNAKE` enum — no prettification needed.
- `workHours` — free-text string, e.g. `"33.6 - 42 hours/week"`.
- `industry` — free-text string, e.g. `"Transport / Logistics"`.
- `baseSalary.currency` + `baseSalary.value.{minValue,maxValue,unitText}` —
  **the `baseSalary` key itself is always present, but its `value` sub-object
  is usually empty** (verified across 4 real postings from different
  companies/roles — Swiss postings rarely publish explicit salary figures).
  The CLI treats an empty `value` (`minValue`/`maxValue` both absent) as "no
  salary data" and returns `null` for `salaryMin`/`salaryMax`/`salaryCurrency`,
  rather than surfacing a misleading bare `currency: "CHF"` with no numbers.
- `potentialAction.target.urlTemplate` — a same-site
  `https://www.jobs.ch/en/vacancies/detail/{uuid}/apply` URL. **Verified not
  disallowed by robots.txt** (see Access notes) — used directly as
  `detail.applyUrl`, unlike tokyodev.com where the real apply link is
  disallowed and thus left `null`.

## Access notes

- `robots.txt` (checked 2026-07-22, `User-agent: *` block) disallows:
  `/api/`, `/api_proxy/`, `/external/`, `/*/login/`, `/*/register/`,
  `/*/auth/`, `/*/application/*`, `/de/stellenangebote/detail/*/*/*`,
  `/en/vacancies/detail/*/*/*`, `/fr/offres-emplois/detail/*/*/*`, plus a few
  narrower company-subpage patterns. A separate `SemrushBot` block disallows
  everything (`/`) — irrelevant here, this CLI doesn't identify as SemrushBot.
- **The `detail/*/*/*` disallow does NOT match this CLI's real detail URLs** —
  verified independently (not just trusted from an initial hypothesis).
  Robots.txt wildcard matching treats an un-anchored pattern as
  `^/en/vacancies/detail/` + `.*` + `/` + `.*` + `/` + `.*`, requiring **two**
  literal `/` characters after the `detail/` prefix. The real URL
  (`/en/vacancies/detail/{uuid}/`) has only **one** `/` after the uuid — not
  enough to satisfy the pattern. Confirmed by direct character-counting
  against a real fetched URL, not just regex reasoning in the abstract.
  `/en/vacancies/detail/{uuid}/` and `/en/vacancies/detail/{uuid}/apply` (one
  slash after the uuid in both cases) are both effectively **Allowed**.
- No login/authentication required for either `/en/vacancies/` or
  `/en/vacancies/detail/...` — confirmed via plain unauthenticated `fetch()`
  returning full result/detail HTML both times.
- Bun's native `fetch()` works directly against jobs.ch with a browser
  User-Agent — **no Cloudflare-style TLS/HTTP2 challenge encountered** (unlike
  tokyodev.com, which required a `curl --http1.1` workaround). Verified with a
  minimal Bun script hitting both the search and detail endpoints, plus a 404
  case. This CLI uses plain `fetch()`, same as japandev-search/hiringcafe-search.
- No official developer API found — this is the site's own server-rendered
  markup (for search) plus its embedded schema.org structured data (for
  detail). If parsing breaks, re-fetch `/en/vacancies/?term=...` and a
  `/en/vacancies/detail/...` page and re-inspect the markup / JSON-LD shape.
