import { JOBS_BASE_URL, mdFetch, parseJobDetail, idFromUrl, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/** Accept a bare id (e.g. "ext/2066501-senior-backend-engineer-golang") or a full job URL. */
function normalizeId(input: string): string | null {
  if (input.includes("wearedevelopers.com")) {
    const id = idFromUrl(input)
    return id ? id.replace(/\.md$/, "") : null
  }
  return input.replace(/^\/?jobs\//, "").replace(/\.md$/, "") || null
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(`Could not parse a job id from "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    const markdown = await mdFetch(`${JOBS_BASE_URL}${id}.md`)
    if (!markdown) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job = parseJobDetail(markdown, id)

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.contract ? `Contract: ${job.contract}` : "",
        job.experience ? `Experience: ${job.experience}` : "",
        job.salary ? `Salary: ${job.salary}` : "",
        job.skills ? `Skills: ${job.skills}` : "",
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
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
