import { describe, test, expect } from "bun:test";
import {
  parseJobCards,
  parseTotalCount,
  extractJobPostingJsonLd,
  jobPostingToDetail,
  cleanDescription,
  normalizeJobId,
  parseRelativeAge,
  matchesJobage,
  detailUrl,
} from "../src/helpers";

// Fixture mirrors the real jobs.ch /en/vacancies/ markup structure (verified
// live 2026-07-22): each result is a `data-cy="serp-item"` block with a
// `data-cy="job-link"` anchor carrying the uuid + title, a relative-date `<p>`,
// three labelled key/value rows (Place of work / Workload / Contract type),
// and a company name `<p>` distinguished by `c_gray.700 fw_bold` classes.
function listingHtml(): string {
  return `
<div class="d_grid gap_s16 ov_hidden p_s16">
  <div class=""><div data-cy="serp-item" class="after:bdr_r16 bd_b400">
    <a data-cy="job-link" id="vacancy-link-4d1e118f-25b2-4bde-9e0d-a29f5546d1fe" tabindex="0" title="Cobol Developer (m/w/d)" class="cursor_pointer" href="/en/vacancies/detail/4d1e118f-25b2-4bde-9e0d-a29f5546d1fe/" data-discover="true">
      <div data-cy="vacancy-serp-item">
        <div class="d_flex jc_space-between mb_s12"><span class="c_gray.700 d_flex gap_s8"><p class="mb_s0 textStyle_caption1 max-w_[min-content] white-space_nowrap">3 weeks ago</p></span></div>
        <div class="mb_s8"><span class="c_purple.900 fw_bold textStyle_body2">Cobol Developer (m/w/d)</span></div>
        <div class="d_flex c_gray.900 flex-d_column gap_s4">
          <div class="d_grid ai_start gap_s12"><span class="mt_s4 icon"></span><span class="pos_absolute">Place of work<!-- -->:</span><p class="mb_s12 lastOfType:mb_s0 textStyle_caption1">Dietikon</p></div>
          <div class="d_grid ai_start gap_s12"><span class="mt_s4 icon"></span><span class="pos_absolute">Workload<!-- -->:</span><p class="mb_s12 lastOfType:mb_s0 textStyle_caption1">60 – 100%</p></div>
          <div class="d_grid ai_start gap_s12"><span class="mt_s4 icon"></span><span class="pos_absolute">Contract type<!-- -->:</span><p class="mb_s12 lastOfType:mb_s0 textStyle_caption1">Permanent position</p></div>
        </div>
        <div class="d_grid ai_center gap_s12 mt_s12"><div class="avatarSquare"><picture></picture></div><p class="mb_s12 lastOfType:mb_s0 textStyle_caption1 c_gray.700 fw_bold">Planzer</p></div>
      </div>
    </a>
  </div></div>
  <div class=""><div data-cy="serp-item" class="after:bdr_r16 bd_b400">
    <a data-cy="job-link" id="vacancy-link-9104e56e-5af7-4681-af99-e3a846759e1e" tabindex="0" title="Software R&amp;D Engineer" class="cursor_pointer" href="/en/vacancies/detail/9104e56e-5af7-4681-af99-e3a846759e1e/" data-discover="true">
      <div data-cy="vacancy-serp-item">
        <div class="d_flex jc_space-between mb_s12"><span class="c_gray.700 d_flex gap_s8"><p class="mb_s0 textStyle_caption1 max-w_[min-content] white-space_nowrap">2 weeks ago</p></span></div>
        <div class="mb_s8"><span class="c_purple.900 fw_bold textStyle_body2">Software R&amp;D Engineer</span></div>
        <div class="d_flex c_gray.900 flex-d_column gap_s4">
          <div class="d_grid ai_start gap_s12"><span class="mt_s4 icon"></span><span class="pos_absolute">Place of work<!-- -->:</span><p class="mb_s12 lastOfType:mb_s0 textStyle_caption1">Zürich</p></div>
          <div class="d_grid ai_start gap_s12"><span class="mt_s4 icon"></span><span class="pos_absolute">Workload<!-- -->:</span><p class="mb_s12 lastOfType:mb_s0 textStyle_caption1">100%</p></div>
          <div class="d_grid ai_start gap_s12"><span class="mt_s4 icon"></span><span class="pos_absolute">Contract type<!-- -->:</span><p class="mb_s12 lastOfType:mb_s0 textStyle_caption1">Permanent position</p></div>
        </div>
        <div class="d_grid ai_center gap_s12 mt_s12"><div class="avatarSquare"><picture></picture></div><p class="mb_s12 lastOfType:mb_s0 textStyle_caption1 c_gray.700 fw_bold">aiEndoscopic AG</p></div>
      </div>
    </a>
  </div></div>
</div>`;
}

describe("parseTotalCount", () => {
  test("parses the scoped count span", () => {
    expect(
      parseTotalCount('<span class="c_gray.700 textStyle_caption1">257 jobs</span>'),
    ).toBe(257);
  });

  test("parses singular", () => {
    expect(parseTotalCount('<span class="c_gray.700 textStyle_caption1">1 job</span>')).toBe(1);
  });

  test("returns 0 when the span is missing", () => {
    expect(parseTotalCount("<p>nothing here</p>")).toBe(0);
  });

  test("does not false-positive on unrelated digit+jobs text elsewhere on the page", () => {
    const html =
      '<script>{"query":"asdkjaslkdjqwoiuxzcv12345 jobs board"}</script>' +
      '<span class="c_gray.700 textStyle_caption1">125 jobs</span>';
    expect(parseTotalCount(html)).toBe(125);
  });
});

describe("parseJobCards", () => {
  test("parses cards into a flat list", () => {
    const cards = parseJobCards(listingHtml());
    expect(cards).toHaveLength(2);

    expect(cards[0]).toEqual({
      id: "4d1e118f-25b2-4bde-9e0d-a29f5546d1fe",
      title: "Cobol Developer (m/w/d)",
      company: "Planzer",
      location: "Dietikon",
      date: "3 weeks ago",
      url: "https://www.jobs.ch/en/vacancies/detail/4d1e118f-25b2-4bde-9e0d-a29f5546d1fe/",
      workload: "60 – 100%",
      contractType: "Permanent position",
    });
  });

  test("decodes HTML entities in title and company", () => {
    const cards = parseJobCards(listingHtml());
    const second = cards[1];
    expect(second.title).toBe("Software R&D Engineer");
    expect(second.company).toBe("aiEndoscopic AG");
    expect(second.location).toBe("Zürich");
  });

  test("returns an empty array for a page with no job entries", () => {
    expect(parseJobCards("<div></div>")).toEqual([]);
  });
});

describe("extractJobPostingJsonLd / jobPostingToDetail", () => {
  function detailHtml(withSalary: boolean): string {
    const breadcrumb = {
      "@context": "http://schema.org/",
      "@type": "BreadcrumbList",
      itemListElement: [],
    };
    const posting: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Cobol Developer (m/w/d)",
      description: "<p>Build <strong>things</strong> with COBOL &amp; DB2.</p><p>Second para.</p>",
      datePosted: "2026-07-03T08:47:23+02:00",
      hiringOrganization: { "@type": "Organization", name: "Planzer" },
      jobLocation: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          streetAddress: "Lerzenstrasse 14",
          addressRegion: "Dietikon",
          postalCode: "8953",
          addressCountry: "CH",
        },
      },
      employmentType: "Permanent position",
      workHours: "25.2 - 42 hours/week",
      industry: "Transport / Logistics",
      baseSalary: {
        "@type": "MonetaryAmount",
        currency: "CHF",
        value: withSalary
          ? { "@type": "QuantitativeValue", minValue: 80000, maxValue: 100000, unitText: "YEAR" }
          : { "@type": "QuantitativeValue" },
      },
      potentialAction: {
        "@type": "ApplyAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: "https://www.jobs.ch/en/vacancies/detail/4d1e118f-25b2-4bde-9e0d-a29f5546d1fe/apply",
        },
      },
    };
    return `<html><head><script type="application/ld+json">${JSON.stringify(
      breadcrumb,
    )}</script><script type="application/ld+json">${JSON.stringify(posting)}</script></head></html>`;
  }

  test("scans past a BreadcrumbList to find the JobPosting", () => {
    const posting = extractJobPostingJsonLd(detailHtml(true));
    expect(posting).not.toBeNull();
    expect(posting!.title).toBe("Cobol Developer (m/w/d)");
  });

  test("returns null when there is no JobPosting JSON-LD", () => {
    expect(extractJobPostingJsonLd("<html><body>nothing here</body></html>")).toBeNull();
  });

  test("returns null on malformed JSON-LD", () => {
    const html = `<script type="application/ld+json">{not json}</script>`;
    expect(extractJobPostingJsonLd(html)).toBeNull();
  });

  test("maps a full JobPosting (with salary) to a JobDetail", () => {
    const posting = extractJobPostingJsonLd(detailHtml(true))!;
    const job = jobPostingToDetail(posting, "4d1e118f-25b2-4bde-9e0d-a29f5546d1fe");
    expect(job.id).toBe("4d1e118f-25b2-4bde-9e0d-a29f5546d1fe");
    expect(job.title).toBe("Cobol Developer (m/w/d)");
    expect(job.company).toBe("Planzer");
    expect(job.location).toBe("Lerzenstrasse 14, 8953 Dietikon, CH");
    expect(job.date).toBe("2026-07-03T08:47:23+02:00");
    expect(job.description).toBe("Build things with COBOL & DB2.\nSecond para.");
    expect(job.employmentType).toBe("Permanent position");
    expect(job.workHours).toBe("25.2 - 42 hours/week");
    expect(job.industry).toBe("Transport / Logistics");
    expect(job.salaryMin).toBe(80000);
    expect(job.salaryMax).toBe(100000);
    expect(job.salaryCurrency).toBe("CHF");
    expect(job.applyUrl).toBe(
      "https://www.jobs.ch/en/vacancies/detail/4d1e118f-25b2-4bde-9e0d-a29f5546d1fe/apply",
    );
    expect(job.url).toBe(detailUrl("4d1e118f-25b2-4bde-9e0d-a29f5546d1fe"));
  });

  test("treats an empty baseSalary.value as no salary data (not a fabricated 0)", () => {
    const posting = extractJobPostingJsonLd(detailHtml(false))!;
    const job = jobPostingToDetail(posting, "4d1e118f-25b2-4bde-9e0d-a29f5546d1fe");
    expect(job.salaryMin).toBeNull();
    expect(job.salaryMax).toBeNull();
    expect(job.salaryCurrency).toBeNull();
  });
});

describe("cleanDescription", () => {
  test("strips tags, decodes entities, and collapses blank lines", () => {
    const html = "<p>Go &amp; gRPC role</p><br><p>Location: Zürich</p>";
    expect(cleanDescription(html)).toBe("Go & gRPC role\n\nLocation: Zürich");
  });

  test("returns null for empty input", () => {
    expect(cleanDescription("")).toBeNull();
  });
});

describe("normalizeJobId", () => {
  test("accepts a bare uuid", () => {
    expect(normalizeJobId("4d1e118f-25b2-4bde-9e0d-a29f5546d1fe")).toBe(
      "4d1e118f-25b2-4bde-9e0d-a29f5546d1fe",
    );
  });

  test("extracts the uuid from a full /en/ URL", () => {
    expect(
      normalizeJobId("https://www.jobs.ch/en/vacancies/detail/4d1e118f-25b2-4bde-9e0d-a29f5546d1fe/"),
    ).toBe("4d1e118f-25b2-4bde-9e0d-a29f5546d1fe");
  });

  test("extracts the uuid from a /de/ or /fr/ URL too", () => {
    expect(
      normalizeJobId("https://www.jobs.ch/de/stellenangebote/detail/4d1e118f-25b2-4bde-9e0d-a29f5546d1fe/"),
    ).toBe("4d1e118f-25b2-4bde-9e0d-a29f5546d1fe");
    expect(
      normalizeJobId("https://www.jobs.ch/fr/offres-emplois/detail/4d1e118f-25b2-4bde-9e0d-a29f5546d1fe/"),
    ).toBe("4d1e118f-25b2-4bde-9e0d-a29f5546d1fe");
  });

  test("returns null for unparseable input", () => {
    expect(normalizeJobId("??")).toBeNull();
    expect(normalizeJobId("not-a-uuid")).toBeNull();
  });
});

describe("parseRelativeAge / matchesJobage", () => {
  test("parses known relative-date formats", () => {
    expect(parseRelativeAge("Today")).toBe(0);
    expect(parseRelativeAge("Yesterday")).toBe(1);
    expect(parseRelativeAge("Last week")).toBe(7);
    expect(parseRelativeAge("5 hours ago")).toBe(0);
    expect(parseRelativeAge("2 days ago")).toBe(2);
    expect(parseRelativeAge("3 weeks ago")).toBe(21);
    expect(parseRelativeAge("2 months ago")).toBe(60);
  });

  test("returns null for unrecognized text", () => {
    expect(parseRelativeAge("sometime last century")).toBeNull();
    expect(parseRelativeAge(null)).toBeNull();
  });

  test("matchesJobage keeps everything when no jobage filter is given", () => {
    expect(matchesJobage("3 weeks ago", undefined)).toBe(true);
  });

  test("matchesJobage filters by parsed age", () => {
    expect(matchesJobage("2 days ago", 7)).toBe(true);
    expect(matchesJobage("3 weeks ago", 7)).toBe(false);
  });

  test("matchesJobage keeps unrecognized dates (doesn't exclude what it can't parse)", () => {
    expect(matchesJobage("a very long time ago", 7)).toBe(true);
  });
});
