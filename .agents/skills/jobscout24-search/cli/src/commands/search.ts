import {
  buildSearchUrl,
  htmlFetch,
  parseJobCards,
  parseTotalCount,
  matchesJobage,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  jobage?: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 42).padEnd(42)
    const company = (c.company || "—").slice(0, 22).padEnd(22)
    const location = (c.location || "—").slice(0, 18).padEnd(18)
    const date = (c.date || "—").padEnd(6)
    return `${c.id.padEnd(38)} ${title} ${company} ${location} ${date}`
  })
  const header =
    "ID".padEnd(38) +
    " " +
    "TITLE".padEnd(42) +
    " " +
    "COMPANY".padEnd(22) +
    " " +
    "LOCATION".padEnd(18) +
    " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const html = await htmlFetch(buildSearchUrl(opts.query, opts.location, opts.page))
    // An out-of-range page (e.g. `p=99` on a 3-page result set) returns HTTP 404 on
    // this site — htmlFetch() surfaces that as "", which we treat as "zero results
    // on this page" rather than a fetch failure.
    if (html === "" && opts.page === 1) {
      writeError("Could not fetch search results page", "FETCH_FAILED")
      return 1
    }

    const count = html ? parseTotalCount(html) : 0
    let cards = html ? parseJobCards(html) : []
    cards = cards.filter((c) => matchesJobage(c.date, opts.jobage))
    if (opts.limit && opts.limit > 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.workload || "workload n/a"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify({ meta: { count, page: opts.page }, results: cards }, null, 2) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
