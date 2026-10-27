// Data source: hiringcafe.com's own Next.js pages. There is no separate JSON API —
// the server renders search results and job postings into a <script id="__NEXT_DATA__">
// blob on every page load, which we parse directly (no HTML scraping needed).
//
// Personal use only — see SKILL.md for the robots.txt note on the searchState pattern.

export const BASE_URL = "https://hiringcafe.com"

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

/** Extract and parse the Next.js `__NEXT_DATA__` JSON blob embedded in every page. */
export function extractNextData(html: string): any | null {
  const m = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  )
  if (!m) return null
  try {
    return JSON.parse(m[1])
  } catch {
    return null
  }
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
}

export interface JobDetail extends JobCard {
  description: string | null
  employmentType: string | null
  seniority: string | null
  workplaceType: string | null
  applyUrl: string | null
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

/** Strip the rich-text job description HTML down to readable plain text, keeping paragraph breaks. */
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

/** A search hit as returned in `pageProps.ssrHits`. Only the fields we use are typed. */
interface RawHit {
  requisition_id: string
  apply_url: string
  job_information?: { title?: string; description?: string }
  v5_processed_job_data?: {
    company_name?: string
    formatted_workplace_location?: string
    workplace_type?: string
    estimated_publish_date?: string
    commitment?: string[]
    seniority_level?: string
  }
  enriched_company_data?: { name?: string }
}

function detailUrl(requisitionId: string): string {
  return `${BASE_URL}/job/job-${requisitionId}`
}

export function hitToJobCard(hit: RawHit): JobCard {
  const jobData = hit.v5_processed_job_data || {}
  return {
    id: hit.requisition_id,
    title: hit.job_information?.title || "(untitled)",
    company: jobData.company_name || hit.enriched_company_data?.name || null,
    location: jobData.formatted_workplace_location || jobData.workplace_type || null,
    date: jobData.estimated_publish_date || null,
    url: detailUrl(hit.requisition_id),
  }
}

/** Parse the search page's NEXT_DATA into job cards + pagination meta. */
export function parseSearchResults(
  nextData: any,
): { count: number; page: number; results: JobCard[] } {
  const pp = nextData?.props?.pageProps || {}
  const hits: RawHit[] = pp.ssrHits || []
  return {
    count: typeof pp.ssrTotalCount === "number" ? pp.ssrTotalCount : hits.length,
    page: typeof pp.ssrPage === "number" ? pp.ssrPage : 0,
    results: hits.map(hitToJobCard),
  }
}

/** Parse a job detail page's NEXT_DATA (`pageProps.job`) into a JobDetail, or null if absent. */
export function parseJobDetail(nextData: any): JobDetail | null {
  const job: RawHit | undefined = nextData?.props?.pageProps?.job
  if (!job) return null
  const card = hitToJobCard(job)
  const jobData = job.v5_processed_job_data || {}
  return {
    ...card,
    description: cleanDescription(job.job_information?.description || ""),
    employmentType: jobData.commitment?.[0] || null,
    seniority: jobData.seniority_level || null,
    workplaceType: jobData.workplace_type || null,
    applyUrl: job.apply_url || null,
  }
}

/**
 * hiringcafe's `dateFetchedPastNDays` field is not a literal day count — it's an
 * opaque bucket ID from a fixed enum (values found by inspecting the site's own
 * client bundle). Any value outside this enum is silently dropped by the server,
 * which removes the date filter entirely rather than erroring. -1 is the site's
 * own "unbounded" sentinel (used when it wants to explicitly clear the filter).
 */
const DATE_BUCKETS: { realDays: number; value: number }[] = [
  { realDays: 1, value: 2 }, // "Past 24 hours"
  { realDays: 3, value: 4 }, // "3 days"
  { realDays: 7, value: 14 }, // "1 week"
  { realDays: 14, value: 21 }, // "2 weeks"
  { realDays: 21, value: 29 }, // "3 weeks"
  { realDays: 30, value: 61 }, // "1 month"
  { realDays: 60, value: 91 }, // "2 months"
  { realDays: 90, value: 121 }, // "3 months"
  { realDays: 120, value: 151 }, // "4 months"
  { realDays: 150, value: 181 }, // "5 months"
  { realDays: 180, value: 211 }, // "6 months"
  { realDays: 365, value: 750 }, // "1 year"
  { realDays: 730, value: 1080 }, // "2 years"
  { realDays: 1095, value: 1440 }, // "3 years"
]

/** Map a requested "posted within N days" to hiringcafe's nearest bucket, or -1 (unbounded). */
export function jobageToDateBucket(days: number | undefined): number {
  if (!days || days <= 0 || days > 1095) return -1
  const bucket = DATE_BUCKETS.find((b) => b.realDays >= days)
  return bucket ? bucket.value : -1
}

/** hiringcafe's workplaceTypes filter values, as seen on job records. */
export function workplaceTypeValue(mode: string | undefined): string | null {
  switch ((mode || "").toLowerCase()) {
    case "remote":
      return "Remote"
    case "hybrid":
      return "Hybrid"
    case "onsite":
    case "on-site":
      return "Onsite"
    default:
      return null
  }
}

/** Accept a bare requisition_id or a hiringcafe /job/... URL and extract the requisition_id. */
export function normalizeJobId(input: string): string | null {
  const trimmed = input.trim()
  if (/^[a-zA-Z0-9]{6,}$/.test(trimmed)) return trimmed
  const lastSegment = trimmed.split("/").filter(Boolean).pop() || ""
  const parts = lastSegment.split("-")
  const candidate = parts[parts.length - 1]
  return candidate && /^[a-zA-Z0-9]{6,}$/.test(candidate) ? candidate : null
}
