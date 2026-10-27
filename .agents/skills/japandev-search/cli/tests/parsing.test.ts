import { describe, test, expect } from "bun:test";
import {
  extractLiveJobs,
  liveJobToCard,
  cleanDescription,
  matchesQuery,
  matchesLocation,
  matchesRemote,
  matchesVisa,
  matchesJobage,
  remoteLevelsForMode,
  visaValueForFlag,
  normalizeJobId,
  extractJobPosting,
  buildJobDetail,
  formatSeniority,
  formatRemoteLevel,
  formatVisaSponsorship,
  type LiveJob,
} from "../src/helpers";

/**
 * A minimal Nuxt devalue pool mirroring the real site's shape: a job object
 * whose property values are integer refs into the flat array, plus a decoy
 * `_highlightResult` object with the exact same key fingerprint (sponsors_visas /
 * employment_type / title) but every value wrapped as `{value: ...}` — exactly
 * how japan-dev.com's real payload embeds Algolia's highlight/snippet mirror of
 * each hit. `extractLiveJobs` must find the real job and skip the decoy.
 */
function fixturePool(): unknown[] {
  return [
    0, // 0: unused root
    {
      // 1: the real job object — each value is an index; pool[that index] holds
      // the actual data (a leaf, or an array/object to keep resolving into).
      title: 2,
      slug: 3,
      company: 4,
      company_name: 5,
      location: 6,
      published_at: 7,
      job_post_date: 8,
      application_url: 9,
      salary_min: 10,
      salary_max: 11,
      has_salary_data: 12,
      sponsors_visas: 13,
      remote_level: 14,
      seniority_level: 15,
      employment_type: 16,
      contract_type: 17,
      english_level: 18,
      japanese_level: 19,
      skill_names: 20,
      _highlightResult: 21,
    },
    "Backend Engineer (Go)", // 2 title
    "acme-backend-engineer-go-abc123", // 3 slug
    { name: 5, slug: 22 }, // 4 company object (data lives HERE, not a further index)
    "Acme Corp", // 5 company_name (reused by company.name above)
    "Tokyo", // 6 location
    "2026-07-20T00:00:00.000Z", // 7 published_at
    "Jul 20, 2026", // 8 job_post_date
    "https://ats.example.com/apply", // 9 application_url
    9000000, // 10 salary_min
    12000000, // 11 salary_max
    true, // 12 has_salary_data
    "sponsors_visas_yes", // 13
    "remote_level_partial", // 14
    "seniority_level_senior", // 15
    "employment_type_full_time", // 16
    "Full-time", // 17 contract_type
    "Not Required", // 18 english_level
    "Conversational", // 19 japanese_level
    [23, 24], // 20 skill_names array (data lives here directly)
    { title: 25, sponsors_visas: 26, employment_type: 27 }, // 21 decoy: same fingerprint, wrapped values
    "acme", // 22 company slug
    "Go", // 23
    "Docker", // 24
    { value: "Backend Engineer (Go)" }, // 25 decoy title (object, not string)
    { value: "sponsors_visas_yes" }, // 26 decoy
    { value: "employment_type_full_time" }, // 27 decoy
  ];
}

function fixtureHtml(pool: unknown[] = fixturePool()): string {
  return `<html><body><script id="__NUXT_DATA__" type="application/json">${JSON.stringify(
    pool,
  )}</script></body></html>`;
}

describe("extractLiveJobs", () => {
  test("resolves a real job's devalue-referenced fields and skips its _highlightResult decoy", () => {
    const jobs = extractLiveJobs(fixtureHtml());
    expect(jobs).toHaveLength(1);
    const job = jobs[0];
    expect(job.title).toBe("Backend Engineer (Go)");
    expect(job.slug).toBe("acme-backend-engineer-go-abc123");
    expect(job.company).toBe("Acme Corp");
    expect(job.companySlug).toBe("acme");
    expect(job.id).toBe("acme/acme-backend-engineer-go-abc123");
    expect(job.location).toBe("Tokyo");
    expect(job.publishedAt).toBe("2026-07-20T00:00:00.000Z");
    expect(job.sponsorsVisas).toBe("sponsors_visas_yes");
    expect(job.remoteLevel).toBe("remote_level_partial");
    expect(job.seniorityLevel).toBe("seniority_level_senior");
    expect(job.hasSalaryData).toBe(true);
    expect(job.salaryMin).toBe(9000000);
    expect(job.salaryMax).toBe(12000000);
    expect(job.skillNames).toEqual(["Go", "Docker"]);
    expect(job.applicationUrl).toBe("https://ats.example.com/apply");
  });

  test("returns an empty array when there's no __NUXT_DATA__ script", () => {
    expect(extractLiveJobs("<html><body>nothing here</body></html>")).toEqual([]);
  });

  test("returns an empty array when the payload is malformed JSON", () => {
    const html = `<script id="__NUXT_DATA__" type="application/json">{not json}</script>`;
    expect(extractLiveJobs(html)).toEqual([]);
  });
});

describe("liveJobToCard", () => {
  test("never omits required fields — nulls instead", () => {
    const jobs = extractLiveJobs(fixtureHtml());
    const card = liveJobToCard(jobs[0]);
    expect(card).toEqual({
      id: "acme/acme-backend-engineer-go-abc123",
      title: "Backend Engineer (Go)",
      company: "Acme Corp",
      location: "Tokyo",
      date: "2026-07-20T00:00:00.000Z",
      url: "https://japan-dev.com/jobs/acme/acme-backend-engineer-go-abc123",
    });
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

function baseJob(overrides: Partial<LiveJob> = {}): LiveJob {
  return {
    id: "acme/job",
    slug: "job",
    title: "Backend Engineer (Go)",
    company: "Acme Corp",
    companySlug: "acme",
    location: "Tokyo",
    publishedAt: new Date().toISOString(),
    jobPostDate: null,
    applicationUrl: null,
    salaryMin: null,
    salaryMax: null,
    hasSalaryData: false,
    sponsorsVisas: "sponsors_visas_yes",
    remoteLevel: "remote_level_partial",
    seniorityLevel: "seniority_level_senior",
    employmentType: "employment_type_full_time",
    contractType: "Full-time",
    englishLevel: "Not Required",
    japaneseLevel: "Not Required",
    skillNames: ["Go", "Docker"],
    ...overrides,
  };
}

describe("matchesQuery", () => {
  test("matches when every query word appears across title/skills/company", () => {
    expect(matchesQuery(baseJob(), "go backend")).toBe(true);
  });

  test("is case-insensitive", () => {
    expect(matchesQuery(baseJob(), "DOCKER")).toBe(true);
  });

  test("requires ALL words to match (AND, not OR)", () => {
    expect(matchesQuery(baseJob(), "go xyzzyunlikely")).toBe(false);
  });

  test("matches on skill_names even if not in the title", () => {
    expect(matchesQuery(baseJob({ title: "Site Reliability Engineer" }), "docker")).toBe(true);
  });

  test("no query means everything matches", () => {
    expect(matchesQuery(baseJob(), undefined)).toBe(true);
  });
});

describe("matchesLocation / matchesRemote / matchesVisa / matchesJobage", () => {
  test("matchesLocation is case-insensitive exact match", () => {
    expect(matchesLocation(baseJob({ location: "Tokyo" }), "tokyo")).toBe(true);
    expect(matchesLocation(baseJob({ location: "Osaka" }), "tokyo")).toBe(false);
    expect(matchesLocation(baseJob(), undefined)).toBe(true);
  });

  test("matchesRemote maps remote/hybrid/onsite to remote_level groups", () => {
    expect(matchesRemote(baseJob({ remoteLevel: "remote_level_full_worldwide" }), "remote")).toBe(true);
    expect(matchesRemote(baseJob({ remoteLevel: "remote_level_partial" }), "remote")).toBe(false);
    expect(matchesRemote(baseJob({ remoteLevel: "remote_level_partial" }), "hybrid")).toBe(true);
    expect(matchesRemote(baseJob(), undefined)).toBe(true);
  });

  test("matchesVisa maps yes/no to sponsors_visas value", () => {
    expect(matchesVisa(baseJob({ sponsorsVisas: "sponsors_visas_yes" }), "yes")).toBe(true);
    expect(matchesVisa(baseJob({ sponsorsVisas: "sponsors_visas_no" }), "yes")).toBe(false);
    expect(matchesVisa(baseJob(), undefined)).toBe(true);
  });

  test("matchesJobage filters by published_at against a day cutoff", () => {
    const recent = baseJob({ publishedAt: new Date().toISOString() });
    const old = baseJob({ publishedAt: new Date(Date.now() - 400 * 86400000).toISOString() });
    expect(matchesJobage(recent, 30)).toBe(true);
    expect(matchesJobage(old, 30)).toBe(false);
    expect(matchesJobage(baseJob(), undefined)).toBe(true);
  });

  test("matchesJobage is false when publishedAt is missing but a cutoff is requested", () => {
    expect(matchesJobage(baseJob({ publishedAt: null }), 30)).toBe(false);
  });
});

describe("remoteLevelsForMode / visaValueForFlag", () => {
  test("remoteLevelsForMode maps known modes, null otherwise", () => {
    expect(remoteLevelsForMode("remote")).toEqual(["remote_level_full_worldwide", "remote_level_full_japan"]);
    expect(remoteLevelsForMode("onsite")).toEqual(["remote_level_none", "remote_level_around_office"]);
    expect(remoteLevelsForMode(undefined)).toBeNull();
  });

  test("visaValueForFlag maps yes/no, null otherwise", () => {
    expect(visaValueForFlag("yes")).toBe("sponsors_visas_yes");
    expect(visaValueForFlag("no")).toBe("sponsors_visas_no");
    expect(visaValueForFlag("maybe")).toBeNull();
  });
});

describe("normalizeJobId", () => {
  test("accepts a bare company/job pair", () => {
    expect(normalizeJobId("acme/backend-engineer")).toEqual({ company: "acme", job: "backend-engineer" });
  });

  test("extracts company/job from a full URL", () => {
    expect(normalizeJobId("https://japan-dev.com/jobs/acme/backend-engineer-abc123")).toEqual({
      company: "acme",
      job: "backend-engineer-abc123",
    });
  });

  test("returns null for unparseable input", () => {
    expect(normalizeJobId("??")).toBeNull();
  });
});

describe("extractJobPosting", () => {
  test("finds the JobPosting block among several ld+json scripts", () => {
    const html = `
      <script type="application/ld+json">{"@type":"WebSite","name":"x"}</script>
      <script type="application/ld+json">{"@type":"JobPosting","description":"desc"}</script>
    `;
    expect(extractJobPosting(html)?.description).toBe("desc");
  });

  test("returns null when no JobPosting block is present", () => {
    expect(extractJobPosting(`<script type="application/ld+json">{"@type":"WebSite"}</script>`)).toBeNull();
  });

  test("skips malformed JSON and keeps scanning", () => {
    const html = `
      <script type="application/ld+json">{not json}</script>
      <script type="application/ld+json">{"@type":"JobPosting","description":"OK"}</script>
    `;
    expect(extractJobPosting(html)?.description).toBe("OK");
  });
});

describe("buildJobDetail", () => {
  test("merges the live job record with the JobPosting description", () => {
    const job = baseJob({ hasSalaryData: true, salaryMin: 8000000, salaryMax: 10000000 });
    const posting = { description: "<p>Build <strong>things</strong>.</p>" };
    const detail = buildJobDetail(job, posting);
    expect(detail.id).toBe("acme/job");
    expect(detail.description).toBe("Build things.");
    expect(detail.remoteLevel).toBe("remote_level_partial");
    expect(detail.sponsorsVisa).toBe("sponsors_visas_yes");
    expect(detail.salaryMin).toBe(8000000);
    expect(detail.salaryMax).toBe(10000000);
    expect(detail.salaryCurrency).toBe("JPY");
    expect(detail.skills).toEqual(["Go", "Docker"]);
  });

  test("salary is null when has_salary_data is false, even if min/max are set", () => {
    const job = baseJob({ hasSalaryData: false, salaryMin: 8000000, salaryMax: 10000000 });
    const detail = buildJobDetail(job, null);
    expect(detail.salaryMin).toBeNull();
    expect(detail.salaryMax).toBeNull();
    expect(detail.salaryCurrency).toBeNull();
  });

  test("description is null when there's no JobPosting", () => {
    expect(buildJobDetail(baseJob(), null).description).toBeNull();
  });

  test("employmentType prefers JobPosting's schema.org value over the live payload's contract_type", () => {
    const job = baseJob({ contractType: "Full-time" });
    const withPosting = buildJobDetail(job, { employmentType: "FULL_TIME" });
    expect(withPosting.employmentType).toBe("Full Time");
  });

  test("employmentType falls back to contract_type when JobPosting lacks employmentType", () => {
    // Real gap found 2026-07-22: detail pages often omit contract_type from their own
    // live payload (present on the listing page for the same job) — JobPosting is the
    // more reliable source, but this covers the case where neither has it cleanly.
    const job = baseJob({ contractType: "Full-time" });
    expect(buildJobDetail(job, null).employmentType).toBe("Full-time");
    expect(buildJobDetail(job, {}).employmentType).toBe("Full-time");
  });
});

describe("format* label helpers", () => {
  test("formatSeniority/RemoteLevel/VisaSponsorship map known enums to readable labels", () => {
    expect(formatSeniority("seniority_level_senior")).toBe("Senior");
    expect(formatRemoteLevel("remote_level_partial")).toBe("Hybrid");
    expect(formatVisaSponsorship("sponsors_visas_no")).toBe("No");
  });

  test("unknown values pass through as-is rather than throwing", () => {
    expect(formatSeniority("seniority_level_totally_new")).toBe("seniority_level_totally_new");
  });

  test("null passes through as null", () => {
    expect(formatSeniority(null)).toBeNull();
  });
});
