#!/usr/bin/env bun
// Self-contained CLI for searching jobs on jobscout24.ch. No external CLI
// framework, so it runs anywhere `bun` is available with zero install beyond
// the repo clone.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", l: "location", n: "limit" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--") || a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const HELP = `jobscout24-cli — search jobs on jobscout24.ch (Swiss job board, DE/FR/EN)

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <id|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords, e.g. -q "golang". Matched via jobscout24's own
                          \`SearchWhat\` search (title + description), verified against
                          the live site.
  --location, -l <place>  City/region, e.g. -l Zurich. Maps to jobscout24's
                          /en/jobs-in-{city}/ path (verified — a ?SearchWhere= query
                          param does NOT work, it's silently ignored).
  --jobage <days>         Approximate — jobscout24 exposes no exact date/day-count
                          filter at all, only a coarse relative label per listing
                          ("New", "5 d", "2 w", "1+m"). This CLI parses that label
                          into an approximate day count and filters client-side;
                          treat it as "roughly within N days," not exact.
  --page <n>              1-indexed. Maps to jobscout24's own \`p\` param (server-side
                          pagination, ~20 results/page — verified via the site's own
                          "Next" link).
  --limit, -n <n>         Cap results emitted (client-side, applied after paging/jobage).
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "golang" --format table
  bun run src/cli.ts search -q "backend developer" -l Zurich --format table
  bun run src/cli.ts search -q "developer" --jobage 7 --format table
  bun run src/cli.ts detail e1cc5e14-e51d-43db-8816-3dc039a268fb --format plain

jobscout24.ch's robots.txt (checked 2026-07-22) is open for the paths this CLI uses
(/en/jobs/, /en/jobs-in-*/, /en/job/{id}/) — it only disallows /app/, /aspnet_client/,
/careers/, /companies/, /{de,en,fr}/{account,apply,cookies,customer}/, /exportfeed/,
/JS24Web/, /statistics/, none of which this CLI touches.
`

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  if (cmd === "search") {
    const fmt = (flags.format as string) || "json"

    const parseIntFlag = (name: string, raw: string | boolean | string[]): number | null => {
      const val = parseInt(raw as string, 10)
      if (isNaN(val)) {
        process.stderr.write(
          JSON.stringify({ error: `--${name} must be a number, got "${raw}"`, code: "BAD_ARG" }) +
            "\n",
        )
        return null
      }
      return val
    }

    if (flags.jobage !== undefined) {
      const v = parseIntFlag("jobage", flags.jobage)
      if (v === null) return 1
      flags.jobage = String(v)
    }
    if (flags.page !== undefined) {
      const v = parseIntFlag("page", flags.page)
      if (v === null) return 1
      flags.page = String(v)
    }
    if (flags.limit !== undefined) {
      const v = parseIntFlag("limit", flags.limit)
      if (v === null) return 1
      flags.limit = String(v)
    }

    const opts: SearchOpts = {
      query: typeof flags.query === "string" ? flags.query : undefined,
      location: typeof flags.location === "string" ? flags.location : undefined,
      jobage: flags.jobage ? parseInt(flags.jobage as string, 10) : undefined,
      page: flags.page ? Math.max(1, parseInt(flags.page as string, 10)) : 1,
      limit: flags.limit ? parseInt(flags.limit as string, 10) : undefined,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const id = (flags._ as string[])[1]
    if (!id) {
      process.stderr.write(JSON.stringify({ error: "detail requires an <id|url>", code: "NO_ID" }) + "\n")
      return 1
    }
    const fmt = (flags.format as string) || "json"
    const opts: DetailOpts = {
      id,
      format: (fmt === "plain" ? "plain" : "json") as DetailOpts["format"],
    }
    return runDetail(opts)
  }

  process.stderr.write(JSON.stringify({ error: `Unknown command "${cmd}"`, code: "BAD_CMD" }) + "\n")
  return 1
}

main().then((code) => process.exit(code))
