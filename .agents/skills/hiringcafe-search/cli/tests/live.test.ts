import { describe, test, expect } from "bun:test";
import { runCLI, parseJSON } from "./helpers";

// Live smoke tests against the real hiringcafe.com site. Keep volume low —
// one search, one detail lookup. See ../SKILL.md for the personal-use note.

const TEST_QUERY = "golang backend developer";

describe("hiringcafe CLI (live)", () => {
  test("search returns real, non-null results for a realistic query", async () => {
    const result = await runCLI(["search", "-q", TEST_QUERY, "--limit", "5"]);
    expect(result.exitCode).toBe(0);
    const data = parseJSON<{ meta: { count: number }; results: any[] }>(result);
    expect(data.results.length).toBeGreaterThan(0);
    for (const job of data.results) {
      expect(job.id).toBeTruthy();
      expect(job.title).toBeTruthy();
      expect(job.url).toMatch(/^https:\/\/hiringcafe\.com\/job\//);
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
});
