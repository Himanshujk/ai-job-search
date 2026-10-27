// Data source: tokyodev.com, a Rails-rendered site with two very different
// parsing needs:
//   - Search results (`/jobs`) are plain server-rendered HTML — jobs are grouped
//     by company, so we split into per-company blocks and then per-job chunks
//     within each block (same "split into independent chunks" approach as
//     linkedin-search's parseJobCards, just two levels deep).
//   - Job detail pages embed a schema.org `JobPosting` as JSON-LD
//     (`<script type="application/ld+json">`) — we parse that directly instead
//     of scraping the rendered HTML, per the repo's "prefer structured data"
//     rule.
//
// No authentication required. robots.txt (checked 2026-07-22) is fully open
// except `/c/`, `/frames/`, `/ja/frames/` (and blocks Amazonbot entirely) — none
// of which this CLI touches. `/jobs` and `/companies/.../jobs/...` are Allowed.

export const BASE_URL = "https://www.tokyodev.com"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

const STATUS_MARKER = "\n__TOKYODEV_CLI_STATUS__:"

/**
 * Runs one HTTP request via the system `curl` binary instead of Bun's native
 * `fetch()`.
 *
 * Portal quirk (verified 2026-07-22): tokyodev.com sits behind Cloudflare, and
 * its bot-management rules challenge (HTTP 403, "Just a moment...") requests
 * that negotiate HTTP/2 on `/jobs/<category>` and `/companies/.../jobs/...`
 * paths — which is exactly what Bun's `fetch()` does by default, even with a
 * convincing browser User-Agent. Forcing HTTP/1.1 avoids the challenge
 * entirely (confirmed: `curl --http1.1` gets 200, `curl` with default HTTP/2
 * gets 403 on the identical URL). `curl` is a system binary, not an npm
 * package, so this keeps the CLI at zero runtime dependencies.
 */
async function curlRequest(url: string): Promise<{ status: number; body: string }> {
  const proc = Bun.spawn(
    [
      "curl",
      "-sS",
      "--http1.1",
      "-L",
      "-A",
      UA,
      "-H",
      "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "-H",
      "Accept-Language: en-US,en;q=0.9",
      "-w",
      `${STATUS_MARKER}%{http_code}`,
      url,
    ],
    { stdout: "pipe", stderr: "pipe" },
  )
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (exitCode !== 0) {
    throw new Error(`curl failed (exit ${exitCode}): ${stderr.trim() || "unknown error"}`)
  }
  const idx = stdout.lastIndexOf(STATUS_MARKER)
  if (idx === -1) {
    throw new Error("curl: could not parse response status code")
  }
  return {
    body: stdout.slice(0, idx),
    status: parseInt(stdout.slice(idx + STATUS_MARKER.length), 10),
  }
}

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. Follows redirects. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { status, body } = await curlRequest(url)
    if (status === 429 || status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${status}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (status === 404) return ""
    if (status < 200 || status >= 400) {
      throw new Error(`Request failed: ${status}`)
    }
    return body
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
  salary: string | null
  remotePolicy: string | null
  japaneseRequirement: string | null
  applicantLocation: string | null
}

export interface JobDetail extends JobCard {
  description: string | null
  employmentType: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  applyUrl: string | null
}

function detailUrl(company: string, job: string): string {
  return `${BASE_URL}/companies/${company}/jobs/${job}`
}

/**
 * Parse the `/jobs` search-results HTML into job cards.
 *
 * The page groups postings by company: each `<li id="...">` is one company,
 * containing one or more job entries marked with
 * `data-collapsable-list-target="item"`. We split first on company blocks,
 * then on job entries within each block, and parse each entry independently
 * so one malformed chunk can't break the rest.
 */
export function parseJobCards(html: string): JobCard[] {
  const results: JobCard[] = []
  const companyBlocks = html.split(/<li id="\d+">/).slice(1)

  for (const block of companyBlocks) {
    const companyNameMatch = block.match(
      /<h3[^>]*>\s*<a[^>]*href="\/companies\/[a-zA-Z0-9_-]+"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/i,
    )
    const companyName = companyNameMatch ? clean(companyNameMatch[1]) || null : null

    const jobChunks = block.split(/data-collapsable-list-target="item"/).slice(1)
    for (const chunk of jobChunks) {
      const linkMatch = chunk.match(
        /href="\/companies\/([a-zA-Z0-9_-]+)\/jobs\/([a-zA-Z0-9_-]+)"[^>]*>([\s\S]*?)<\/a>/i,
      )
      if (!linkMatch) continue
      const [, companySlug, jobSlug, rawTitle] = linkMatch
      const title = clean(rawTitle)
      if (!title) continue

      const salaryMatch = chunk.match(
        /class="[^"]*tag-primary[^"]*"\s+href="\/jobs\/salary-data">([^<]+)<\/a>/i,
      )
      const remoteMatch = chunk.match(
        /href="\/jobs\/(fully-remote|partially-remote|no-remote)"[^>]*>([^<]+)<\/a>/i,
      )
      const japaneseMatch = chunk.match(
        /href="\/jobs\/(japanese-required|no-japanese-required)"[^>]*>([^<]+)<\/a>/i,
      )
      const applicantLocationMatch = chunk.match(
        /href="\/jobs\/(apply-from-abroad|residents-only)"[^>]*>([^<]+)<\/a>/i,
      )

      results.push({
        id: `${companySlug}/${jobSlug}`,
        title,
        company: companyName,
        location: null, // not shown in the listing; see `detail` for city/region
        date: null, // not shown in the listing; see `detail` for datePosted
        url: detailUrl(companySlug, jobSlug),
        salary: salaryMatch ? clean(salaryMatch[1]) || null : null,
        remotePolicy: remoteMatch ? clean(remoteMatch[2]) || null : null,
        japaneseRequirement: japaneseMatch ? clean(japaneseMatch[2]) || null : null,
        applicantLocation: applicantLocationMatch ? clean(applicantLocationMatch[2]) || null : null,
      })
    }
  }

  return results
}

/** Total matching count from the "N position(s) available" header. */
export function parseTotalCount(html: string): number {
  const m = html.match(/(\d+)\s+positions?\s+available/i)
  return m ? parseInt(m[1], 10) : 0
}

/** A schema.org JobPosting, as embedded in every detail page's JSON-LD script. */
interface RawJobPosting {
  title?: string
  description?: string
  datePosted?: string
  hiringOrganization?: { name?: string }
  jobLocation?: {
    address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string }
  }
  employmentType?: string
  baseSalary?: {
    currency?: string
    value?: { minValue?: number; maxValue?: number; unitText?: string }
  }
}

/** Extract and parse the `JobPosting` JSON-LD blob embedded in a detail page. */
export function extractJobPostingJsonLd(html: string): RawJobPosting | null {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
  if (!m) return null
  try {
    const data = JSON.parse(m[1])
    return data && data["@type"] === "JobPosting" ? data : null
  } catch {
    return null
  }
}

function prettyEmploymentType(raw: string | undefined): string | null {
  if (!raw) return null
  return raw
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/** Build a JobDetail from a detail page's parsed JobPosting JSON-LD. */
export function jobPostingToDetail(
  posting: RawJobPosting,
  company: string,
  job: string,
): JobDetail {
  const addr = posting.jobLocation?.address
  const location = addr
    ? [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean).join(", ") ||
      null
    : null
  const salaryValue = posting.baseSalary?.value

  return {
    id: `${company}/${job}`,
    title: posting.title || "(untitled)",
    company: posting.hiringOrganization?.name || null,
    location,
    date: posting.datePosted || null,
    url: detailUrl(company, job),
    salary: null, // formatted salary tag only appears on the listing; see salaryMin/Max here
    remotePolicy: null, // only exposed as a listing tag, not in the JSON-LD
    japaneseRequirement: null, // only exposed as a listing tag, not in the JSON-LD
    applicantLocation: null, // only exposed as a listing tag, not in the JSON-LD
    description: cleanDescription(posting.description || ""),
    employmentType: prettyEmploymentType(posting.employmentType),
    salaryMin: salaryValue?.minValue ?? null,
    salaryMax: salaryValue?.maxValue ?? null,
    salaryCurrency: posting.baseSalary?.currency ?? null,
    // The real external application link only appears after following
    // /c/<company>/j/<job>/applications/new, which robots.txt disallows
    // crawling — so we point back at the canonical tokyodev listing instead
    // of fabricating or fetching a disallowed URL.
    applyUrl: null,
  }
}

/** tokyodev's remote_policy[] filter values. */
export function remotePolicyValue(mode: string | undefined): string | null {
  switch ((mode || "").toLowerCase()) {
    case "remote":
    case "fully-remote":
    case "fully_remote":
      return "fully_remote"
    case "hybrid":
    case "partially-remote":
    case "partially_remote":
      return "partially_remote"
    case "onsite":
    case "on-site":
    case "no-remote":
    case "no_remote":
      return "no_remote"
    default:
      return null
  }
}

/** tokyodev's japanese_requirement[] filter values. */
export function japaneseRequirementValue(level: string | undefined): string | null {
  const v = (level || "").toLowerCase()
  return ["none", "basic", "conversational", "business", "fluent"].includes(v) ? v : null
}

/** Accept a bare "<company-slug>/<job-slug>" id or a full tokyodev job URL. */
export function normalizeJobId(input: string): { company: string; job: string } | null {
  const trimmed = input.trim()
  const urlMatch = trimmed.match(/\/companies\/([a-zA-Z0-9_-]+)\/jobs\/([a-zA-Z0-9_-]+)/)
  if (urlMatch) return { company: urlMatch[1], job: urlMatch[2] }

  const parts = trimmed.split("/").filter(Boolean)
  if (parts.length === 2 && /^[a-zA-Z0-9_-]+$/.test(parts[0]) && /^[a-zA-Z0-9_-]+$/.test(parts[1])) {
    return { company: parts[0], job: parts[1] }
  }
  return null
}
