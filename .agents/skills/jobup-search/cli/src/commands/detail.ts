import {
  detailUrl,
  htmlFetch,
  extractJobPosting,
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
    const posting = extractJobPosting(html)
    if (!posting) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job = jobPostingToDetail(posting, id)

    if (opts.format === "plain") {
      const salary =
        job.salaryMin != null || job.salaryMax != null
          ? `${job.salaryCurrency || ""} ${job.salaryMin?.toLocaleString() ?? "?"} ~ ${
              job.salaryMax?.toLocaleString() ?? "?"
            } / year`.trim()
          : null
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.employmentType ? `Employment: ${job.employmentType}` : "",
        job.workHours ? `Hours: ${job.workHours}` : "",
        salary ? `Salary: ${salary}` : "",
        job.date ? `Posted: ${job.date}` : "",
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
        "Apply: use the URL above — jobup.ch's apply flow is client-side only and robots.txt disallows /en/application/*",
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
