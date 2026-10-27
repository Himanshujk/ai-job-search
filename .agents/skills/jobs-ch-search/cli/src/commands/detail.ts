import {
  htmlFetch,
  detailUrl,
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
  const id = normalizeJobId(opts.id)
  if (!id) {
    writeError(`Could not parse a job id from "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    const html = await htmlFetch(detailUrl(id))
    if (!html) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const posting = extractJobPostingJsonLd(html)
    if (!posting) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job = jobPostingToDetail(posting, id)

    if (opts.format === "plain") {
      const salary =
        job.salaryMin != null || job.salaryMax != null
          ? `${job.salaryCurrency || ""} ${job.salaryMin != null ? job.salaryMin.toLocaleString() : "?"} ~ ${
              job.salaryMax != null ? job.salaryMax.toLocaleString() : "?"
            }`.trim()
          : null
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.employmentType ? `Employment: ${job.employmentType}` : "",
        job.workHours ? `Work hours: ${job.workHours}` : "",
        salary ? `Salary: ${salary}` : "",
        job.industry ? `Industry: ${job.industry}` : "",
        job.date ? `Posted: ${job.date}` : "",
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
        job.applyUrl ? `Apply: ${job.applyUrl}` : "Apply: use the URL above",
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
