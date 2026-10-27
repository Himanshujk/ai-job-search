import { describe, test, expect } from "bun:test";
import {
  parseJobCards,
  parseTotalCount,
  extractJobPosting,
  jobPostingToDetail,
  cleanDescription,
  normalizeJobId,
  detailUrl,
} from "../src/helpers";

// Fixture mirrors the real jobup.ch /en/jobs/ markup structure (verified live
// 2026-07-22): the page embeds a schema.org ItemList of JobPosting objects as
// JSON-LD (the primary parse source), and each rendered HTML card additionally
// carries a "Place of work" / "Workload" pair keyed by a
// data-cy="serp-item-{uuid}" marker, used to backfill location when the
// JSON-LD address lacks addressLocality.
function listingHtml(): string {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: 2,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        item: {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          title: "Ingénieur DevOps (H/F)",
          description: "We are looking for a Ingénieur DevOps (H/F) to join our team.",
          identifier: { "@type": "PropertyValue", name: "jobup.ch", value: "31a7345a-7ef4-4bc2-ac45-d764d8fd6234" },
          datePosted: "2026-07-13T02:02:41+02:00",
          employmentType: "Permanent position",
          hiringOrganization: { "@type": "Organization", name: "Integraal Data Services" },
          // Deliberately no addressLocality here — this is the real-world gap
          // the HTML card backfills.
          jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressCountry: "CH" } },
          url: "https://www.jobup.ch/en/jobs/detail/31a7345a-7ef4-4bc2-ac45-d764d8fd6234/",
        },
      },
      {
        "@type": "ListItem",
        position: 2,
        item: {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          title: "Backend Software Engineer (kDrive)",
          description: "We are looking for a Backend Software Engineer (kDrive) to join our team.",
          identifier: { "@type": "PropertyValue", name: "jobup.ch", value: "eeb74dc4-4a47-4066-afa9-78ae4d888385" },
          datePosted: "2026-07-03T09:25:31+02:00",
          employmentType: "Permanent position",
          hiringOrganization: { "@type": "Organization", name: "infomaniak | The Ethical Cloud" },
          jobLocation: {
            "@type": "Place",
            address: { "@type": "PostalAddress", addressLocality: "Genève", addressCountry: "CH" },
          },
          url: "https://www.jobup.ch/en/jobs/detail/eeb74dc4-4a47-4066-afa9-78ae4d888385/",
        },
      },
    ],
  };

  const ldJson = JSON.stringify([
    { "@context": "https://schema.org", "@type": "WebSite", name: "jobup.ch" },
    { "@context": "https://schema.org", "@type": "CollectionPage", name: "2 Golang jobs - jobup.ch" },
    itemList,
  ]);

  return `<html><head><title>2 Golang job ads found on jobup.ch</title>
<script type="application/ld+json">${ldJson}</script>
</head><body>
<a href="/en/jobs/detail/31a7345a-7ef4-4bc2-ac45-d764d8fd6234/" data-discover="true">
  <div data-cy="vacancy-serp-item">
    <div data-cy="serp-item-31a7345a-7ef4-4bc2-ac45-d764d8fd6234">
      <span><p class="mb_s0 textStyle_caption1 max-w_[min-content] white-space_nowrap">Last week</p></span>
    </div>
    <div class="mb_s8"><span class="c_purple.900 fw_bold">Ingénieur DevOps (H/F)</span></div>
    <div>
      <div><span class="pos_absolute">Place of work<!-- -->:</span><p class="mb_s12 textStyle_caption1">Acacias</p></div>
      <div><span class="pos_absolute">Workload<!-- -->:</span><p class="mb_s12 textStyle_caption1">100%</p></div>
      <div><span class="pos_absolute">Contract type<!-- -->:</span><p class="mb_s12 textStyle_caption1">Permanent position</p></div>
    </div>
    <p class="mb_s12 textStyle_caption1 c_gray.700 fw_bold">Integraal Data Services</p>
  </div>
</a>
<a href="/en/jobs/detail/eeb74dc4-4a47-4066-afa9-78ae4d888385/" data-discover="true">
  <div data-cy="vacancy-serp-item">
    <div data-cy="serp-item-eeb74dc4-4a47-4066-afa9-78ae4d888385">
      <span><p class="mb_s0 textStyle_caption1 max-w_[min-content] white-space_nowrap">Today</p></span>
    </div>
    <div class="mb_s8"><span class="c_purple.900 fw_bold">Backend Software Engineer (kDrive)</span></div>
    <div>
      <div><span class="pos_absolute">Place of work<!-- -->:</span><p class="mb_s12 textStyle_caption1">Genève</p></div>
      <div><span class="pos_absolute">Workload<!-- -->:</span><p class="mb_s12 textStyle_caption1">80 – 100%</p></div>
      <div><span class="pos_absolute">Contract type<!-- -->:</span><p class="mb_s12 textStyle_caption1">Permanent position</p></div>
    </div>
    <p class="mb_s12 textStyle_caption1 c_gray.700 fw_bold">infomaniak | The Ethical Cloud</p>
  </div>
</a>
</body></html>`;
}

describe("parseTotalCount", () => {
  test("parses the count from the <title> tag", () => {
    expect(parseTotalCount("<title>66 Golang job ads found on jobup.ch</title>")).toBe(66);
  });

  test("parses zero results", () => {
    expect(
      parseTotalCount("<title>0 Golang job ads in Nonexistentcity found on jobup.ch</title>"),
    ).toBe(0);
  });

  test("parses a location-qualified title", () => {
    expect(parseTotalCount("<title>2 Golang job ads in Zurich found on jobup.ch</title>")).toBe(2);
  });

  test("returns 0 when the title is missing", () => {
    expect(parseTotalCount("<p>nothing here</p>")).toBe(0);
  });
});

describe("parseJobCards", () => {
  test("parses the JSON-LD ItemList into job cards", () => {
    const cards = parseJobCards(listingHtml());
    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual({
      id: "31a7345a-7ef4-4bc2-ac45-d764d8fd6234",
      title: "Ingénieur DevOps (H/F)",
      company: "Integraal Data Services",
      location: "Acacias",
      date: "2026-07-13T02:02:41+02:00",
      url: "https://www.jobup.ch/en/jobs/detail/31a7345a-7ef4-4bc2-ac45-d764d8fd6234/",
      employmentType: "Permanent position",
      workload: "100%",
      salary: null,
    });
  });

  test("backfills location from the HTML card when JSON-LD address lacks addressLocality", () => {
    const cards = parseJobCards(listingHtml());
    // The fixture's JSON-LD for card 1 deliberately has no addressLocality —
    // "Acacias" must come from the HTML card's "Place of work" text.
    expect(cards[0].location).toBe("Acacias");
  });

  test("uses the JSON-LD address when present, for the second card", () => {
    const cards = parseJobCards(listingHtml());
    expect(cards[1].company).toBe("infomaniak | The Ethical Cloud");
    expect(cards[1].workload).toBe("80 – 100%");
  });

  test("returns an empty array when there is no ItemList", () => {
    expect(parseJobCards("<html><head></head><body>no jobs here</body></html>")).toEqual([]);
  });
});

describe("extractJobPosting / jobPostingToDetail", () => {
  function detailHtml(): string {
    const breadcrumb = [
      { "@context": "http://schema.org/", "@type": "BreadcrumbList", itemListElement: [] },
    ];
    const posting = {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Backend Engineer (Golang)",
      description: "<p>Build <strong>things</strong> with Go &amp; gRPC.</p><p>Second para.</p>",
      datePosted: "2026-07-03T09:26:57+02:00",
      hiringOrganization: { "@type": "Organization", name: "infomaniak | The Ethical Cloud" },
      jobLocation: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          streetAddress: "25 rue Eugène-Marziano",
          addressRegion: "Geneve",
          postalCode: "1227",
          addressCountry: "CH",
        },
      },
      employmentType: "Permanent position",
      workHours: "42 - 42 hours/week",
      baseSalary: {
        "@type": "MonetaryAmount",
        currency: "CHF",
        value: { "@type": "QuantitativeValue", minValue: 90000, maxValue: 120000 },
      },
      url: "https://www.jobup.ch/en/jobs/detail/62b49136-23a4-4118-881c-59f91b7f01a4/",
    };
    return `<html><head>
<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
<script type="application/ld+json">${JSON.stringify(posting)}</script>
</head></html>`;
  }

  test("finds the JobPosting block even though BreadcrumbList comes first", () => {
    const posting = extractJobPosting(detailHtml());
    expect(posting).not.toBeNull();
    expect(posting!.title).toBe("Backend Engineer (Golang)");
  });

  test("returns null when there is no JobPosting block", () => {
    expect(extractJobPosting("<html><body>nothing here</body></html>")).toBeNull();
  });

  test("skips a malformed JSON-LD block but still finds a valid one", () => {
    const html = `<script type="application/ld+json">{not json}</script>
<script type="application/ld+json">{"@type":"JobPosting","title":"OK"}</script>`;
    const posting = extractJobPosting(html);
    expect(posting).not.toBeNull();
    expect(posting!.title).toBe("OK");
  });

  test("maps a full JobPosting to a JobDetail", () => {
    const posting = extractJobPosting(detailHtml())!;
    const job = jobPostingToDetail(posting, "62b49136-23a4-4118-881c-59f91b7f01a4");
    expect(job.id).toBe("62b49136-23a4-4118-881c-59f91b7f01a4");
    expect(job.title).toBe("Backend Engineer (Golang)");
    expect(job.company).toBe("infomaniak | The Ethical Cloud");
    expect(job.location).toBe("Geneve"); // address has only addressRegion, no addressLocality
    expect(job.date).toBe("2026-07-03T09:26:57+02:00");
    expect(job.description).toBe("Build things with Go & gRPC.\nSecond para.");
    expect(job.employmentType).toBe("Permanent position");
    expect(job.workHours).toBe("42 - 42 hours/week");
    expect(job.salaryMin).toBe(90000);
    expect(job.salaryMax).toBe(120000);
    expect(job.salaryCurrency).toBe("CHF");
    expect(job.applyUrl).toBeNull();
  });

  test("handles a posting with an empty baseSalary.value (no minValue/maxValue)", () => {
    const posting = {
      "@type": "JobPosting",
      title: "Intern Role",
      baseSalary: { "@type": "MonetaryAmount", currency: "CHF", value: {} },
    };
    const job = jobPostingToDetail(posting as any, "abc");
    expect(job.salaryMin).toBeNull();
    expect(job.salaryMax).toBeNull();
    expect(job.salaryCurrency).toBeNull();
  });
});

describe("cleanDescription", () => {
  test("strips tags, decodes entities, and collapses blank lines", () => {
    const html = "<p>Go &amp; gRPC role</p><br><p>Location: Zurich</p>";
    expect(cleanDescription(html)).toBe("Go & gRPC role\n\nLocation: Zurich");
  });

  test("returns null for empty input", () => {
    expect(cleanDescription("")).toBeNull();
    expect(cleanDescription(null)).toBeNull();
  });
});

describe("normalizeJobId", () => {
  test("accepts a bare UUID", () => {
    expect(normalizeJobId("31a7345a-7ef4-4bc2-ac45-d764d8fd6234")).toBe(
      "31a7345a-7ef4-4bc2-ac45-d764d8fd6234",
    );
  });

  test("extracts the UUID from a full jobup.ch detail URL", () => {
    expect(
      normalizeJobId("https://www.jobup.ch/en/jobs/detail/31a7345a-7ef4-4bc2-ac45-d764d8fd6234/"),
    ).toBe("31a7345a-7ef4-4bc2-ac45-d764d8fd6234");
  });

  test("returns null for unparseable input", () => {
    expect(normalizeJobId("not-a-uuid")).toBeNull();
    expect(normalizeJobId("??")).toBeNull();
  });
});

describe("detailUrl", () => {
  test("builds the canonical detail URL", () => {
    expect(detailUrl("31a7345a-7ef4-4bc2-ac45-d764d8fd6234")).toBe(
      "https://www.jobup.ch/en/jobs/detail/31a7345a-7ef4-4bc2-ac45-d764d8fd6234/",
    );
  });
});
