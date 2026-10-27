// Data source: japan-dev.com is a Nuxt 3 app. Every page (the `/jobs` listing and
// each job's own detail page) embeds its live data server-side in a
// `<script id="__NUXT_DATA__">` payload — Nuxt's "devalue" flat-array format, where
// the top-level array is a pool of values and objects/arrays reference sibling pool
// slots by integer index instead of nesting values inline (so repeated sub-values,
// like a shared skill tag, are stored once and referenced many times).
//
// IMPORTANT (found 2026-07-22, corrected from an earlier version of this CLI): the
// page ALSO exposes a public, search-only Algolia key (application ID `8S3J8C7YSA`,
// index `Job_production`) that looks like the obvious integration point — but calling
// that endpoint directly returns a frozen snapshot stuck at Sep 2024, while the same
// page's own `__NUXT_DATA__` shows postings from today. Matching the site's exact
// request shape (hitsPerPage, page, facets) didn't change this, and no alternate
// index name was reachable with the same key — the direct Algolia endpoint is
// genuinely scoped to older/different data than what real visitors see. So this CLI
// parses `__NUXT_DATA__` instead of calling Algolia, which is what actually reflects
// the live site.
//
// Known limitation this creates: the `/jobs` page always renders the same "latest
// postings" set (~60 jobs) regardless of query-string parameters — `?query=`,
// `?page=`, etc. were all tried and none changed the embedded payload. True
// keyword/facet search only happens client-side after JS hydration (via the same
// Algolia widget that turned out to be stale), which a plain-HTTP CLI can't drive.
// So `search` fetches that fixed live set once and filters it client-side — this
// covers "what's currently posted," not a full historical archive.

export const BASE_URL = "https://japan-dev.com"

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

const NUXT_WRAPPER_TAGS = new Set(["ShallowReactive", "Reactive", "ShallowRef", "Ref"])
const MAX_DEREF_DEPTH = 12

/**
 * Resolve one slot of a Nuxt devalue pool, recursively dereferencing integer
 * indices into sibling pool slots. Plain arrays/objects have their values
 * replaced by the resolved value at that index; reactive wrapper tags
 * (`["ShallowReactive", idx]` etc.) are unwrapped to their inner value. `Set`/`Map`
 * wrappers are not unwrapped (not needed for job data, which never lives inside one).
 */
function derefSlot(pool: unknown[], index: number, depth: number): unknown {
  if (depth > MAX_DEREF_DEPTH) return null
  const v = pool[index]
  if (Array.isArray(v)) {
    if (v.length && typeof v[0] === "string" && NUXT_WRAPPER_TAGS.has(v[0])) {
      return typeof v[1] === "number" ? derefSlot(pool, v[1], depth + 1) : null
    }
    return v.map((ref) => (typeof ref === "number" ? derefSlot(pool, ref, depth + 1) : ref))
  }
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, ref] of Object.entries(v as Record<string, unknown>)) {
      out[k] = typeof ref === "number" ? derefSlot(pool, ref, depth + 1) : ref
    }
    return out
  }
  return v
}

/** Extract and JSON.parse the `__NUXT_DATA__` payload's flat pool array. */
function extractNuxtPool(html: string): unknown[] | null {
  const m = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) return null
  try {
    const pool = JSON.parse(m[1])
    return Array.isArray(pool) ? pool : null
  } catch {
    return null
  }
}

export interface LiveJob {
  id: string // "<company-slug>/<job-slug>", self-sufficient for `detail`
  slug: string
  title: string
  company: string | null
  companySlug: string | null
  location: string | null
  publishedAt: string | null
  jobPostDate: string | null
  applicationUrl: string | null
  salaryMin: number | null
  salaryMax: number | null
  hasSalaryData: boolean
  sponsorsVisas: string | null // sponsors_visas_yes|no|unknown
  remoteLevel: string | null // remote_level_*
  seniorityLevel: string | null // seniority_level_*
  employmentType: string | null // employment_type_* (raw enum)
  contractType: string | null // "Full-time" (already human-readable)
  englishLevel: string | null // already human-readable, e.g. "Not Required"
  japaneseLevel: string | null // already human-readable
  skillNames: string[]
}

function toLiveJob(raw: Record<string, unknown>): LiveJob | null {
  const title = raw.title
  const slug = raw.slug
  if (typeof title !== "string" || typeof slug !== "string") return null
  const company = raw.company as Record<string, unknown> | null | undefined
  const companySlug = (company?.slug as string) || null
  const companyName = (raw.company_name as string) || (company?.name as string) || null
  return {
    id: companySlug ? `${companySlug}/${slug}` : slug,
    slug,
    title,
    company: companyName,
    companySlug,
    location: (raw.location as string) || null,
    publishedAt: (raw.published_at as string) || null,
    jobPostDate: (raw.job_post_date as string) || null,
    applicationUrl: (raw.application_url as string) || null,
    salaryMin: typeof raw.salary_min === "number" ? raw.salary_min : null,
    salaryMax: typeof raw.salary_max === "number" ? raw.salary_max : null,
    hasSalaryData: raw.has_salary_data === true,
    sponsorsVisas: (raw.sponsors_visas as string) || null,
    remoteLevel: (raw.remote_level as string) || null,
    seniorityLevel: (raw.seniority_level as string) || null,
    employmentType: (raw.employment_type as string) || null,
    contractType: (raw.contract_type as string) || null,
    englishLevel: (raw.english_level as string) || null,
    japaneseLevel: (raw.japanese_level as string) || null,
    skillNames: Array.isArray(raw.skill_names) ? (raw.skill_names as string[]) : [],
  }
}

/**
 * Find and resolve every live job record embedded in a page's `__NUXT_DATA__`.
 * Job objects are identified by having `sponsors_visas` + `employment_type` +
 * `title` keys (a fingerprint unlikely to collide with anything else in the
 * payload). Each job's Algolia-style `_highlightResult`/`_snippetResult` mirror
 * copy has the exact same key set but wraps every value as `{value: ...}` instead
 * of a plain string — `toLiveJob` rejects those (title/slug won't be strings) so
 * they're naturally filtered out without special-casing.
 */
export function extractLiveJobs(html: string): LiveJob[] {
  const pool = extractNuxtPool(html)
  if (!pool) return []
  const jobs: LiveJob[] = []
  for (let i = 0; i < pool.length; i++) {
    const v = pool[i]
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      "sponsors_visas" in v &&
      "employment_type" in v &&
      "title" in v
    ) {
      const resolved = derefSlot(pool, i, 0) as Record<string, unknown>
      const job = toLiveJob(resolved)
      if (job) jobs.push(job)
    }
  }
  return jobs
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
  remoteLevel: string | null
  sponsorsVisa: string | null
  englishLevel: string | null
  japaneseLevel: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  skills: string[] | null
  applyUrl: string | null
}

export function detailUrl(companySlug: string, jobSlug: string): string {
  return `${BASE_URL}/jobs/${companySlug}/${jobSlug}`
}

export function liveJobToCard(job: LiveJob): JobCard {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    date: job.publishedAt || job.jobPostDate,
    url: job.companySlug ? detailUrl(job.companySlug, job.slug) : `${BASE_URL}/jobs`,
  }
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

/** A schema.org JobPosting, as embedded in every detail page's JSON-LD script. */
interface RawJobPosting {
  description?: string
  employmentType?: string // schema.org SCREAMING_SNAKE, e.g. "FULL_TIME"
}

/** "FULL_TIME" -> "Full Time". The detail page's own live-payload record often lacks
 * `contract_type` (present on the listing page for the same job, absent on its detail
 * page — a real gap in what japan-dev.com embeds per page), so JobPosting's
 * `employmentType` is the more reliable source for `detail` lookups. */
function prettyEmploymentType(raw: string | undefined): string | null {
  if (!raw) return null
  return raw
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/** Find the schema.org JobPosting block among a page's `application/ld+json` scripts. */
export function extractJobPosting(html: string): RawJobPosting | null {
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

/** Build a JobDetail from a detail page's live job record + its JobPosting JSON-LD description. */
export function buildJobDetail(job: LiveJob, posting: RawJobPosting | null): JobDetail {
  const card = liveJobToCard(job)
  return {
    ...card,
    description: cleanDescription(posting?.description || ""),
    employmentType: prettyEmploymentType(posting?.employmentType) || job.contractType,
    seniority: job.seniorityLevel,
    remoteLevel: job.remoteLevel,
    sponsorsVisa: job.sponsorsVisas,
    englishLevel: job.englishLevel,
    japaneseLevel: job.japaneseLevel,
    salaryMin: job.hasSalaryData ? job.salaryMin : null,
    salaryMax: job.hasSalaryData ? job.salaryMax : null,
    salaryCurrency: job.hasSalaryData ? "JPY" : null,
    skills: job.skillNames.length ? job.skillNames : null,
    applyUrl: job.applicationUrl,
  }
}

/** Human-readable labels for japan-dev's snake_case facet enums (used in `--format plain`; JSON keeps raw codes). */
const SENIORITY_LABELS: Record<string, string> = {
  seniority_level_new_grad: "New grad",
  seniority_level_junior: "Junior",
  seniority_level_mid_level: "Mid-level",
  seniority_level_senior: "Senior",
  seniority_level_unknown: "Not specified",
}

const REMOTE_LEVEL_LABELS: Record<string, string> = {
  remote_level_none: "On-site",
  remote_level_around_office: "Occasional remote",
  remote_level_partial: "Hybrid",
  remote_level_full_japan: "Fully remote (Japan only)",
  remote_level_full_worldwide: "Fully remote (worldwide)",
}

const VISA_LABELS: Record<string, string> = {
  sponsors_visas_yes: "Yes",
  sponsors_visas_no: "No",
  sponsors_visas_unknown: "Not specified",
}

export function formatSeniority(v: string | null): string | null {
  return v ? SENIORITY_LABELS[v] || v : null
}

export function formatRemoteLevel(v: string | null): string | null {
  return v ? REMOTE_LEVEL_LABELS[v] || v : null
}

export function formatVisaSponsorship(v: string | null): string | null {
  return v ? VISA_LABELS[v] || v : null
}

/** Client-side query match: every whitespace-separated word must appear (case-insensitive) in title, skills, or company. */
export function matchesQuery(job: LiveJob, query: string | undefined): boolean {
  if (!query) return true
  const haystack = `${job.title} ${job.skillNames.join(" ")} ${job.company || ""}`.toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word))
}

export function matchesLocation(job: LiveJob, location: string | undefined): boolean {
  if (!location) return true
  return (job.location || "").toLowerCase() === location.toLowerCase()
}

/** Maps the CLI's remote/hybrid/onsite convention onto japan-dev's `remote_level` values. */
export function remoteLevelsForMode(mode: string | undefined): string[] | null {
  switch ((mode || "").toLowerCase()) {
    case "remote":
      return ["remote_level_full_worldwide", "remote_level_full_japan"]
    case "hybrid":
      return ["remote_level_partial"]
    case "onsite":
    case "on-site":
      return ["remote_level_none", "remote_level_around_office"]
    default:
      return null
  }
}

export function matchesRemote(job: LiveJob, mode: string | undefined): boolean {
  const wanted = remoteLevelsForMode(mode)
  if (!wanted) return true
  return !!job.remoteLevel && wanted.includes(job.remoteLevel)
}

export function visaValueForFlag(visa: string | undefined): string | null {
  switch ((visa || "").toLowerCase()) {
    case "yes":
    case "true":
      return "sponsors_visas_yes"
    case "no":
    case "false":
      return "sponsors_visas_no"
    default:
      return null
  }
}

export function matchesVisa(job: LiveJob, visa: string | undefined): boolean {
  const wanted = visaValueForFlag(visa)
  if (!wanted) return true
  return job.sponsorsVisas === wanted
}

export function matchesJobage(job: LiveJob, days: number | undefined): boolean {
  if (!days || days <= 0) return true
  if (!job.publishedAt) return false
  const t = Date.parse(job.publishedAt)
  return !isNaN(t) && t >= Date.now() - days * 86400000
}

/** Accept a bare "<company-slug>/<job-slug>" id or a full/partial japan-dev job URL. */
export function normalizeJobId(input: string): { company: string; job: string } | null {
  const trimmed = input.trim()
  const urlMatch = trimmed.match(/\/jobs\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/)
  if (urlMatch) return { company: urlMatch[1], job: urlMatch[2] }

  const parts = trimmed.split("/").filter(Boolean)
  if (parts.length === 2 && /^[a-zA-Z0-9_-]+$/.test(parts[0]) && /^[a-zA-Z0-9_-]+$/.test(parts[1])) {
    return { company: parts[0], job: parts[1] }
  }
  return null
}
