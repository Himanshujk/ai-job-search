// Data source: WeAreDevelopers' own documented Markdown API (see /agents.md on the
// site). Every page is available as clean markdown via a `.md` suffix or an
// `Accept: text/markdown` header — this is a publicly documented agent interface,
// not HTML scraping. We still parse the markdown with regex (the structure is a
// flat, stable list of "## Title" blocks with a "- **Label:** value" metadata list).

export const JOBS_SEARCH_URL = "https://www.wearedevelopers.com/jobs.md"
export const JOBS_BASE_URL = "https://www.wearedevelopers.com/jobs/"

export const VALID_COUNTRIES = [
  "AT", "BE", "DE", "ES", "FR", "IT", "LT", "NL", "RS", "UK", "US", "VN", "ALL",
]

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "wearedevelopers-search-cli/1.0 (personal job search; +bun)"

/** Fetch a `.md` page with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function mdFetch(url: string): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/markdown, text/plain;q=0.9, */*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
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

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  experience: string | null
  salary: string | null
  contract: string | null
  date: string | null // ISO 8601 date, or null if unparseable
  url: string
  applyUrl: string | null
}

export interface JobDetail extends JobCard {
  skills: string | null
  description: string | null
}

/** Parse "August 15, 2026" into an ISO date string, or null if unparseable. */
export function parsePublishedDate(text: string | null): string | null {
  if (!text) return null
  const d = new Date(text)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/** Extract the id (path segment after /jobs/) from a full wearedevelopers.com job URL. */
export function idFromUrl(url: string): string | null {
  const m = url.match(/\/jobs\/([^?#]+)/)
  return m ? m[1] : null
}

/** Pull `- **Label:** value` bullet fields out of a markdown block into a lowercase-keyed map. */
function parseBullets(block: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /^- \*\*([^*:]+):\*\*\s*(.+)$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(block)) !== null) {
    out[m[1].trim().toLowerCase()] = m[2].trim()
  }
  return out
}

/**
 * Parse the jobs.md search response: a flat list of "## Title" blocks, terminated
 * by a "## Filter by Country" section we must not treat as a result. Each block is
 * parsed independently so one malformed entry cannot break the rest.
 */
export function parseSearchResults(markdown: string): JobCard[] {
  const results: JobCard[] = []
  const headingRe = /^## (.+)$/gm
  const headings: { title: string; start: number; end: number }[] = []
  let m: RegExpExecArray | null
  const matches: { title: string; index: number }[] = []
  while ((m = headingRe.exec(markdown)) !== null) {
    matches.push({ title: m[1].trim(), index: m.index })
  }
  for (let i = 0; i < matches.length; i++) {
    if (matches[i].title === "Filter by Country") continue
    const start = matches[i].index
    const end = i + 1 < matches.length ? matches[i + 1].index : markdown.length
    headings.push({ title: matches[i].title, start, end })
  }

  for (const h of headings) {
    const block = markdown.slice(h.start, h.end)
    const bullets = parseBullets(block)
    const viewMatch = block.match(/\[View job\]\(([^)]+)\)/)
    if (!viewMatch) continue
    const url = viewMatch[1]
    const id = idFromUrl(url)
    if (!id) continue
    const applyMatch = block.match(/\[Apply\]\(([^)]+)\)/)

    results.push({
      id,
      title: h.title,
      company: bullets["company"] ?? null,
      location: bullets["location"] ?? null,
      experience: bullets["experience"] ?? null,
      salary: bullets["salary"] ?? null,
      contract: bullets["contract"] ?? null,
      date: parsePublishedDate(bullets["published"] ?? null),
      url,
      applyUrl: applyMatch ? applyMatch[1] : null,
    })
  }

  return results
}

/** Parse a single job detail page (jobs/{id}.md). */
export function parseJobDetail(markdown: string, id: string): JobDetail {
  const titleMatch = markdown.match(/^# (.+)$/m)
  const title = titleMatch ? titleMatch[1].trim() : "(untitled)"

  const bullets = parseBullets(markdown)

  const section = (heading: string): string | null => {
    const marker = `## ${heading}`
    const start = markdown.indexOf(marker)
    if (start === -1) return null
    const bodyStart = start + marker.length
    const nextHeading = markdown.indexOf("\n## ", bodyStart)
    const body = nextHeading === -1 ? markdown.slice(bodyStart) : markdown.slice(bodyStart, nextHeading)
    return body.trim() || null
  }

  const description = section("Description") ?? section("About the Role")

  return {
    id,
    title,
    company: bullets["company"] ?? null,
    location: bullets["location"] ?? null,
    experience: bullets["experience"] ?? null,
    salary: bullets["salary"] ?? null,
    contract: bullets["contract"] ?? null,
    date: parsePublishedDate(bullets["published"] ?? null),
    url: JOBS_BASE_URL + id,
    applyUrl: bullets["apply"] ?? null,
    skills: bullets["skills"] ?? null,
    description,
  }
}

/** Keep only cards published within the last N days. A card with no parseable date is kept. */
export function filterByJobAge(cards: JobCard[], days: number): JobCard[] {
  if (!days || days <= 0 || days >= 9999) return cards
  const cutoff = Date.now() - days * 86400000
  return cards.filter((c) => {
    if (!c.date) return true
    const t = new Date(c.date).getTime()
    if (isNaN(t)) return true
    return t >= cutoff
  })
}

export function normalizeCountry(input: string | undefined): string {
  if (!input) return "all"
  const up = input.toUpperCase()
  return up === "ALL" ? "all" : up
}
