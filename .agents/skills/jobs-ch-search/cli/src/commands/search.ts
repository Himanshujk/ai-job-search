import {
  BASE_URL,
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

function buildUrl(opts: SearchOpts): string {
  const params = new URLSearchParams()
  if (opts.query) params.append("term", opts.query)
  if (opts.location) params.append("location", opts.location)
  if (opts.page > 1) params.append("page", String(opts.page))
  return `${BASE_URL}/en/vacancies/?${params.toString()}`
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 42).padEnd(42)
    const company = (c.company || "—").slice(0, 28).padEnd(28)
    const location = (c.location || "—").slice(0, 18).padEnd(18)
    const date = (c.date || "—").slice(0, 14)
    return `${c.id.padEnd(36)} ${title} ${company} ${location} ${date}`
  })
  const header =
    "ID".padEnd(36) +
    " " +
    "TITLE".padEnd(42) +
    " " +
    "COMPANY".padEnd(28) +
    " " +
    "LOCATION".padEnd(18) +
    " DATE"
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
    let cards = parseJobCards(html)

    if (opts.jobage) cards = cards.filter((c) => matchesJobage(c.date, opts.jobage))
    if (opts.limit && opts.limit > 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.date || "—"}\n  id: ${c.id}\n  ${c.url}`,
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
