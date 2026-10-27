// Data source: jobscout24.ch, an ASP.NET-rendered Swiss job board (Azure-hosted).
// Search results (`/en/jobs/`) are plain server-rendered HTML; job detail pages
// additionally embed a schema.org `JobPosting` (alongside a `BreadcrumbList`) as
// a JSON array inside one `application/ld+json` script tag, which we parse
// directly for `detail` instead of scraping the rendered HTML.
//
// IMPORTANT (found 2026-07-22, corrects the initial `?term=` guess): the site's
// on-page `<form id="SearchForm">` posts to `/en/jobs/search/` and carries an
// `__RequestVerificationToken`, which looked like it might require a POST +
// anti-forgery token. It doesn't for reads — a plain `GET /en/jobs/?SearchWhat=<query>`
// (note: the *listing* path `/en/jobs/`, not the form's POST-only `/en/jobs/search/`
// action) returns real, correct results with no token or cookie needed (verified:
// `?SearchWhat=golang` returns "Golang jobs - 4 vacancies", with real per-title
// matches, not generic category nav). Location filtering, however, is NOT a query
// param: `?SearchWhere=Zurich` has zero effect (verified byte-identical result set
// to the unfiltered query) — the real location filter is a path segment,
// `/en/jobs-in-{city-slug}/`, combinable with `?SearchWhat=`.
//
// No authentication required for search or detail pages. robots.txt (checked
// 2026-07-22) disallows `/app/`, `/aspnet_client/`, `/careers/`, `/companies/`,
// `/{de,en,fr}/{account,apply,cookies,customer}/`, `/exportfeed/`, `/JS24Web/`
// (+ lowercase), `/statistics/` — none of which this CLI touches (`/en/jobs/`,
// `/en/jobs-in-*/`, and `/en/job/{id}/` are all Allowed).

export const BASE_URL = "https://www.jobscout24.ch"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. Follows redirects. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return ""
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
  }
  throw new Error("Request failed after max retries")
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function clean(html: string): string {
  return decodeHtmlEntities(stripTags(html))
}

/** Strip rich-text HTML (job descriptions) down to readable plain text, keeping paragraph breaks. */
export function cleanDescription(html: string): string | null {
  if (!html) return null
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
  const text = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text || null
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  workload: string | null // e.g. "80% - 100%" — a Swiss job-board convention, not in the JSON-LD
}

export interface JobDetail extends JobCard {
  description: string | null
  employmentType: string | null
  industry: string | null
  occupationalCategory: string | null
  applyUrl: string | null
}

export function detailUrl(id: string): string {
  return `${BASE_URL}/en/job/${id}/`
}

/** Strip diacritics and hyphenate for the `/en/jobs-in-{slug}/` location path segment. */
export function slugifyLocation(location: string): string {
  return location
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Build the `/en/jobs/` (or `/en/jobs-in-{city}/`) search URL. `SearchWhat` is the
 * verified working GET query param; `p` (1-indexed) is the verified pagination param
 * (`/en/jobs/?SearchWhat=developer&p=2` — seen in the site's own "Next" link).
 */
export function buildSearchUrl(query: string | undefined, location: string | undefined, page: number): string {
  const base = location ? `${BASE_URL}/en/jobs-in-${slugifyLocation(location)}/` : `${BASE_URL}/en/jobs/`
  const params = new URLSearchParams()
  if (query) params.set("SearchWhat", query)
  if (page > 1) params.set("p", String(page))
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

/** Total matching count, from the listing's `data-total-job-count` attribute (falls back to the `<title>`'s "N vacancies"). */
export function parseTotalCount(html: string): number {
  let m = html.match(/data-total-job-count="(\d+)"/)
  if (m) return parseInt(m[1], 10)
  m = html.match(/(\d+)\s+vacanc(?:y|ies)/i)
  return m ? parseInt(m[1], 10) : 0
}

/**
 * Parse the `/en/jobs/` search-results HTML into job cards.
 *
 * Each result is an `<li class="job-list-item ...">` (plain postings and
 * externally-aggregated "Further jobs from the web" entries alike — the latter
 * just carry an extra `webjob` class, and their `/en/job/{id}/` detail pages work
 * identically). We split the page on that opening tag and parse each chunk
 * independently so one malformed entry can't break the rest (same approach as
 * linkedin-search's/tokyodev's `parseJobCards`).
 */
export function parseJobCards(html: string): JobCard[] {
  const results: JobCard[] = []
  const chunks = html.split(/<li class="job-list-item[^"]*"/).slice(1)

  for (const chunk of chunks) {
    const linkMatch = chunk.match(
      /<a\s+href="([^"]+)"[^>]*class="job-link-detail job-title"[\s\S]*?>([\s\S]*?)<\/a>/,
    )
    if (!linkMatch) continue
    const [, href, rawTitle] = linkMatch
    const title = clean(rawTitle)
    if (!title) continue

    const idMatch = href.match(/\/en\/job\/([^/]+)\/?/)
    const id = idMatch ? idMatch[1] : href

    const attrMatch = chunk.match(
      /<p class="job-attributes">\s*<span>([\s\S]*?)<\/span>\s*,[\s\S]*?<span>([\s\S]*?)<\/span>/,
    )
    const company = attrMatch ? clean(attrMatch[1]) || null : null
    const location = attrMatch ? clean(attrMatch[2]) || null : null

    const dateMatch = chunk.match(/<p class="job-date">\s*([^<]*?)\s*<\/p>/)
    const date = dateMatch ? clean(dateMatch[1]) || null : null

    const workloadMatch = chunk.match(/<span class="tag tag-readonly">(\d+%[^<]*)<\/span>/)
    const workload = workloadMatch ? clean(workloadMatch[1]) || null : null

    results.push({
      id,
      title,
      company,
      location,
      date,
      url: href.startsWith("http") ? href : `${BASE_URL}${href}`,
      workload,
    })
  }

  return results
}

/** A schema.org JobPosting, as embedded in every detail page's JSON-LD script (alongside a BreadcrumbList in the same array). */
interface RawJobPosting {
  title?: string
  description?: string
  datePosted?: string
  hiringOrganization?: { name?: string }
  jobLocation?: {
    address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string }
  }
  employmentType?: string | string[]
  industry?: string
  occupationalCategory?: string
}

/**
 * Find the schema.org JobPosting block among a detail page's `application/ld+json`
 * scripts. jobscout24 embeds it as one element of a JSON *array* (the other being a
 * BreadcrumbList) inside a single script tag that also carries a CSP `nonce`
 * attribute — so the tag-matching regex allows arbitrary attributes, not just the
 * bare `type="application/ld+json"` tokyodev/japan-dev use.
 */
export function extractJobPosting(html: string): RawJobPosting | null {
  const re = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1])
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of items) {
        if (item && item["@type"] === "JobPosting") return item
      }
    } catch {
      // malformed blob — skip and keep scanning for another script tag
    }
  }
  return null
}

function prettyEmploymentType(raw: string | string[] | undefined): string | null {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : []
  if (!values.length) return null
  return values
    .map((v) =>
      v
        .toLowerCase()
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    )
    .join(", ")
}

/** Build a JobDetail from a detail page's parsed JobPosting JSON-LD. */
export function jobPostingToDetail(posting: RawJobPosting, id: string): JobDetail {
  const addr = posting.jobLocation?.address
  const location = addr
    ? [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean).join(", ") ||
      null
    : null

  return {
    id,
    title: posting.title || "(untitled)",
    company: posting.hiringOrganization?.name || null,
    location,
    date: posting.datePosted || null,
    url: detailUrl(id),
    workload: null, // only shown as a listing tag ("80% - 100%"), not present in the JSON-LD
    description: cleanDescription(posting.description || ""),
    employmentType: prettyEmploymentType(posting.employmentType),
    industry: posting.industry || null,
    occupationalCategory: posting.occupationalCategory || null,
    // The real "Apply online" button redirects through `/en/job/{title-slug}/{numeric-id}/externalapply/`,
    // a tracked, session-dependent redirect to the actual external ATS/employer site (not a stable,
    // directly-fetchable URL — verified: guessing the path returns 404 without the exact session-scoped
    // redirect token the rendered page carries). So we don't construct or follow it; `applyUrl` stays
    // null and callers should use the canonical job page URL above to apply.
    applyUrl: null,
  }
}

/** Accept a bare job id (the UUID/slug segment from `/en/job/{id}/`) or a full jobscout24 job URL. */
export function normalizeJobId(input: string): string | null {
  const trimmed = input.trim()
  const urlMatch = trimmed.match(/\/en\/job\/([^/]+)\/?/)
  if (urlMatch) return urlMatch[1]
  if (/^[a-zA-Z0-9%._-]+$/.test(trimmed)) return trimmed
  return null
}

/**
 * Approximate age in days from the listing's relative date text ("New", "5 d", "2 w",
 * "1+m"). jobscout24 exposes no exact date or day-count filter on search results at
 * all (verified: the search form has no such field) — only this coarse relative label.
 * Returns null for unrecognized text so callers can choose not to filter it out.
 */
export function approxAgeDays(dateText: string | null): number | null {
  if (!dateText) return null
  const t = dateText.trim().toLowerCase()
  if (t === "new") return 0
  let m = t.match(/^(\d+)\s*d$/)
  if (m) return parseInt(m[1], 10)
  m = t.match(/^(\d+)\s*w$/)
  if (m) return parseInt(m[1], 10) * 7
  m = t.match(/^(\d+)\+?\s*m$/)
  if (m) return parseInt(m[1], 10) * 30
  return null
}

/** Client-side `--jobage` filter over the approximate relative date text (see `approxAgeDays`). */
export function matchesJobage(dateText: string | null, days: number | undefined): boolean {
  if (!days || days <= 0) return true
  const age = approxAgeDays(dateText)
  if (age === null) return true // unrecognized format — don't filter it out
  return age <= days
}
