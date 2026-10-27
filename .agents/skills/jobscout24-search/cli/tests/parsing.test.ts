import { describe, test, expect } from "bun:test";
import {
  parseJobCards,
  parseTotalCount,
  extractJobPosting,
  jobPostingToDetail,
  cleanDescription,
  slugifyLocation,
  buildSearchUrl,
  normalizeJobId,
  approxAgeDays,
  matchesJobage,
} from "../src/helpers";

// Fixture mirrors the real jobscout24.ch /en/jobs/ markup (verified live 2026-07-22):
// a flat list of `<li class="job-list-item ...">` entries, including a "webjob"
// (aggregated from the web) entry after the "Further jobs from the web" separator.
function listingHtml(): string {
  return `
<div class="result-stats fill" data-total-job-count="4">
</div>
<ul>
	<li class="job-list-item "
		data-job-id="10307367"
		data-job-detail-url="/en/job/e1cc5e14-e51d-43db-8816-3dc039a268fb/"
		data-offer-id="jbs_50"
         >
			<div class="upper-line">
	<a href="/en/job/e1cc5e14-e51d-43db-8816-3dc039a268fb/"
       class="job-link-detail job-title"
       title="Senior Backend Engineer - Golang (f/m/d)"
       >Senior Backend Engineer - Golang (f/m/d)</a>
	</div>
	<p class="job-attributes">
			<span>SMG Swiss Marketplace Group</span>
		, 					<span>Zurich</span>
	</p>
	<div class="lower-line ">
		<div class="job-tags">
			<ul>
					<li>
						<span class="tag tag-readonly">80% - 100%</span>
					</li>
                    <li>
                        <span class="tag tag-readonly">SME</span>
                    </li>
			</ul>
		</div>
		<p class="job-date">
			5 d
		</p>
	</div>
	</li>
	<li class="job-list-item "
		data-job-id="10302575"
		data-job-detail-url="/en/job/96df398a-99a7-4f88-bf3c-e3da8f8dd5ca/"
		data-offer-id="jbs_48"
         >
			<div class="upper-line">
	<a href="/en/job/96df398a-99a7-4f88-bf3c-e3da8f8dd5ca/"
       class="job-link-detail job-title"
       title="DevOps Plattform Engineer"
       >DevOps Plattform Engineer</a>
	</div>
	<p class="job-attributes">
			<span>LGT</span>
		, 					<span>Bendern, Z&#252;rich</span>
	</p>
	<div class="lower-line ">
		<div class="job-tags">
			<ul>
			</ul>
		</div>
		<p class="job-date">
			New
		</p>
	</div>
	</li>
                <li>
                    <div class="web-jobs-separator"><span>Further jobs from the web</span></div>
                </li>
	<li class="job-list-item webjob"
		data-job-id="117477611"
		data-job-detail-url="/en/job/ec72b4c5-0b54-4c57-b1c8-3307edb70bdf/"
		data-offer-id="web"
         >
			<div class="upper-line">
	<a href="/en/job/ec72b4c5-0b54-4c57-b1c8-3307edb70bdf/"
       class="job-link-detail job-title"
       title="Senior Backend Engineer - Golang (web)"
       >Senior Backend Engineer - Golang (web)</a>
	</div>
	<p class="job-attributes">
			<span>Some Other Co</span>
		, 					<span>Geneva</span>
	</p>
	<div class="lower-line ">
		<div class="job-tags">
			<ul>
			</ul>
		</div>
		<p class="job-date">
			1+m
		</p>
	</div>
	</li>
</ul>`;
}

describe("parseTotalCount", () => {
  test("parses the data-total-job-count attribute", () => {
    expect(parseTotalCount(listingHtml())).toBe(4);
  });

  test("falls back to the title's 'N vacancies' text", () => {
    expect(parseTotalCount("<title>Golang jobs - 4 vacancies on JobScout24</title>")).toBe(4);
  });

  test("falls back to singular 'vacancy'", () => {
    expect(parseTotalCount("<title>Golang jobs - 1 vacancy on JobScout24</title>")).toBe(1);
  });

  test("returns 0 when no count is present", () => {
    expect(parseTotalCount("<p>nothing here</p>")).toBe(0);
  });
});

describe("parseJobCards", () => {
  test("parses job entries including a webjob entry", () => {
    const cards = parseJobCards(listingHtml());
    expect(cards).toHaveLength(3);

    expect(cards[0]).toEqual({
      id: "e1cc5e14-e51d-43db-8816-3dc039a268fb",
      title: "Senior Backend Engineer - Golang (f/m/d)",
      company: "SMG Swiss Marketplace Group",
      location: "Zurich",
      date: "5 d",
      url: "https://www.jobscout24.ch/en/job/e1cc5e14-e51d-43db-8816-3dc039a268fb/",
      workload: "80% - 100%",
    });
  });

  test("decodes HTML entities and handles no workload tag", () => {
    const cards = parseJobCards(listingHtml());
    const lgt = cards[1];
    expect(lgt.company).toBe("LGT");
    expect(lgt.location).toBe("Bendern, Zürich");
    expect(lgt.date).toBe("New");
    expect(lgt.workload).toBeNull();
  });

  test("parses webjob entries the same way as regular ones", () => {
    const cards = parseJobCards(listingHtml());
    const webjob = cards[2];
    expect(webjob.id).toBe("ec72b4c5-0b54-4c57-b1c8-3307edb70bdf");
    expect(webjob.company).toBe("Some Other Co");
    expect(webjob.date).toBe("1+m");
  });

  test("returns an empty array for a page with no job entries", () => {
    expect(parseJobCards("<ul></ul>")).toEqual([]);
  });
});

describe("extractJobPosting / jobPostingToDetail", () => {
  // Fixture mirrors the real detail-page JSON-LD (verified live 2026-07-22): an
  // array containing both a JobPosting and a BreadcrumbList, inside a single
  // <script> tag that also carries a CSP nonce attribute.
  function detailHtml(): string {
    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title: "Senior Backend Engineer - Golang (f/m/d)",
        description: "<p>Build <strong>things</strong> with Go.</p><p>Second para.</p>",
        datePosted: "2026-07-21T20:03:48.7600000",
        jobLocation: {
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Zurich",
            addressRegion: "CH",
            addressCountry: "CH",
          },
        },
        employmentType: ["FULL_TIME", "PART_TIME"],
        industry: "Information Technology",
        occupationalCategory: "Software Development",
        hiringOrganization: { "@type": "Organization", name: "SMG Swiss Marketplace Group" },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [],
      },
    ];
    return `<html><head><script type="application/ld+json" nonce="abc123==">${JSON.stringify(jsonLd)}</script></head></html>`;
  }

  test("extracts the JobPosting from the JSON-LD array, ignoring the BreadcrumbList", () => {
    const posting = extractJobPosting(detailHtml());
    expect(posting).not.toBeNull();
    expect(posting!.title).toBe("Senior Backend Engineer - Golang (f/m/d)");
  });

  test("returns null when there is no JobPosting JSON-LD", () => {
    expect(extractJobPosting("<html><body>nothing here</body></html>")).toBeNull();
  });

  test("returns null on malformed JSON-LD", () => {
    const html = `<script type="application/ld+json">{not json}</script>`;
    expect(extractJobPosting(html)).toBeNull();
  });

  test("maps a full JobPosting (array employmentType) to a JobDetail", () => {
    const posting = extractJobPosting(detailHtml())!;
    const job = jobPostingToDetail(posting, "e1cc5e14-e51d-43db-8816-3dc039a268fb");
    expect(job.id).toBe("e1cc5e14-e51d-43db-8816-3dc039a268fb");
    expect(job.title).toBe("Senior Backend Engineer - Golang (f/m/d)");
    expect(job.company).toBe("SMG Swiss Marketplace Group");
    expect(job.location).toBe("Zurich, CH, CH");
    expect(job.date).toBe("2026-07-21T20:03:48.7600000");
    expect(job.description).toBe("Build things with Go.\nSecond para.");
    expect(job.employmentType).toBe("Full Time, Part Time");
    expect(job.industry).toBe("Information Technology");
    expect(job.occupationalCategory).toBe("Software Development");
    expect(job.applyUrl).toBeNull();
    expect(job.url).toBe("https://www.jobscout24.ch/en/job/e1cc5e14-e51d-43db-8816-3dc039a268fb/");
  });

  test("handles a posting with a single-string employmentType", () => {
    const posting = { "@type": "JobPosting", title: "Intern Role", employmentType: "FULL_TIME" };
    const job = jobPostingToDetail(posting as any, "some-id");
    expect(job.employmentType).toBe("Full Time");
  });
});

describe("cleanDescription", () => {
  test("strips tags, decodes entities, and collapses blank lines", () => {
    const html = "<p>Go &amp; gRPC role</p><br><p>Location: Z&#252;rich</p>";
    expect(cleanDescription(html)).toBe("Go & gRPC role\n\nLocation: Zürich");
  });

  test("returns null for empty input", () => {
    expect(cleanDescription("")).toBeNull();
  });
});

describe("slugifyLocation", () => {
  test("lowercases and hyphenates", () => {
    expect(slugifyLocation("St. Gallen")).toBe("st-gallen");
  });

  test("strips diacritics", () => {
    expect(slugifyLocation("Zürich")).toBe("zurich");
  });

  test("collapses multiple separators", () => {
    expect(slugifyLocation("  Basel-Stadt  ")).toBe("basel-stadt");
  });
});

describe("buildSearchUrl", () => {
  test("builds the plain /en/jobs/ URL with SearchWhat", () => {
    expect(buildSearchUrl("golang", undefined, 1)).toBe(
      "https://www.jobscout24.ch/en/jobs/?SearchWhat=golang",
    );
  });

  test("builds the /en/jobs-in-{city}/ URL when a location is given", () => {
    expect(buildSearchUrl("developer", "Zurich", 1)).toBe(
      "https://www.jobscout24.ch/en/jobs-in-zurich/?SearchWhat=developer",
    );
  });

  test("only appends p= for page > 1", () => {
    expect(buildSearchUrl("developer", undefined, 1)).not.toContain("p=");
    expect(buildSearchUrl("developer", undefined, 2)).toContain("p=2");
  });

  test("returns the bare listing URL with no query/location", () => {
    expect(buildSearchUrl(undefined, undefined, 1)).toBe("https://www.jobscout24.ch/en/jobs/");
  });
});

describe("normalizeJobId", () => {
  test("accepts a bare id", () => {
    expect(normalizeJobId("e1cc5e14-e51d-43db-8816-3dc039a268fb")).toBe(
      "e1cc5e14-e51d-43db-8816-3dc039a268fb",
    );
  });

  test("extracts the id from a full jobscout24 job URL", () => {
    expect(
      normalizeJobId("https://www.jobscout24.ch/en/job/e1cc5e14-e51d-43db-8816-3dc039a268fb/"),
    ).toBe("e1cc5e14-e51d-43db-8816-3dc039a268fb");
  });

  test("returns null for unparseable input", () => {
    expect(normalizeJobId("??")).toBeNull();
    expect(normalizeJobId("")).toBeNull();
  });
});

describe("approxAgeDays / matchesJobage", () => {
  test("parses 'New' as 0 days", () => {
    expect(approxAgeDays("New")).toBe(0);
  });

  test("parses days and weeks", () => {
    expect(approxAgeDays("5 d")).toBe(5);
    expect(approxAgeDays("2 w")).toBe(14);
  });

  test("parses the '1+m' month bucket as a 30-day lower bound", () => {
    expect(approxAgeDays("1+m")).toBe(30);
  });

  test("returns null for unrecognized text", () => {
    expect(approxAgeDays("whenever")).toBeNull();
    expect(approxAgeDays(null)).toBeNull();
  });

  test("matchesJobage passes everything through when no jobage filter is given", () => {
    expect(matchesJobage("1+m", undefined)).toBe(true);
  });

  test("matchesJobage excludes entries older than the requested window", () => {
    expect(matchesJobage("5 d", 3)).toBe(false);
    expect(matchesJobage("2 d", 3)).toBe(true);
    expect(matchesJobage("1+m", 7)).toBe(false);
  });

  test("matchesJobage keeps unrecognized-format entries rather than dropping them", () => {
    expect(matchesJobage("whenever", 3)).toBe(true);
  });
});
