import { describe, test, expect } from "bun:test";
import {
  parseJobCards,
  parseTotalCount,
  extractJobPostingJsonLd,
  jobPostingToDetail,
  cleanDescription,
  remotePolicyValue,
  japaneseRequirementValue,
  normalizeJobId,
} from "../src/helpers";

// Fixture mirrors the real tokyodev.com /jobs markup structure (verified live
// 2026-07-22): jobs are grouped by company `<li>`, with one or more job
// entries per company marked by `data-collapsable-list-target="item"`.
function listingHtml(): string {
  return `
<ul class="relative list-inside">
    <li id="377">
      <div class="flex py-4">
        <div class="flex-1">
          <h3 class="text-lg font-bold">
            <a class="hover:text-indigo-600" href="/companies/regali">REGALI</a>
          </h3>
          <p class="text-slate-500 mb-2">Transforming e-commerce.</p>
          <div class="relative mt-4" data-controller="collapsable-list">
                <div class="relative first:mt-0 mt-4" data-collapsable-list-target="item">
                  <div class="text-lg font-bold mb-1">
  <a class="font-bold" href="/companies/regali/jobs/senior-backend-engineer">Senior Backend Engineer</a>
</div>
<div class="flex gap-2 flex-wrap font-sm">
  <a class="text-sm tag tag-primary" href="/jobs/salary-data">¥7M ~ ¥12M</a>
  <a class="text-sm tag tag-muted" href="/jobs/japanese-required">Business Japanese</a>
  <a class="text-sm tag tag-muted" href="/jobs/residents-only">Japan residents only</a>
  <a class="text-sm tag tag-emerald" href="/jobs/fully-remote">Fully remote</a>
  <a class="text-sm tag tag-muted" href="/jobs/backend">Backend</a><a class="text-sm tag tag-muted" href="/jobs/go">Go</a>
</div>
                </div>
          </div>
        </div>
      </div>
    </li>
    <li id="113">
      <div class="flex py-4">
        <div class="flex-1">
          <h3 class="text-lg font-bold">
            <a class="hover:text-indigo-600" href="/companies/hennge">HENNGE</a>
          </h3>
          <p class="text-slate-500 mb-2">A top cloud security service.</p>
          <div class="relative mt-4" data-controller="collapsable-list">
                <div class="relative first:mt-0 mt-4" data-collapsable-list-target="item">
                  <div class="text-lg font-bold mb-1">
  <a class="font-bold" href="/companies/hennge/jobs/global-intern">Global Internship Program &amp; Full Stack</a>
</div>
<div class="flex gap-2 flex-wrap font-sm">
  <a class="text-sm tag tag-emerald" href="/jobs/no-japanese-required">No Japanese required</a>
  <a class="text-sm tag tag-emerald" href="/jobs/apply-from-abroad">Apply from abroad</a>
  <a class="text-sm tag tag-muted" href="/jobs/no-remote">No remote</a>
  <a class="text-sm tag tag-muted" href="/jobs/go">Go</a>
</div>
                </div>
          </div>
        </div>
      </div>
    </li>
</ul>`;
}

describe("parseTotalCount", () => {
  test("parses plural count", () => {
    expect(parseTotalCount("<h2>154 positions available</h2>")).toBe(154);
  });

  test("parses singular count", () => {
    expect(parseTotalCount("<h2>1 position available</h2>")).toBe(1);
  });

  test("parses zero", () => {
    expect(parseTotalCount("<h2>0 positions available</h2>")).toBe(0);
  });

  test("returns 0 when the header is missing", () => {
    expect(parseTotalCount("<p>nothing here</p>")).toBe(0);
  });
});

describe("parseJobCards", () => {
  test("parses jobs grouped by company into flat cards", () => {
    const cards = parseJobCards(listingHtml());
    expect(cards).toHaveLength(2);

    expect(cards[0]).toEqual({
      id: "regali/senior-backend-engineer",
      title: "Senior Backend Engineer",
      company: "REGALI",
      location: null,
      date: null,
      url: "https://www.tokyodev.com/companies/regali/jobs/senior-backend-engineer",
      salary: "¥7M ~ ¥12M",
      remotePolicy: "Fully remote",
      japaneseRequirement: "Business Japanese",
      applicantLocation: "Japan residents only",
    });
  });

  test("decodes HTML entities in the title and handles missing salary/tags", () => {
    const cards = parseJobCards(listingHtml());
    const hennge = cards[1];
    expect(hennge.title).toBe("Global Internship Program & Full Stack");
    expect(hennge.company).toBe("HENNGE");
    expect(hennge.salary).toBeNull();
    expect(hennge.remotePolicy).toBe("No remote");
    expect(hennge.japaneseRequirement).toBe("No Japanese required");
    expect(hennge.applicantLocation).toBe("Apply from abroad");
  });

  test("returns an empty array for a page with no job entries", () => {
    expect(parseJobCards("<ul></ul>")).toEqual([]);
  });
});

describe("extractJobPostingJsonLd / jobPostingToDetail", () => {
  function detailHtml(): string {
    const posting = {
      "@context": "https://schema.org/",
      "@type": "JobPosting",
      title: "Backend Engineer (Golang)",
      description: "<p>Build <strong>things</strong> with Go &amp; gRPC.</p><p>Second para.</p>",
      datePosted: "2026-01-06T14:25:45.639+09:00",
      hiringOrganization: { "@type": "Organization", name: "Money Forward" },
      jobLocation: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Minato-ku",
          addressRegion: "Tokyo",
          addressCountry: "JP",
        },
      },
      employmentType: "FULL_TIME",
      baseSalary: {
        "@type": "MonetaryAmount",
        currency: "JPY",
        value: { "@type": "QuantitativeValue", minValue: 6900000, maxValue: 11004000, unitText: "YEAR" },
      },
    };
    return `<html><head><script type="application/ld+json">${JSON.stringify(posting)}</script></head></html>`;
  }

  test("extracts the JobPosting JSON-LD blob", () => {
    const posting = extractJobPostingJsonLd(detailHtml());
    expect(posting).not.toBeNull();
    expect(posting!.title).toBe("Backend Engineer (Golang)");
  });

  test("returns null when there is no JobPosting JSON-LD", () => {
    expect(extractJobPostingJsonLd("<html><body>nothing here</body></html>")).toBeNull();
  });

  test("returns null on malformed JSON-LD", () => {
    const html = `<script type="application/ld+json">{not json}</script>`;
    expect(extractJobPostingJsonLd(html)).toBeNull();
  });

  test("maps a full JobPosting to a JobDetail", () => {
    const posting = extractJobPostingJsonLd(detailHtml())!;
    const job = jobPostingToDetail(posting, "moneyforward", "backend-engineer-golang");
    expect(job.id).toBe("moneyforward/backend-engineer-golang");
    expect(job.title).toBe("Backend Engineer (Golang)");
    expect(job.company).toBe("Money Forward");
    expect(job.location).toBe("Minato-ku, Tokyo, JP");
    expect(job.date).toBe("2026-01-06T14:25:45.639+09:00");
    expect(job.description).toBe("Build things with Go & gRPC.\nSecond para.");
    expect(job.employmentType).toBe("Full Time");
    expect(job.salaryMin).toBe(6900000);
    expect(job.salaryMax).toBe(11004000);
    expect(job.salaryCurrency).toBe("JPY");
    expect(job.url).toBe(
      "https://www.tokyodev.com/companies/moneyforward/jobs/backend-engineer-golang",
    );
  });

  test("handles a posting with no baseSalary (field entirely absent)", () => {
    const posting = { "@type": "JobPosting", title: "Intern Role" };
    const job = jobPostingToDetail(posting, "hennge", "global-intern");
    expect(job.salaryMin).toBeNull();
    expect(job.salaryMax).toBeNull();
    expect(job.salaryCurrency).toBeNull();
  });
});

describe("cleanDescription", () => {
  test("strips tags, decodes entities, and collapses blank lines", () => {
    const html = "<p>Go &amp; gRPC role</p><br><p>Location: Tokyo</p>";
    expect(cleanDescription(html)).toBe("Go & gRPC role\n\nLocation: Tokyo");
  });

  test("returns null for empty input", () => {
    expect(cleanDescription("")).toBeNull();
  });
});

describe("remotePolicyValue", () => {
  test("maps CLI-friendly modes to tokyodev's filter values", () => {
    expect(remotePolicyValue("remote")).toBe("fully_remote");
    expect(remotePolicyValue("hybrid")).toBe("partially_remote");
    expect(remotePolicyValue("onsite")).toBe("no_remote");
  });

  test("returns null for unknown/undefined modes", () => {
    expect(remotePolicyValue(undefined)).toBeNull();
    expect(remotePolicyValue("flexible")).toBeNull();
  });
});

describe("japaneseRequirementValue", () => {
  test("accepts known levels case-insensitively", () => {
    expect(japaneseRequirementValue("None")).toBe("none");
    expect(japaneseRequirementValue("BUSINESS")).toBe("business");
  });

  test("returns null for unknown levels", () => {
    expect(japaneseRequirementValue("native")).toBeNull();
  });
});

describe("normalizeJobId", () => {
  test("accepts a bare company/job id", () => {
    expect(normalizeJobId("moneyforward/backend-engineer-golang")).toEqual({
      company: "moneyforward",
      job: "backend-engineer-golang",
    });
  });

  test("extracts company/job from a full tokyodev URL", () => {
    expect(
      normalizeJobId("https://www.tokyodev.com/companies/moneyforward/jobs/backend-engineer-golang"),
    ).toEqual({ company: "moneyforward", job: "backend-engineer-golang" });
  });

  test("returns null for unparseable input", () => {
    expect(normalizeJobId("??")).toBeNull();
    expect(normalizeJobId("just-one-segment")).toBeNull();
  });
});
