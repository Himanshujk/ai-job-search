import { describe, expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers"

// Live network smoke test against the real portal. Keep volume to one search + one
// detail fetch per run, per the site's own "Be nice" rate-limiting policy.
describe("live smoke test", () => {
  test("search returns real results with non-null id/title/url", async () => {
    const result = await runCLI(["search", "-q", "golang backend developer", "--limit", "5"])
    const parsed = parseJSON<{ meta: { count: number }; results: Array<Record<string, unknown>> }>(result)
    expect(parsed.results.length).toBeGreaterThan(0)
    for (const r of parsed.results) {
      expect(r.id).toBeTruthy()
      expect(r.title).toBeTruthy()
      expect(r.url).toContain("wearedevelopers.com/jobs/")
    }
  }, 30000)

  test("detail on the first live search result returns a readable description", async () => {
    const searchResult = await runCLI(["search", "-q", "golang backend developer", "--limit", "1"])
    const parsed = parseJSON<{ results: Array<{ id: string }> }>(searchResult)
    expect(parsed.results.length).toBeGreaterThan(0)

    const detailResult = await runCLI(["detail", parsed.results[0].id, "--format", "plain"])
    expect(detailResult.exitCode).toBe(0)
    expect(detailResult.stdout.length).toBeGreaterThan(0)
    expect(detailResult.stdout).not.toContain("<")
  }, 30000)
})
