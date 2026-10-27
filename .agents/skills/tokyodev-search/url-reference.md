# TokyoDev URL Reference

tokyodev.com is a Rails app (Heroku-hosted, behind Cloudflare). Search results
are plain server-rendered HTML; job detail pages additionally embed a
schema.org `JobPosting` as JSON-LD, which the CLI parses directly instead of
scraping the rendered page.

## Search

```
GET https://www.tokyodev.com/jobs?<params>
```

The real search/filter form (`id="job_filters"`, `action="/jobs"`, `method="get"`)
uses bracketed array params for every filter — all discovered by fetching
`https://www.tokyodev.com/jobs/go` and `https://www.tokyodev.com/jobs` and
inspecting the filter `<form>`:

| Param | Meaning | Example values |
|-------|---------|-----------------|
| `query[]` | Free-text search — genuinely full-text over title, tags, **and description body** (verified: a stack keyword like `kubernetes` matched postings where it only appeared in the body, not the title/tags). **Multi-word values are OR'd, not AND'd** — verified with `golang xyzzyunlikely` (nonsense 2nd word) returning the same count as `golang` alone (5), and `golang manager` returning ~`manager`-alone's count (108 vs 107), not a small intersection. Pass one distinctive keyword for precision. | `golang`, `kubernetes` |
| `category[]` | Role category | `backend`, `frontend`, `devops`, `sre`, `mlops`, `security`, … (44 values total — see the `<form>` on `/jobs` for the full list) |
| `programming_language[]` | Language tag | `go`, `python`, `typescript`, `rust`, `java`, `kotlin`, `c-plus-plus`, `c-sharp`, … |
| `remote_policy[]` | Workplace type | `fully_remote`, `partially_remote`, `no_remote` |
| `japanese_requirement[]` | Japanese level needed | `none`, `basic`, `conversational`, `business`, `fluent` |
| `english_requirement[]` | English level needed (filter-only — never shown as a tag on the listing) | `none`, `basic`, `conversational`, `business`, `fluent` |
| `applicant_location[]` | Who can apply | `apply_from_abroad`, `japan_residents_only` |
| `seniority[]` | Level (filter-only — never shown as a tag on the listing; only visible baked into some job titles) | `intern`, `junior`, `intermediate`, `senior` |
| `salary` | Minimum salary floor, JPY/year (single value, not an array) | `4000000`, `6000000`, `8000000`, `10000000` |
| `page` | **Not honored by the server** — see Pagination below | n/a |

Category browsing also works as a path prefix, e.g. `GET /jobs/go` — this is
equivalent to `GET /jobs?programming_language[]=go` in effect (both are real,
tag-filtered views), but the CLI always uses the query-string form on `/jobs`
since it composes cleanly with the other filters.

### Response structure

The results section header contains the total count as plain text:
`"154 positions available"` (or singular `"1 position available"`, or `"0
positions available"` for no matches) — matched with `/(\d+)\s+positions?\s+available/i`.

Jobs are grouped **by company**, not listed flat:

```html
<li id="{company_id}">
  ...
  <h3 class="text-lg font-bold"><a href="/companies/{company-slug}">{Company Name}</a></h3>
  <p>{company tagline}</p>
  <div data-controller="collapsable-list">
    <div data-collapsable-list-target="item">
      <a class="font-bold" href="/companies/{company-slug}/jobs/{job-slug}">{Job Title}</a>
      <div class="flex gap-2 flex-wrap font-sm">
        <a class="tag tag-primary" href="/jobs/salary-data">¥7M ~ ¥12M</a>        <!-- optional -->
        <a class="tag" href="/jobs/{japanese-required|no-japanese-required}">{text}</a>  <!-- optional -->
        <a class="tag" href="/jobs/{apply-from-abroad|residents-only}">{text}</a>         <!-- optional -->
        <a class="tag" href="/jobs/{fully-remote|partially-remote|no-remote}">{text}</a>  <!-- optional -->
        <a class="tag" href="/jobs/{category-or-language-slug}">{text}</a>...              <!-- 0+ -->
      </div>
    </div>
    <!-- more .../item blocks for this company's other open roles -->
  </div>
</li>
```

The client-side "show more" truncation (`data-collapsable-list-truncate-value="2"`)
is CSS/JS-only — all of a company's job entries are present in the raw HTML
response, so nothing is missed by parsing the full page.

The CLI (`parseJobCards` in `helpers.ts`) splits the page on `<li id="\d+">` to
get per-company blocks, then splits each block on
`data-collapsable-list-target="item"` to get per-job chunks, parsing each
chunk independently so one malformed entry can't break the rest.

**No date or per-job location field exists in the listing markup at all** —
neither field is rendered anywhere on `/jobs`. Both are `null` on `search`
results; both are recoverable from `detail` (see below).

### Pagination

`GET /jobs?page=2` returns **byte-identical** content to `GET /jobs` (verified
2026-07-22 across both the unfiltered `/jobs` listing, at 154 postings, and the
narrower `/jobs/go` listing) — the `page` param is silently ignored server-side.
TokyoDev renders every matching job in a single response. The CLI therefore
implements `--page` as a client-side slice over the full parsed result set
(`CLIENT_PAGE_SIZE = 20` in `commands/search.ts`), which is an arbitrary but
reasonable page size chosen by this CLI, not a value TokyoDev itself uses.

## Detail

```
GET https://www.tokyodev.com/companies/{company-slug}/jobs/{job-slug}
```

Returns HTTP 404 for a nonexistent company/job slug pair (verified) — treat as
not-found, no redirect games to worry about.

Every detail page embeds exactly one JSON-LD block:

```html
<script type="application/ld+json">{"@context":"https://schema.org/","@type":"JobPosting", ...}</script>
```

Notable `JobPosting` fields (parsed directly — no HTML scraping needed for detail):
- `title`, `description` (raw HTML — strip tags, decode entities, keep paragraph breaks)
- `datePosted` — full ISO-8601 datetime, e.g. `"2026-01-06T14:25:45.639+09:00"`
- `hiringOrganization.name`
- `jobLocation.address` — `addressLocality`, `addressRegion`, `addressCountry` (e.g. Minato-ku / Tokyo / JP)
- `employmentType` — schema.org enum, e.g. `FULL_TIME`, `INTERN` (prettified by the CLI to "Full Time", "Intern")
- `baseSalary.currency` + `baseSalary.value.{minValue,maxValue,unitText}` — **the whole `baseSalary` key is absent (not `null`) when a posting has no salary data**, e.g. HENNGE's internship posting

### Apply link — intentionally not resolved

The visible "APPLY FOR THIS POSITION" button on the detail page opens a modal
whose real link is `/c/{company-slug}/j/{job-slug}/applications/new` — TokyoDev's
own tracked-click redirect to the actual external ATS. **`/c/` is disallowed by
robots.txt.** The CLI does not construct, follow, or otherwise touch this path;
`detail.applyUrl` is always `null`, and the CLI points users back at the
canonical job page instead.

## Access notes

- `robots.txt` (checked 2026-07-22): `User-agent: *` → `Allow: /`, disallowing
  only `/c/`, `/frames/`, `/ja/frames/`; a separate block for `Amazonbot`
  specifically. `/jobs`, `/jobs/{category}`, and
  `/companies/.../jobs/...` are all Allowed.
- No login/authentication required for search or detail pages.
- No `/terms`, `/terms-of-service`, or `/terms-of-use` page was found (all
  404); only `/privacy-policy` exists. No scraping restriction was found
  beyond the robots.txt disallows above.
- No official developer API found — this is the site's own server-rendered
  markup (for search) plus its embedded schema.org structured data (for
  detail). If parsing breaks, re-fetch `/jobs` and a `/companies/.../jobs/...`
  page and re-inspect the markup / JSON-LD shape.
