import { describe, test, expect } from "bun:test";
import { runCLI, parseJSON } from "./helpers";

// Live smoke tests against the real japan-dev.com site — parses the live /jobs
// page's own embedded data (see helpers.ts for why this isn't the Algolia index).
// Keep volume low — one search, one detail lookup. Query is a single common word:
// the live set is only ~60 current postings, and matchesQuery requires every
// query word to match, so a two-word query risks 0 hits depending on what's
// currently posted — "engineer" is safe and realistic.
const TEST_QUERY = "engineer";

describe("japandev CLI (live)", () => {
  test("search returns real, non-null results for a realistic query", async () => {
    const result = await runCLI(["search", "-q", TEST_QUERY, "--limit", "5"]);
    expect(result.exitCode).toBe(0);
    const data = parseJSON<{ meta: { count: number }; results: any[] }>(result);
    expect(data.results.length).toBeGreaterThan(0);
    for (const job of data.results) {
      expect(job.id).toBeTruthy();
      expect(job.title).toBeTruthy();
      expect(job.url).toMatch(/^https:\/\/japan-dev\.com\/jobs\//);
    }
  }, 30000);

  test("detail returns a readable description for an id from search", async () => {
    const searchResult = await runCLI(["search", "-q", TEST_QUERY, "--limit", "1"]);
    const { results } = parseJSON<{ results: any[] }>(searchResult);
    expect(results.length).toBeGreaterThan(0);

    const detailResult = await runCLI(["detail", results[0].id, "--format", "plain"]);
    expect(detailResult.exitCode).toBe(0);
    expect(detailResult.stdout.length).toBeGreaterThan(0);
    expect(detailResult.stdout).not.toMatch(/<[a-z]+>/i); // no leftover HTML tags
  }, 30000);

  test("a bogus flag value exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["search", "--jobage", "not-a-number"]);
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe("BAD_ARG");
  });

  test("detail without an id exits 1 with a JSON error on stderr", async () => {
    const result = await runCLI(["detail"]);
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe("NO_ID");
  });

  test("--remote-or-visa without both --remote and --visa exits 1 with a JSON error", async () => {
    const result = await runCLI(["search", "--visa", "yes", "--remote-or-visa"]);
    expect(result.exitCode).toBe(1);
    const err = JSON.parse(result.stderr);
    expect(err.code).toBe("BAD_ARG");
  });

  test("--remote-or-visa matches at least as many jobs as the AND (--remote + --visa) query", async () => {
    // Compares meta.count (pre-pagination), not the page-1 result arrays — search's
    // 20-per-page window means a wider OR match set can push shared ids past page 1,
    // so comparing paginated result ids directly would be a false negative.
    const andResult = await runCLI(["search", "--visa", "yes", "--remote", "remote"]);
    const orResult = await runCLI(["search", "--visa", "yes", "--remote", "remote", "--remote-or-visa"]);
    expect(andResult.exitCode).toBe(0);
    expect(orResult.exitCode).toBe(0);
    const andCount = parseJSON<{ meta: { count: number } }>(andResult).meta.count;
    const orCount = parseJSON<{ meta: { count: number } }>(orResult).meta.count;
    expect(orCount).toBeGreaterThanOrEqual(andCount);
  }, 30000);
});
