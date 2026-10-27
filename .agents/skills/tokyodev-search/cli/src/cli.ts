#!/usr/bin/env bun
// Self-contained CLI for searching jobs on tokyodev.com. No external CLI
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
  const alias: Record<string, string> = { q: "query", n: "limit" }
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

const HELP = `tokyodev-cli — search jobs on tokyodev.com (Japan tech job board, English-language)

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <id|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords — full-text search over title, tags, and job
                          description. Multi-word values are OR'd, not AND'd
                          (verified) — pass one distinctive keyword for precision,
                          e.g. -q "golang", not -q "golang backend developer".
  --jobage <days>         Not supported by tokyodev — search results carry no
                          posting date at all (only the detail page does).
                          Accepted for interface compatibility but ignored.
  --remote <mode>         remote | hybrid | onsite. Maps to tokyodev's
                          remote_policy filter (fully/partially/no remote).
  --japanese <level>      none | basic | conversational | business | fluent.
                          Filters by tokyodev's Japanese-requirement level.
  --page <n>              1-indexed page. tokyodev returns every matching job
                          in one response (no server pagination) — this CLI
                          paginates client-side, 20 results per page.
  --limit, -n <n>         Cap results emitted (client-side, applied after paging).
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "golang backend developer" --format table
  bun run src/cli.ts search -q "backend engineer" --remote remote --japanese none --format table
  bun run src/cli.ts search -q "site reliability engineer" --page 2 --format table
  bun run src/cli.ts detail moneyforward/backend-engineer-golang --format plain

tokyodev's robots.txt (checked 2026-07-22) is fully open for the paths this CLI
uses (/jobs, /companies/.../jobs/...) — only /c/, /frames/, /ja/frames/ are
disallowed, and this CLI never touches them (that's also where the real
external "apply" link lives, so it's intentionally not resolved here).
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
      jobage: flags.jobage ? parseInt(flags.jobage as string, 10) : undefined,
      remote: typeof flags.remote === "string" ? flags.remote : undefined,
      japanese: typeof flags.japanese === "string" ? flags.japanese : undefined,
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
