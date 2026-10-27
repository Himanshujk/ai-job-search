import {
  detailUrl,
  htmlFetch,
  extractLiveJobs,
  extractJobPosting,
  buildJobDetail,
  normalizeJobId,
  formatSeniority,
  formatRemoteLevel,
  formatVisaSponsorship,
  writeError,
} from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const ref = normalizeJobId(opts.id)
  if (!ref) {
    writeError(`Could not parse a job id or URL from "${opts.id}"`, "BAD_ID")
    return 1
  }

  try {
    const url = detailUrl(ref.company, ref.job)
    const html = await htmlFetch(url)
    if (!html) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    // The detail page embeds exactly one live job record (same shape as the
    // `/jobs` listing) plus the schema.org JobPosting JSON-LD for the description.
    const [job] = extractLiveJobs(html)
    if (!job) {
      writeError("Could not parse job detail page", "PARSE_FAILED")
      return 1
    }
    const posting = extractJobPosting(html)
    const detail = buildJobDetail(job, posting)
    return emit(detail, opts.format)
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}

function emit(job: ReturnType<typeof buildJobDetail>, format: "json" | "plain"): number {
  if (format === "plain") {
    const salary =
      job.salaryMin || job.salaryMax
        ? `${job.salaryCurrency || "JPY"} ${job.salaryMin ?? "?"}–${job.salaryMax ?? "?"}`
        : null
    const lines = [
      job.title,
      `${job.company || "—"} · ${job.location || "—"}`,
      "",
      job.seniority ? `Seniority: ${formatSeniority(job.seniority)}` : "",
      job.employmentType ? `Employment: ${job.employmentType}` : "",
      job.remoteLevel ? `Remote level: ${formatRemoteLevel(job.remoteLevel)}` : "",
      job.sponsorsVisa ? `Visa sponsorship: ${formatVisaSponsorship(job.sponsorsVisa)}` : "",
      job.englishLevel ? `English level: ${job.englishLevel}` : "",
      job.japaneseLevel ? `Japanese level: ${job.japaneseLevel}` : "",
      salary ? `Salary: ${salary}` : "",
      job.skills && job.skills.length ? `Skills: ${job.skills.join(", ")}` : "",
      "",
      job.description || "(no description)",
      "",
      `URL: ${job.url}`,
      job.applyUrl ? `Apply: ${job.applyUrl}` : "",
    ].filter((l) => l !== "")
    process.stdout.write(lines.join("\n") + "\n")
  } else {
    process.stdout.write(JSON.stringify(job, null, 2) + "\n")
  }
  return 0
}
