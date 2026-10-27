import {
  BASE_URL,
  htmlFetch,
  extractNextData,
  parseSearchResults,
  jobageToDateBucket,
  workplaceTypeValue,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  jobage?: number
  remote?: string // "remote" | "hybrid" | "onsite"
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

function buildUrl(opts: SearchOpts): string {
  const state: Record<string, unknown> = {
    defaultToUserLocation: false,
    dateFetchedPastNDays: jobageToDateBucket(opts.jobage),
  }
  if (opts.query) state.searchQuery = opts.query
  const wt = workplaceTypeValue(opts.remote)
  if (wt) state.workplaceTypes = [wt]

  const params = new URLSearchParams()
  params.set("searchState", JSON.stringify(state))
  if (opts.page > 1) params.set("page", String(opts.page))
  return `${BASE_URL}/?${params.toString()}`
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 42).padEnd(42)
    const company = (c.company || "—").slice(0, 26).padEnd(26)
    const loc = (c.location || "—").slice(0, 24).padEnd(24)
    const date = (c.date || "—").slice(0, 10)
    return `${c.id.padEnd(18)} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(18) +
    " " +
    "TITLE".padEnd(42) +
    " " +
    "COMPANY".padEnd(26) +
    " " +
    "LOCATION".padEnd(24) +
    " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const html = await htmlFetch(buildUrl(opts))
    const nextData = extractNextData(html)
    if (!nextData) {
      writeError("Could not parse search results page", "PARSE_FAILED")
      return 1
    }
    const { count, page, results } = parseSearchResults(nextData)
    let cards = results
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
        JSON.stringify({ meta: { count, page: page || opts.page }, results: cards }, null, 2) +
          "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
