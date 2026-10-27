import {
  BASE_URL,
  htmlFetch,
  extractJobPostingJsonLd,
  jobPostingToDetail,
  normalizeJobId,
  writeError,
} from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const parsed = normalizeJobId(opts.id)
  if (!parsed) {
    writeError(`Could not parse a job id from "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    const html = await htmlFetch(`${BASE_URL}/companies/${parsed.company}/jobs/${parsed.job}`)
    if (!html) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const posting = extractJobPostingJsonLd(html)
    if (!posting) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job = jobPostingToDetail(posting, parsed.company, parsed.job)

    if (opts.format === "plain") {
      const salary =
        job.salaryMin != null
          ? `${job.salaryCurrency || ""} ${job.salaryMin.toLocaleString()} ~ ${
              job.salaryMax != null ? job.salaryMax.toLocaleString() : "?"
            } / year`.trim()
          : null
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.employmentType ? `Employment: ${job.employmentType}` : "",
        salary ? `Salary: ${salary}` : "",
        job.date ? `Posted: ${job.date}` : "",
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
        "Apply: use the URL above — tokyodev's tracked apply link (/c/...) is disallowed by robots.txt",
      ].filter((l) => l !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
