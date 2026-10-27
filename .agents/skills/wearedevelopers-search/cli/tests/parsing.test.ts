import { describe, expect, test } from "bun:test"
import { parseSearchResults, parseJobDetail, filterByJobAge, idFromUrl, parsePublishedDate } from "../src/helpers"

const SEARCH_FIXTURE = `> Markdown version of [/jobs?q=golang](https://www.wearedevelopers.com/jobs?q=golang).

---

# Developer Jobs

2 jobs found matching "golang"

## Senior Backend Engineer (Golang)

- **Company:** Kake
- **Location:** A Coruña, Spain (Remote available)
- **Contract:** Permanent contract
- **Published:** August 15, 2026
- [View job](https://www.wearedevelopers.com/jobs/ext/2066501-senior-backend-engineer-golang)
- [Apply](https://www.buscojobs.com.es/senior-backend-engineer-golang-en-la-coruna-ID-367390801)

## Tech Lead - Backend (Golang)

- **Company:** Oliver Bernard Ltd.
- **Location:** Valladolid, Spain (Remote available)
- **Salary:** €80,000.0 - €110,000.0
- **Contract:** Permanent contract
- **Published:** August 16, 2026
- [View job](https://www.wearedevelopers.com/jobs/ext/2087940-tech-lead-backend-golang-spain-remote)
- [Apply](https://www.buscojobs.com.es/tech-lead-backend-golang-spain-remote-en-valladolid-ID-367560415)

[Next page](https://www.wearedevelopers.com/jobs?page=2&q=golang)

## Filter by Country

- [Austria](https://www.wearedevelopers.com/jobs?country=AT)
- [Belgium](https://www.wearedevelopers.com/jobs?country=BE)
`

const DETAIL_FIXTURE = `> Markdown version of [/jobs/ext/2066501-senior-backend-engineer-golang](https://www.wearedevelopers.com/jobs/ext/2066501-senior-backend-engineer-golang).

---

# Senior Backend Engineer (Golang)

- **Company:** Kake
- **Location:** A Coruña, Spain (Remote available)
- **Contract:** Permanent contract
- **Skills:** Golang, AWS, Kubernetes, MongoDB
- **Published:** August 15, 2026
- **Apply:** https://www.buscojobs.com.es/senior-backend-engineer-golang-en-la-coruna-ID-367390801

## About the Role

Short preview text.

## Description

Full description text goes here across multiple sentences.

## Related Videos

- [Some video](https://www.wearedevelopers.com/videos/1-some-video)
`

describe("parseSearchResults", () => {
  test("parses job blocks and stops at Filter by Country", () => {
    const results = parseSearchResults(SEARCH_FIXTURE)
    expect(results).toHaveLength(2)

    expect(results[0].id).toBe("ext/2066501-senior-backend-engineer-golang")
    expect(results[0].title).toBe("Senior Backend Engineer (Golang)")
    expect(results[0].company).toBe("Kake")
    expect(results[0].location).toBe("A Coruña, Spain (Remote available)")
    expect(results[0].salary).toBeNull()
    expect(results[0].date).toBe("2026-08-15")
    expect(results[0].url).toBe("https://www.wearedevelopers.com/jobs/ext/2066501-senior-backend-engineer-golang")
    expect(results[0].applyUrl).toContain("buscojobs.com.es")

    expect(results[1].salary).toBe("€80,000.0 - €110,000.0")
  })

  test("returns empty array for a page with no job blocks", () => {
    expect(parseSearchResults("# Developer Jobs\n\nNo jobs found.")).toHaveLength(0)
  })
})

describe("parseJobDetail", () => {
  test("prefers Description over About the Role", () => {
    const job = parseJobDetail(DETAIL_FIXTURE, "ext/2066501-senior-backend-engineer-golang")
    expect(job.title).toBe("Senior Backend Engineer (Golang)")
    expect(job.company).toBe("Kake")
    expect(job.skills).toContain("Golang")
    expect(job.description).toBe("Full description text goes here across multiple sentences.")
    expect(job.applyUrl).toContain("buscojobs.com.es")
  })
})

describe("idFromUrl", () => {
  test("extracts the path segment after /jobs/", () => {
    expect(idFromUrl("https://www.wearedevelopers.com/jobs/ext/123-foo")).toBe("ext/123-foo")
  })
  test("returns null for a non-matching url", () => {
    expect(idFromUrl("https://www.wearedevelopers.com/videos/1-foo")).toBeNull()
  })
})

describe("parsePublishedDate", () => {
  test("parses a human date into ISO", () => {
    expect(parsePublishedDate("August 15, 2026")).toBe("2026-08-15")
  })
  test("returns null for unparseable input", () => {
    expect(parsePublishedDate("not a date")).toBeNull()
    expect(parsePublishedDate(null)).toBeNull()
  })
})

describe("filterByJobAge", () => {
  const cards = [
    { id: "1", title: "a", company: null, location: null, experience: null, salary: null, contract: null, date: new Date().toISOString().slice(0, 10), url: "u1", applyUrl: null },
    { id: "2", title: "b", company: null, location: null, experience: null, salary: null, contract: null, date: "2000-01-01", url: "u2", applyUrl: null },
    { id: "3", title: "c", company: null, location: null, experience: null, salary: null, contract: null, date: null, url: "u3", applyUrl: null },
  ]

  test("drops only cards older than the cutoff, keeps unknown dates", () => {
    const filtered = filterByJobAge(cards, 7)
    const ids = filtered.map((c) => c.id)
    expect(ids).toContain("1")
    expect(ids).toContain("3")
    expect(ids).not.toContain("2")
  })

  test("jobage 9999 (default) returns everything unfiltered", () => {
    expect(filterByJobAge(cards, 9999)).toHaveLength(3)
  })
})
