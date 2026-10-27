// Data source: jobup.ch, a major Swiss job board (JobCloud group — same publisher
// as jobs.ch, but a distinct site/listing set with its own markup).
//
// Contrary to the initial assumption behind this skill (that jobup.ch's search
// page only embeds a breadcrumb JSON-LD block, no per-job structured data),
// verified live 2026-07-22: the `/en/jobs/` listing page embeds a full
// schema.org `ItemList` of `JobPosting` objects — one full JSON-LD block per
// card, not just a breadcrumb. That JSON-LD is the primary parse source for
// `search` (title, id, company, employmentType, datePosted, url) because it's
// valid JSON, not regex-over-Tailwind soup. The one gap: the listing's
// `jobLocation.address` sometimes omits `addressLocality` even when the
// rendered HTML card clearly shows a city (e.g. "Acacias") — so `location` is
// filled from the HTML card's "Place of work" text first, falling back to the
// JSON-LD address only if the HTML card lacks it.
//
// The detail page (`/en/jobs/detail/{id}/`) embeds its own richer `JobPosting`
// JSON-LD (full description, workHours, baseSalary, full postal address) as a
// second `<script type="application/ld+json">` block (the first is a
// `BreadcrumbList`) — parsed directly, same "prefer structured data" rule.
//
// No authentication required. robots.txt (checked 2026-07-22) disallows
// `/api/`, `/api_proxy/`, `/external/`, `/en|de|fr/application/*` (the
// application-flow pages), `/en|de|fr/login|auth|register/`, and some
// enterprise/group pages — none of which this CLI touches. `/en/jobs/` and
// `/en/jobs/detail/...` are both Allowed. No Cloudflare bot-management
// challenge was encountered (unlike tokyodev.com) — Bun's native `fetch()`
// with a browser User-Agent works fine, no `curl` subprocess needed.

export const BASE_URL = "https://www.jobup.ch"

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
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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
export function cleanDescription(html: string | null | undefined): string | null {
  if (!html) return null
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
  const text = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
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
  employmentType: string | null
  workload: string | null
  salary: string | null
}

export interface JobDetail extends JobCard {
  description: string | null
  workHours: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  applyUrl: string | null
}

const ID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export function detailUrl(id: string): string {
  return `${BASE_URL}/en/jobs/detail/${id}/`
}

/** Accept a bare jobup job UUID, or a full jobup `/en/jobs/detail/{uuid}/` URL. */
export function normalizeJobId(input: string): string | null {
  const trimmed = input.trim()
  const urlMatch = trimmed.match(/\/jobs\/detail\/([0-9a-fA-F-]{36})/)
  if (urlMatch) return urlMatch[1]
  return ID_RE.test(trimmed) ? trimmed : null
}

/**
 * Parse every `<script type="application/ld+json">` block on the page. Each
 * block may itself contain a single object or an array of objects (jobup.ch
 * does both, on different pages) — this flattens to one array of nodes.
 * Malformed JSON in one block is skipped rather than aborting the whole parse.
 */
function parseAllJsonLd(html: string): any[] {
  const nodes: any[] = []
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1])
      if (Array.isArray(data)) nodes.push(...data)
      else nodes.push(data)
    } catch {
      // skip malformed block, keep parsing the rest
    }
  }
  return nodes
}

interface RawAddress {
  streetAddress?: string
  addressLocality?: string
  addressRegion?: string
  postalCode?: string
  addressCountry?: string
}

interface RawJobPosting {
  title?: string
  description?: string
  identifier?: { value?: string }
  datePosted?: string
  employmentType?: string
  workHours?: string
  hiringOrganization?: { name?: string }
  jobLocation?: { address?: RawAddress }
  baseSalary?: { currency?: string; value?: { minValue?: number; maxValue?: number } }
  url?: string
}

function formatLocation(addr: RawAddress | null | undefined): string | null {
  if (!addr) return null
  const parts: string[] = []
  if (addr.addressLocality) parts.push(addr.addressLocality)
  if (addr.addressRegion && addr.addressRegion !== addr.addressLocality) parts.push(addr.addressRegion)
  if (parts.length === 0 && addr.addressCountry) {
    parts.push(addr.addressCountry === "CH" ? "Switzerland" : addr.addressCountry)
  }
  return parts.length ? parts.join(", ") : null
}

/**
 * Extract per-card `location` and `workload` straight from the rendered HTML,
 * keyed by job id. The listing's JSON-LD `jobLocation.address` sometimes omits
 * `addressLocality` even when the visible card clearly shows a city (verified
 * live 2026-07-22, e.g. "Acacias") — the HTML card is the more reliable source
 * for these two fields. Splits on each card's unique
 * `data-cy="serp-item-{uuid}"` marker so one malformed card can't break the rest.
 */
function parseCardExtras(html: string): Map<string, { location: string | null; workload: string | null }> {
  const map = new Map<string, { location: string | null; workload: string | null }>()
  const chunks = html.split('data-cy="serp-item-').slice(1)
  for (const chunk of chunks) {
    const idMatch = chunk.match(/^([0-9a-fA-F-]{36})"/)
    if (!idMatch) continue
    const locMatch = chunk.match(/Place of work<!--\s*-->:<\/span>\s*<p[^>]*>([^<]*)<\/p>/)
    const workloadMatch = chunk.match(/Workload<!--\s*-->:<\/span>\s*<p[^>]*>([^<]*)<\/p>/)
    map.set(idMatch[1], {
      location: locMatch ? clean(locMatch[1]) || null : null,
      workload: workloadMatch ? clean(workloadMatch[1]) || null : null,
    })
  }
  return map
}

function cardFromPosting(
  posting: RawJobPosting,
  extras: Map<string, { location: string | null; workload: string | null }>,
): JobCard | null {
  const idFromUrl = posting.url?.match(/\/jobs\/detail\/([0-9a-fA-F-]{36})/)?.[1]
  const id = posting.identifier?.value || idFromUrl || null
  if (!id) return null
  const extra = extras.get(id)

  return {
    id,
    title: clean(posting.title || "") || "(untitled)",
    company: posting.hiringOrganization?.name || null,
    location: extra?.location || formatLocation(posting.jobLocation?.address) || null,
    date: posting.datePosted || null,
    url: posting.url || detailUrl(id),
    employmentType: posting.employmentType || null,
    workload: extra?.workload || null,
    salary: null, // jobup.ch never shows salary on the listing page (verified) — only rarely on detail
  }
}

/** Parse the `/en/jobs/` search-results page: JSON-LD `ItemList` of `JobPosting`s, enriched with HTML card location/workload. */
export function parseJobCards(html: string): JobCard[] {
  const nodes = parseAllJsonLd(html)
  const itemList = nodes.find((n) => n && n["@type"] === "ItemList")
  if (!itemList || !Array.isArray(itemList.itemListElement)) return []

  const extras = parseCardExtras(html)
  const cards: JobCard[] = []
  for (const li of itemList.itemListElement) {
    const posting = li?.item
    if (!posting || posting["@type"] !== "JobPosting") continue
    const card = cardFromPosting(posting, extras)
    if (card) cards.push(card)
  }
  return cards
}

/** Total matching count from the `<title>` tag, e.g. "66 Golang job ads found on jobup.ch" or "0 Golang job ads in Zurich found...". */
export function parseTotalCount(html: string): number {
  const m = html.match(/<title>\s*(\d+)\s/)
  return m ? parseInt(m[1], 10) : 0
}

/** Extract the detail page's `JobPosting` JSON-LD (the second `<script>` block — the first is a `BreadcrumbList`). */
export function extractJobPosting(html: string): RawJobPosting | null {
  const nodes = parseAllJsonLd(html)
  return nodes.find((n) => n && n["@type"] === "JobPosting") || null
}

/** Build a JobDetail from a detail page's parsed JobPosting JSON-LD. */
export function jobPostingToDetail(posting: RawJobPosting, id: string): JobDetail {
  const salaryValue = posting.baseSalary?.value
  const salaryMin = typeof salaryValue?.minValue === "number" ? salaryValue.minValue : null
  const salaryMax = typeof salaryValue?.maxValue === "number" ? salaryValue.maxValue : null

  return {
    id,
    title: clean(posting.title || "") || "(untitled)",
    company: posting.hiringOrganization?.name || null,
    location: formatLocation(posting.jobLocation?.address),
    date: posting.datePosted || null,
    url: posting.url || detailUrl(id),
    employmentType: posting.employmentType || null,
    workload: null, // detail's JSON-LD exposes workHours (hours/week), not the search card's workload %
    salary: null,
    description: cleanDescription(posting.description),
    workHours: posting.workHours || null,
    salaryMin,
    salaryMax,
    salaryCurrency: (salaryMin != null || salaryMax != null) ? posting.baseSalary?.currency || null : null,
    // No apply link is present in the rendered HTML at all (client-JS only), and
    // robots.txt disallows /en/application/* (the application-flow pages) — so
    // we point back at the canonical jobup.ch detail URL instead of guessing.
    applyUrl: null,
  }
}
