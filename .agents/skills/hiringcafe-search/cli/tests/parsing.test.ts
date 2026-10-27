import { describe, test, expect } from "bun:test";
import {
  extractNextData,
  parseSearchResults,
  parseJobDetail,
  cleanDescription,
  jobageToDateBucket,
  workplaceTypeValue,
  normalizeJobId,
} from "../src/helpers";

function nextDataHtml(pageProps: unknown): string {
  return `<html><head></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
    { props: { pageProps } },
  )}</script></body></html>`;
}

describe("extractNextData", () => {
  test("parses the embedded __NEXT_DATA__ JSON blob", () => {
    const html = nextDataHtml({ ssrHits: [], ssrTotalCount: 0, ssrPage: 0 });
    const data = extractNextData(html);
    expect(data.props.pageProps.ssrTotalCount).toBe(0);
  });

  test("returns null when the page has no __NEXT_DATA__ script", () => {
    expect(extractNextData("<html><body>nothing here</body></html>")).toBeNull();
  });

  test("returns null when the blob is malformed JSON", () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">{not json}</script>`;
    expect(extractNextData(html)).toBeNull();
  });
});

describe("parseSearchResults", () => {
  test("maps ssrHits to job cards with requisition_id as the id", () => {
    const nextData = {
      props: {
        pageProps: {
          ssrTotalCount: 42,
          ssrPage: 1,
          ssrHits: [
            {
              requisition_id: "abc123xyz",
              apply_url: "https://example.com/apply",
              job_information: { title: "Golang Developer" },
              v5_processed_job_data: {
                company_name: "Acme Corp",
                formatted_workplace_location: "Bengaluru, India",
                estimated_publish_date: "2026-07-01T00:00:00.000Z",
              },
            },
          ],
        },
      },
    };
    const { count, page, results } = parseSearchResults(nextData);
    expect(count).toBe(42);
    expect(page).toBe(1);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("abc123xyz");
    expect(results[0].title).toBe("Golang Developer");
    expect(results[0].company).toBe("Acme Corp");
    expect(results[0].location).toBe("Bengaluru, India");
    expect(results[0].url).toBe("https://hiringcafe.com/job/job-abc123xyz");
  });

  test("falls back to enriched_company_data.name when company_name is absent", () => {
    const nextData = {
      props: {
        pageProps: {
          ssrHits: [
            {
              requisition_id: "id1",
              job_information: { title: "Engineer" },
              v5_processed_job_data: {},
              enriched_company_data: { name: "Fallback Inc" },
            },
          ],
        },
      },
    };
    const { results } = parseSearchResults(nextData);
    expect(results[0].company).toBe("Fallback Inc");
  });

  test("never omits required fields — nulls instead", () => {
    const nextData = {
      props: { pageProps: { ssrHits: [{ requisition_id: "bare", job_information: {} }] } },
    };
    const { results } = parseSearchResults(nextData);
    expect(results[0]).toEqual({
      id: "bare",
      title: "(untitled)",
      company: null,
      location: null,
      date: null,
      url: "https://hiringcafe.com/job/job-bare",
    });
  });
});

describe("parseJobDetail", () => {
  test("extracts full detail including description and apply link", () => {
    const nextData = {
      props: {
        pageProps: {
          job: {
            requisition_id: "job1",
            apply_url: "https://ats.example.com/apply/1",
            job_information: {
              title: "Senior Golang Engineer",
              description: "<p>Build <strong>things</strong>.</p><p>Second para.</p>",
            },
            v5_processed_job_data: {
              company_name: "Acme",
              commitment: ["Full Time"],
              seniority_level: "Senior",
              workplace_type: "Remote",
            },
          },
        },
      },
    };
    const job = parseJobDetail(nextData);
    expect(job).not.toBeNull();
    expect(job!.description).toBe("Build things.\nSecond para.");
    expect(job!.employmentType).toBe("Full Time");
    expect(job!.seniority).toBe("Senior");
    expect(job!.workplaceType).toBe("Remote");
    expect(job!.applyUrl).toBe("https://ats.example.com/apply/1");
  });

  test("returns null when pageProps.job is absent (e.g. expired/unknown job)", () => {
    expect(parseJobDetail({ props: { pageProps: {} } })).toBeNull();
  });
});

describe("cleanDescription", () => {
  test("strips tags, decodes entities, and collapses blank lines", () => {
    const html = "<p>Go &amp; gRPC role</p><br><p>Location: Bengaluru</p>";
    expect(cleanDescription(html)).toBe("Go & gRPC role\n\nLocation: Bengaluru");
  });

  test("returns null for empty input", () => {
    expect(cleanDescription("")).toBeNull();
  });
});

describe("jobageToDateBucket", () => {
  test("returns -1 (unbounded) when no days given", () => {
    expect(jobageToDateBucket(undefined)).toBe(-1);
  });

  test("maps to the nearest bucket at or above the requested days", () => {
    expect(jobageToDateBucket(1)).toBe(2);
    expect(jobageToDateBucket(7)).toBe(14);
    expect(jobageToDateBucket(30)).toBe(61);
    expect(jobageToDateBucket(90)).toBe(121);
  });

  test("returns -1 for values beyond the largest bucket", () => {
    expect(jobageToDateBucket(5000)).toBe(-1);
  });
});

describe("workplaceTypeValue", () => {
  test("maps known modes case-insensitively", () => {
    expect(workplaceTypeValue("Remote")).toBe("Remote");
    expect(workplaceTypeValue("hybrid")).toBe("Hybrid");
    expect(workplaceTypeValue("ON-SITE")).toBe("Onsite");
  });

  test("returns null for unknown/undefined modes", () => {
    expect(workplaceTypeValue(undefined)).toBeNull();
    expect(workplaceTypeValue("flexible")).toBeNull();
  });
});

describe("normalizeJobId", () => {
  test("accepts a bare requisition_id", () => {
    expect(normalizeJobId("olea5aapgevu88cq")).toBe("olea5aapgevu88cq");
  });

  test("extracts the trailing id from a full job URL", () => {
    expect(
      normalizeJobId(
        "https://hiringcafe.com/job/golang-developer-hpe-bengaluru-olea5aapgevu88cq",
      ),
    ).toBe("olea5aapgevu88cq");
  });

  test("returns null for unparseable input", () => {
    expect(normalizeJobId("??")).toBeNull();
  });
});
