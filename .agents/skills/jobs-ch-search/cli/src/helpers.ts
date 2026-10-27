// Data source: jobs.ch is a React app (server-rendered). Search results
// (`/en/vacancies/`) are plain server-rendered HTML — the only JSON-LD on that
// page is a `BreadcrumbList`, not per-job data — so job cards are parsed
// directly from the HTML (`parseJobCards`, chunk-per-card, same approach as
// tokyodev-search/linkedin-search's parseJobCards). Job detail pages
// (`/en/vacancies/detail/<uuid>/`), by contrast, DO embed a real schema.org
// `JobPosting` as JSON-LD — that's parsed directly instead of scraping the
// rendered detail page.
//
// No authentication required for search or detail pages (verified 2026-07-22).
// robots.txt disallows `/en/vacancies/detail/*/*/*` — but the real detail URL
// (`/en/vacancies/detail/<uuid>/`) has only one trailing slash after the uuid,
// while that pattern requires two literal `/` separators after `detail/` to
// match (confirmed by regex-equivalent analysis: the disallow compiles to
// `^/en/vacancies/detail/.*/.*/.*`, which needs 2 literal slashes beyond the
// prefix; the real URL supplies only 1). So real detail pages are NOT
// disallowed. Verified independently, not just trusted from the brief.

export const BASE_URL = "https://www.jobs.ch"

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

/** Decode HTML entities + strip stray tags from a single listing-page text fragment. */
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
  workload: string | null
  contractType: string | null
}

export interface JobDetail extends JobCard {
  description: string | null
  employmentType: string | null
  workHours: string | null
  industry: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  applyUrl: string | null
}

export function detailUrl(id: string): string {
  return `${BASE_URL}/en/vacancies/detail/${id}/`
}

/**
 * Parse the `/en/vacancies/` search-results HTML into job cards.
 *
 * Each result is a `<div data-cy="serp-item">` block. We split the page on
 * that marker and parse each chunk independently so one malformed card can't
 * break the rest (same pattern as tokyodev-search/linkedin-search).
 *
 * Verified live 2026-07-22 across 22 real result cards (`term=golang`): every
 * card carries, in this fixed order, three labelled key/value rows ("Place of
 * work", "Workload", "Contract type") followed by a company-name `<p>` with a
 * distinguishing `c_gray.700 fw_bold` class (right after the avatar `<picture>`).
 */
export function parseJobCards(html: string): JobCard[] {
  const results: JobCard[] = []
  const chunks = html.split('data-cy="serp-item"').slice(1)

  for (const chunk of chunks) {
    const linkMatch = chunk.match(
      /data-cy="job-link"\s+id="vacancy-link-([0-9a-fA-F-]+)"[^>]*title="([^"]*)"[^>]*href="([^"]*)"/,
    )
    if (!linkMatch) continue
    const [, id, rawTitle, href] = linkMatch
    const title = clean(rawTitle)
    if (!title) continue

    const dateMatch = chunk.match(
      /<p class="mb_s0 textStyle_caption1 max-w_\[min-content\] white-space_nowrap">([^<]*)<\/p>/,
    )

    const kv: Record<string, string> = {}
    for (const m of chunk.matchAll(/<span[^>]*>([A-Za-z ]+)<!-- -->:<\/span><p[^>]*>([^<]*)<\/p>/g)) {
      kv[m[1].trim()] = clean(m[2])
    }

    const companyMatch = chunk.match(
      /class="mb_s12 lastOfType:mb_s0 textStyle_caption1 c_gray\.700 fw_bold">([^<]*)<\/p>/,
    )

    results.push({
      id,
      title,
      company: companyMatch ? clean(companyMatch[1]) || null : null,
      location: kv["Place of work"] || null,
      date: dateMatch ? clean(dateMatch[1]) || null : null,
      url: href.startsWith("http") ? href : `${BASE_URL}${href}`,
      workload: kv["Workload"] || null,
      contractType: kv["Contract type"] || null,
    })
  }

  return results
}

/**
 * Total matching count from the results-summary span, e.g. `"257 jobs"`.
 * Scoped to the specific `c_gray.700 textStyle_caption1` span that carries it —
 * a bare `/\d+ jobs?/` regex is NOT safe here: a nonsense query string
 * containing digits can produce an unrelated false-positive match elsewhere
 * on the page (verified 2026-07-22 with an adversarial query).
 */
export function parseTotalCount(html: string): number {
  const m = html.match(/<span class="c_gray\.700 textStyle_caption1">([0-9,]+) jobs?<\/span>/)
  return m ? parseInt(m[1].replace(/,/g, ""), 10) : 0
}

/** A schema.org JobPosting, as embedded in every detail page's JSON-LD script. */
interface RawJobPosting {
  title?: string
  description?: string
  datePosted?: string
  hiringOrganization?: { name?: string }
  jobLocation?: {
    address?: {
      streetAddress?: string
      addressRegion?: string
      postalCode?: string
      addressCountry?: string
    }
  }
  employmentType?: string // already human-readable on jobs.ch, e.g. "Permanent position" (not a schema.org enum)
  workHours?: string
  industry?: string
  baseSalary?: {
    currency?: string
    value?: { minValue?: number; maxValue?: number; unitText?: string }
  }
  potentialAction?: { target?: { urlTemplate?: string } }
}

/**
 * Find the schema.org `JobPosting` block among a detail page's `application/ld+json`
 * scripts. Every detail page has (at least) two such scripts: a `BreadcrumbList`
 * first, then the `JobPosting` — so we scan all of them rather than assuming order.
 */
export function extractJobPostingJsonLd(html: string): RawJobPosting | null {
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1])
      if (parsed && parsed["@type"] === "JobPosting") return parsed
    } catch {
      // malformed blob — skip and keep scanning for another script tag
    }
  }
  return null
}

/** Build a JobDetail from a detail page's parsed JobPosting JSON-LD. */
export function jobPostingToDetail(posting: RawJobPosting, id: string): JobDetail {
  const addr = posting.jobLocation?.address
  const location = addr
    ? [addr.streetAddress, [addr.postalCode, addr.addressRegion].filter(Boolean).join(" "), addr.addressCountry]
        .filter(Boolean)
        .join(", ") || null
    : null

  const salaryValue = posting.baseSalary?.value
  const hasSalary =
    !!salaryValue && (typeof salaryValue.minValue === "number" || typeof salaryValue.maxValue === "number")

  return {
    id,
    title: posting.title || "(untitled)",
    company: posting.hiringOrganization?.name || null,
    location,
    date: posting.datePosted || null,
    url: detailUrl(id),
    // Swiss postings almost never publish an explicit workload % (verified across
    // 4 real detail pages) — workHours (e.g. "33.6 - 42 hours/week") is the closest
    // real equivalent, but it's a distinct concept from the listing's "Workload"
    // percentage, so we leave workload null here rather than conflating them.
    workload: null,
    contractType: posting.employmentType || null,
    description: cleanDescription(posting.description || ""),
    employmentType: posting.employmentType || null,
    workHours: posting.workHours || null,
    industry: posting.industry || null,
    salaryMin: hasSalary && typeof salaryValue!.minValue === "number" ? salaryValue!.minValue : null,
    salaryMax: hasSalary && typeof salaryValue!.maxValue === "number" ? salaryValue!.maxValue : null,
    salaryCurrency: hasSalary ? posting.baseSalary?.currency || null : null,
    applyUrl: posting.potentialAction?.target?.urlTemplate || null,
  }
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/** Accept a bare job uuid or a full jobs.ch `/vacancies/detail/<uuid>/` URL (any locale). */
export function normalizeJobId(input: string): string | null {
  const trimmed = input.trim()
  if (UUID_RE.test(trimmed)) return trimmed.toLowerCase()
  const m = trimmed.match(/\/(?:vacancies|stellenangebote|offres-emplois)\/detail\/([0-9a-fA-F-]{36})/)
  if (m && UUID_RE.test(m[1])) return m[1].toLowerCase()
  return null
}

/**
 * Parse jobs.ch's relative "posted" strings into an approximate days-ago count.
 * No server-side "posted within N days" filter was found (several candidate
 * param names were tried live and none changed the result count) — this
 * powers a client-side `--jobage` filter instead, applied to whichever page of
 * results was fetched. Returns null for unrecognized formats (e.g. a future
 * jobs.ch phrasing this CLI hasn't seen) so callers can treat unknown ages as
 * non-excluding rather than silently dropping them.
 */
export function parseRelativeAge(text: string | null): number | null {
  if (!text) return null
  const t = text.trim().toLowerCase()
  if (t === "today") return 0
  if (t === "yesterday") return 1
  if (t === "last week") return 7
  let m = t.match(/^(\d+)\s+hours?\s+ago$/)
  if (m) return 0
  m = t.match(/^(\d+)\s+days?\s+ago$/)
  if (m) return parseInt(m[1], 10)
  m = t.match(/^(\d+)\s+weeks?\s+ago$/)
  if (m) return parseInt(m[1], 10) * 7
  m = t.match(/^(\d+)\s+months?\s+ago$/)
  if (m) return parseInt(m[1], 10) * 30
  return null
}

/** Client-side `--jobage` filter: keep cards posted within `days`. Unknown ages are kept (not excluded). */
export function matchesJobage(dateText: string | null, days: number | undefined): boolean {
  if (!days || days <= 0) return true
  const age = parseRelativeAge(dateText)
  return age === null || age <= days
}
