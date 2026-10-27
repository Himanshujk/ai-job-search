import {
  BASE_URL,
  htmlFetch,
  extractLiveJobs,
  liveJobToCard,
  matchesQuery,
  matchesLocation,
  matchesRemote,
  matchesVisa,
  matchesJobage,
  remoteLevelsForMode,
  visaValueForFlag,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  jobage?: number
  location?: string
  remote?: string // "remote" | "hybrid" | "onsite"
  visa?: string // "yes" | "no"
  remoteOrVisa?: boolean // OR --remote and --visa instead of AND-ing them
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

const PAGE_SIZE = 20

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 42).padEnd(42)
    const company = (c.company || "—").slice(0, 24).padEnd(24)
    const loc = (c.location || "—").slice(0, 14).padEnd(14)
    const date = (c.date || "—").slice(0, 10)
    return `${c.id.padEnd(40)} ${title} ${company} ${loc} ${date}`
  })
  const header =
    "ID".padEnd(40) + " " + "TITLE".padEnd(42) + " " + "COMPANY".padEnd(24) + " " + "LOCATION".padEnd(14) + " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    // The `/jobs` page always renders the same live "latest postings" set
    // regardless of query string — see helpers.ts for why. So this fetches
    // that fixed set once and filters/paginates it entirely client-side.
    const html = await htmlFetch(`${BASE_URL}/jobs`)

    // --remote-or-visa ORs the two facets instead of AND-ing them (e.g. "remote OR
    // visa-sponsored"). matchesRemote/matchesVisa return true when their flag is unset
    // (no filter), which is wrong for OR — so this checks each facet's actual match
    // directly rather than reusing those two.
    const remoteWanted = remoteLevelsForMode(opts.remote)
    const visaWanted = visaValueForFlag(opts.visa)
    const jobs = extractLiveJobs(html).filter((j) => {
      if (!matchesQuery(j, opts.query) || !matchesLocation(j, opts.location) || !matchesJobage(j, opts.jobage)) {
        return false
      }
      if (opts.remoteOrVisa) {
        const remoteMatch = !!remoteWanted && !!j.remoteLevel && remoteWanted.includes(j.remoteLevel)
        const visaMatch = !!visaWanted && j.sponsorsVisas === visaWanted
        return remoteMatch || visaMatch
      }
      return matchesRemote(j, opts.remote) && matchesVisa(j, opts.visa)
    })

    const count = jobs.length
    const start = (opts.page - 1) * PAGE_SIZE
    let cards = jobs.slice(start, start + PAGE_SIZE).map(liveJobToCard)
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
      process.stdout.write(JSON.stringify({ meta: { count, page: opts.page }, results: cards }, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
