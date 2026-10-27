#!/usr/bin/env bun
// Self-contained CLI for searching jobs on jobs.ch. No external CLI framework,
// so it runs anywhere `bun` is available with zero install beyond the repo clone.

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

const HELP = `jobs-ch-cli — search jobs on jobs.ch (Switzerland's leading job board)

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <id|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords. IMPORTANT: jobs.ch runs semantic/AI search,
                          not literal keyword matching — verified live: a
                          nonsense query string still returned 125 "relevant"
                          jobs with no textual connection to the query. Treat
                          result relevance as approximate, especially for
                          unusual or multi-word queries.
  --location, -l <text>   Free-text location filter (city name), e.g. "zurich".
                          Maps to jobs.ch's own location= param.
  --jobage <days>         Posted within N days. No server-side param was found
                          (several candidate names tried live, none changed
                          result counts) — filtered client-side against the
                          listing's relative "posted" text (e.g. "3 weeks ago"),
                          applied only to the page actually fetched.
  --page <n>              1-indexed. Real server-side pagination (verified:
                          page=2 returns a different result set than page=1).
  --limit, -n <n>         Cap results emitted (client-side, applied after paging).
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "golang developer" --format table
  bun run src/cli.ts search -q "backend engineer" -l zurich --format table
  bun run src/cli.ts search -q "software engineer" --jobage 7 --format table
  bun run src/cli.ts detail 4d1e118f-25b2-4bde-9e0d-a29f5546d1fe --format plain

jobs.ch's robots.txt (checked 2026-07-22) is open for the paths this CLI uses —
/en/vacancies/ and /en/vacancies/detail/<uuid>/ are both Allowed (a
detail/*/*/*-shaped disallow line exists but doesn't match the real single-uuid
detail URL; verified independently, not just assumed). No login/auth required.
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
