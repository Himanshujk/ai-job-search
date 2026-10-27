#!/usr/bin/env bun
// Self-contained CLI for searching jobs on japan-dev.com — hand-picked, English-friendly
// tech jobs in Japan with visa-sponsorship info. No external CLI framework, so it runs
// anywhere `bun` is available with zero install beyond the repo clone.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", n: "limit", l: "location" }
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

const HELP = `japandev-cli — search jobs on japan-dev.com (hand-picked tech jobs in Japan)

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <id|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords (job title, skill, role), e.g. -q "golang developer".
  --location, -l <place>  Office location facet: Tokyo | Osaka | Fukuoka | Remote.
  --jobage <days>         Posted within N days. Filtered client-side (this index has no
                          server-side date filter) against the job's published_at date.
  --remote <mode>         remote | hybrid | onsite — maps to japan-dev's remote_level facet.
  --visa <yes|no>         Filter by whether the employer sponsors visas from overseas.
  --remote-or-visa        Match if EITHER --remote OR --visa matches, instead of requiring
                          both. Requires both --remote and --visa to be given.
  --page <n>              1-indexed page. Default 1. Page size is 20.
  --limit, -n <n>         Cap results emitted (client-side).
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "golang developer" --format table
  bun run src/cli.ts search -q "backend engineer" --visa yes --remote remote --format table
  bun run src/cli.ts search -q "site reliability" -l Tokyo --format table
  bun run src/cli.ts search -q "go" --visa yes --remote remote --remote-or-visa --format table
  bun run src/cli.ts detail zeals/zeals-site-reliability-engineer-uri285 --format plain

Data comes from japan-dev.com's own live page data (the same /jobs listing a
browser sees), filtered client-side — NOT full-archive search. See SKILL.md for
why (the site's client-side search widget hits a stale index) and what that
means for coverage.
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
        process.stderr.write(JSON.stringify({ error: `--${name} must be a number, got "${raw}"`, code: "BAD_ARG" }) + "\n")
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

    const remote = typeof flags.remote === "string" ? flags.remote : undefined
    const visa = typeof flags.visa === "string" ? flags.visa : undefined
    const remoteOrVisa = !!flags["remote-or-visa"]
    if (remoteOrVisa && (!remote || !visa)) {
      process.stderr.write(
        JSON.stringify({ error: "--remote-or-visa requires both --remote and --visa", code: "BAD_ARG" }) + "\n",
      )
      return 1
    }

    const opts: SearchOpts = {
      query: typeof flags.query === "string" ? flags.query : undefined,
      jobage: flags.jobage ? parseInt(flags.jobage as string, 10) : undefined,
      location: typeof flags.location === "string" ? flags.location : undefined,
      remote,
      visa,
      remoteOrVisa,
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
