# jobup.ch URL Reference

jobup.ch is a JobCloud-group Swiss job board (same publisher as jobs.ch, but a
distinct site/listing set with its own markup — do not assume identical HTML
structure). It's a React/SSR app (Tailwind-style atomic classes, e.g.
`bdr_r16`, `c_gray.700`) with no Cloudflare bot-management challenge — plain
`fetch()` with a browser User-Agent gets a normal 200, no `curl --http1.1`
workaround needed (unlike tokyodev.com).

## Correction to the pre-task assumption

The task brief assumed jobup.ch's search-results page embeds only one
`application/ld+json` block (a breadcrumb), with no per-job `JobPosting` data,
based on a single quick fetch. **This is false, verified live 2026-07-22**:
`GET /en/jobs/?term=golang` returns a page with **one `<script
type="application/ld+json">` block containing a JSON array** of four schema.org
nodes:

```json
[
  {"@type": "WebSite", ...},
  {"@type": "CollectionPage", "name": "66 Golang jobs - jobup.ch", ...},
  {"@type": "BreadcrumbList", ...},
  {"@type": "ItemList", "numberOfItems": 22, "itemListElement": [
    {"@type": "ListItem", "position": 1, "item": { "@type": "JobPosting", ... }},
    ...
  ]}
]
```

The `ItemList.itemListElement[].item` is a full `JobPosting` object per card —
`title`, `description` (generic boilerplate, e.g. `"We are looking for a X to
join our team."` — NOT the real posting body), `identifier.value` (the job's
UUID), `datePosted` (ISO 8601), `employmentType` (a plain human string, e.g.
`"Permanent position"`, not a schema.org enum), `hiringOrganization.name` +
`.sameAs` (link to the company's jobup.ch page), `jobLocation.address`
(sometimes just `{addressCountry: "CH"}`, sometimes also `addressLocality`),
and `url` (the canonical detail-page link).

This CLI (`parseJobCards` in `helpers.ts`) parses this JSON-LD directly as the
primary source — far more robust than regex over the page's atomic-CSS
markup — and only falls back to HTML-card scraping for the one gap: the
listing JSON-LD's address sometimes lacks `addressLocality` even when the
rendered card visibly shows a city (verified: the very first `golang` result,
Integraal Data Services' "Ingénieur DevOps (H/F)", has `jobLocation.address =
{addressCountry: "CH"}` in JSON-LD, but the HTML card plainly shows "Place of
work: Acacias"). `parseCardExtras` splits the raw HTML on each card's unique
`data-cy="serp-item-{uuid}"` marker (one marker per job — safe to split on,
verified no other element uses this exact literal) and pulls the "Place of
work" and "Workload" text next to it, keyed by uuid, to backfill both.

## Search

```
GET https://www.jobup.ch/en/jobs/?<params>
```

All three params below were discovered empirically (none appear in a plain
`<form>` in the static HTML — the location combobox and filter dropdowns are
client-rendered React components with no `name` attribute visible
server-side) by testing candidate param names against the real site and
comparing the `<title>` tag's reported count:

| Param | Meaning | Verified behavior |
|-------|---------|--------------------|
| `term` | Free-text keyword search | Confirmed in the task brief; genuinely semantic — a total-nonsense string (`zzzqqqxxxnonexistentgibberish999888`) still returned 6 results and triggered jobup's own `data-cy="semantic-search-infobox"` "did you mean" banner, rather than 0. Don't expect a strict/literal match. |
| `location` | City/region filter | Confirmed by testing `location=Zurich` against `term=golang`: count dropped from 66 to 2, and `<title>` changed to `"2 Golang job ads in Zurich found on jobup.ch"`. Tried-and-failed candidates: `places`, `place`, `region`, `regions[]`, `locations[]`, `canton` — all silently ignored (count stayed at 66). |
| `publication-date` | Posted within N days | Confirmed by testing `publication-date=<N>` against `term=golang`: 1→12, 2→16, 3→17, 5→22, 7→33, 10→39, 14→43, 21→59, 30→66, 60→66, 90→66 (monotonically increasing, i.e. a genuine day-count filter, not a snapped bucket of preset options despite the UI showing a dropdown labeled "Published since"). Tried-and-failed candidates: `publicationDate`, `since`, `days`, `posted_since`, `date`, `age` — all silently ignored. |
| `page` | 1-indexed page | Confirmed real server-side pagination: `page=2`/`page=3` return genuinely different job sets (~22/page; last page of a 66-total set had 20 unique ids — some overlap with earlier pages likely from promoted/pinned listings, so `sum(unique ids across pages) ≤ total` is expected, not a bug). An out-of-range page (`page=999`) silently returns page 1's content again rather than erroring or going empty — this CLI does not special-case that; the caller just gets page 1's data back for an absurd page number. |

`location` and `term` compose independently — `location`-only browsing (no
`term`) works too, e.g. `GET /en/jobs/?location=Zurich` returned "7267 job ads
in Zurich" (this CLI's `search` always passes `term` when given but tolerates
it being empty).

### Response structure — total count

The page `<title>` tag reliably carries the total count as its first token,
across every combination tested:
- `"66 Golang job ads found on jobup.ch"` (term only)
- `"2 Golang job ads in Zurich found on jobup.ch"` (term + location)
- `"0 Golang job ads in Nonexistentcityxyz123456 found on jobup.ch"` (zero results)
- `"7267 job ads in Zurich found on jobup.ch"` (location only, no term)
- `"66 Golang job ads found on jobup.ch - 3"` (page ≥ 2 appends `" - N"`)

`parseTotalCount` matches `/<title>\s*(\d+)\s/` — robust across all the above.

Zero-result pages have an `<h2 data-cy="empty-title">No Golang jobs in
{location}</h2>` and the JSON-LD's `ItemList.itemListElement` is simply absent
(no job objects to parse) — `parseJobCards` returns `[]` cleanly in that case.

### Result cards (HTML, supplementary only)

Each result card is:

```html
<a href="/en/jobs/detail/{uuid}/" data-discover="true">
  <div data-cy="vacancy-serp-item">
    <div data-cy="serp-item-{uuid}">  <!-- header row: relative post-date text + bookmark button -->
      ...<p class="mb_s0 ...">Last week</p>...
    </div>
    <div class="mb_s8"><span class="... fw_bold ...">{Job Title}</span></div>
    <div>  <!-- details grid -->
      <span>Place of work<!-- -->:</span><p class="mb_s12 ...">{City}</p>
      <span>Workload<!-- -->:</span><p class="mb_s12 ...">{Workload %}</p>
      <span>Contract type<!-- -->:</span><p class="mb_s12 ...">{Employment Type}</p>
    </div>
    <div>  <!-- company row -->
      <picture>...</picture>
      <p class="... fw_bold">{Company Name}</p>
    </div>
    <!-- "Promoted" / "Easy apply" tags, relevance-feedback buttons — not parsed, no CLI field needs them -->
  </div>
</a>
```

Note the Tailwind-style atomic class names (`bdr_r16`, `c_gray.700`, `fw_bold`)
are almost certainly build-hash-stable but not guaranteed forever — if parsing
breaks, re-fetch `/en/jobs/?term=golang` and re-diff this structure. The
`data-cy="serp-item-{uuid}"` marker and the literal label text ("Place of
work", "Workload", "Contract type") are the most durable anchors, since
`data-cy` attributes are Cypress test hooks the site's own QA suite depends
on — more stable than styling classes.

## Detail

```
GET https://www.jobup.ch/en/jobs/detail/{uuid}/
```

Returns HTTP 404 for a nonexistent UUID (verified) — `htmlFetch` returns `""`
on 404, and `runDetail` reports `NOT_FOUND`.

The detail page embeds **two** separate `<script type="application/ld+json">`
blocks — order matters, don't just grab the first:

1. `BreadcrumbList` (array-wrapped: `[{...}]`) — comes first in the raw HTML.
2. `JobPosting` (a single plain object, not array-wrapped) — comes second.

`extractJobPosting` in `helpers.ts` parses *every* `<script
type="application/ld+json">` block on the page (flattening arrays), then
searches for the node with `@type === "JobPosting"` — order-independent by
design, so it doesn't matter which block comes first.

The detail page's `JobPosting` is much richer than the listing's:
- `description` — full rich-text HTML (verified real, e.g. a genuine French
  job description with nested `<div class="C_PHEADHTML">`/`C_PTITLEHTML`/
  `C_PBODYHTML"` wrapper divs and some malformed/overlapping `<strong>` tags —
  `cleanDescription` strips tags and decodes entities regardless of nesting
  validity, verified to produce clean readable text from a real posting).
- `jobLocation.address` — full postal address (`streetAddress`,
  `addressRegion`, `postalCode`, `addressCountry`) — note it's
  `addressRegion` here, not `addressLocality` as on the listing (e.g.
  `"Geneve"` under `addressRegion`) — `formatLocation` in `helpers.ts` handles
  either key.
- `employmentType` — same plain string as the listing (e.g. `"Permanent
  position"`), not a schema.org enum.
- `workHours` — e.g. `"42 - 42 hours/week"` (a range even when min=max).
- `baseSalary.currency` + `baseSalary.value.{minValue,maxValue}` — **verified
  the `value` object is frequently present but empty** (no `minValue`/
  `maxValue` keys at all) rather than the whole `baseSalary` key being absent
  — this CLI checks for the presence of the numeric fields specifically, not
  just the parent key, and reports `salaryMin`/`salaryMax`/`salaryCurrency` as
  `null` in that (common) case.
- `sameAs` — link to the company's jobup.ch enterprise page (not the apply
  link).

### Apply link — not resolved

No apply link or button appears anywhere in the detail page's static HTML at
all (verified via `grep` for `apply`/`application` — zero matches) — it's
rendered entirely client-side. Separately, robots.txt disallows
`/en/application/*` (and the `/de/`, `/fr/` equivalents), which is presumably
where the real apply flow lives. This CLI does not construct, guess, or
follow any such path; `detail.applyUrl` is always `null`, pointing users back
at the canonical jobup.ch detail page instead.

## Access notes

- `robots.txt` (checked 2026-07-22, matches the task brief's earlier fetch):
  `Disallow: /external/`, `/api/`, `/api_proxy/`,
  `/de|en|fr/registrieren|inscription|register/`, `/de|en|fr/login/`,
  `/de|en|fr/auth/`, `/masks/`, `/javascript/`, `/fe/ktunnel/`,
  `/de|en|fr/application/*` (and its email-application variants), `/*.map$`,
  and some enterprise/company-group pages (`/en/enterprises/*/groups/`, etc).
  No disallow on `/en/jobs/` or `/en/jobs/detail/...`, and no Claude/AI-bot-specific
  block was found.
- No login/authentication required for search or detail pages — confirmed via
  plain unauthenticated `fetch()`/`curl`, no redirect to a login page.
- No official developer API found — this is the site's own embedded
  schema.org structured data (search + detail) plus a small HTML-card
  supplement for listing-page location/workload. If parsing breaks, re-fetch
  `/en/jobs/?term=golang` and `/en/jobs/detail/{uuid}/` and re-inspect both
  the JSON-LD and the HTML card structure.
