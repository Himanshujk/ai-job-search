import {
  BASE_URL,
  htmlFetch,
  parseJobCards,
  parseTotalCount,
  remotePolicyValue,
  japaneseRequirementValue,
  writeError,
  type JobCard,
} from "../helpers.js"

// tokyodev's `/jobs` listing returns *every* matching posting in one response —
// there is no server-side pagination (`?page=N` is silently ignored; verified
// 2026-07-22 by comparing page=1 and page=2 responses byte-for-byte). `--page`
// is therefore implemented client-side over the full result set, sliced into
// fixed-size pages.
const CLIENT_PAGE_SIZE = 20

export interface SearchOpts {
  query?: string
  jobage?: number
  remote?: string // "remote" | "hybrid" | "onsite"
  japanese?: string // "none" | "basic" | "conversational" | "business" | "fluent"
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

function buildUrl(opts: SearchOpts): string {
  const params = new URLSearchParams()
  if (opts.query) params.append("query[]", opts.query)
  const rp = remotePolicyValue(opts.remote)
  if (rp) params.append("remote_policy[]", rp)
  const jr = japaneseRequirementValue(opts.japanese)
  if (jr) params.append("japanese_requirement[]", jr)
  return `${BASE_URL}/jobs?${params.toString()}`
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 42).padEnd(42)
    const company = (c.company || "—").slice(0, 22).padEnd(22)
    const salary = (c.salary || "—").slice(0, 16).padEnd(16)
    const remote = (c.remotePolicy || "—").slice(0, 16)
    return `${c.id.padEnd(38)} ${title} ${company} ${salary} ${remote}`
  })
  const header =
    "ID".padEnd(38) +
    " " +
    "TITLE".padEnd(42) +
    " " +
    "COMPANY".padEnd(22) +
    " " +
    "SALARY".padEnd(16) +
    " REMOTE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const html = await htmlFetch(buildUrl(opts))
    if (!html) {
      writeError("Could not fetch search results page", "FETCH_FAILED")
      return 1
    }
    const count = parseTotalCount(html)
    const allResults = parseJobCards(html)

    const page = Math.max(1, opts.page)
    const start = (page - 1) * CLIENT_PAGE_SIZE
    let cards = allResults.slice(start, start + CLIENT_PAGE_SIZE)
    if (opts.limit && opts.limit > 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.salary || "salary n/a"} · ${c.remotePolicy || "—"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify({ meta: { count, page }, results: cards }, null, 2) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
