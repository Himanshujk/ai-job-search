# Search Queries for Job Scraper

## Installed portal CLIs (primary for `/scrape`)

`/scrape` discovers every portal skill under `.agents/skills/*/SKILL.md` and runs its CLI first. Shipped country-agnostic CLIs include `linkedin-search` and `freehire-search`; Danish demos and any skill you add with `/add-portal` are included the same way. You do **not** need a matching `site:` line below for those CLIs to run.

The `site:` query templates in this file are the **WebSearch fallback** — for portals without a CLI, company career pages, or when a CLI fails.

**Language scope:** write every query category in every language listed in your CLAUDE.md Languages table (typically 1-2, sometimes more). A posting requiring a language you have *not* declared, as a job condition, is excluded before scoring; a posting requiring a *higher level* than you declared in a language you *do* work in is flagged for your own judgment, not excluded — see `04-job-evaluation.md`'s Language Gate, the single source of truth for this rule. Translate each category's keywords rather than machine-translating word-for-word (e.g. "Frontend Developer" -> "Desarrollador Frontend", not a literal word-for-word translation) if you work in more than one language.

## Search Sites

Primary:
- **linkedin.com/jobs** - LinkedIn job listings (filter: Remote / India / worldwide)
- **naukri.com** - largest Indian job board
- **hiringcafe.com** - AI-aggregated global job board (Workday/Greenhouse/Breezy/etc. postings), strong remote coverage
- **japan-dev.com** - curated English-language Japan tech job board, strong visa-sponsorship/remote filtering
- **tokyodev.com** - largest English-language Japan tech job board, salary-transparent
- **jobs.ch** - Switzerland's leading job board, broad coverage, semantic (not keyword) search
- **jobup.ch** - major Swiss job board (same publisher group as jobs.ch, distinct listings)
- **jobscout24.ch** - Swiss job board, English-language listing chrome with mixed-language postings
- **wearedevelopers.com** - global English-language developer job board, strong European coverage (AT/BE/DE/ES/FR/IT/LT/NL/RS/UK/US/VN + all-countries); has an official agent-friendly Markdown API (no scraping)
- **wellfound.com** (AngelList Talent) - startup/remote-friendly roles
- **weworkremotely.com** - remote-only roles, international
- **remoteok.com** - remote-only roles, international
- **indeed.com** - general job board, India + international

Secondary (company career pages via Google):
- Direct Google searches with `site:` filters for known target companies

Note: this framework's built-in CLI tools (Jobindex, Jobbank, Jobdanmark, Jobnet) are Denmark-specific and not relevant here. Rely on LinkedIn, Naukri, and Google `site:` searches on the boards above, or add new portal integrations via `/add-portal` if a specific site should be scraped directly.

For hiringcafe.com specifically, prefer the `hiringcafe-search` skill/CLI directly (`bun run skills/hiringcafe-search/cli/src/cli.ts search -q "<query>"`) over a Google `site:` search — it's a client-rendered SPA that Google indexes poorly, and the CLI queries its data directly.

For Japan-market searches, prefer the dedicated CLIs directly: `bun run skills/japandev-search/cli/src/cli.ts search -q "<query>" --visa yes` (parses japan-dev.com's own live page data, filters visa sponsorship/remote level/office location natively — see `japandev-search`'s SKILL.md for the ~60-job live-set coverage limit) and `bun run skills/tokyodev-search/cli/src/cli.ts search -q "<query>"` (pass one distinctive keyword — multi-word queries OR together, not AND). Both surface real visa-sponsorship status per posting, which matters for the relocation deal-breaker below.

For Switzerland-market searches, prefer the dedicated CLIs directly: `bun run skills/jobs-ch-search/cli/src/cli.ts search -q "<query>"`, `bun run skills/jobup-search/cli/src/cli.ts search -q "<query>"`, and `bun run skills/jobscout24-search/cli/src/cli.ts search -q "<query>"`. **jobs.ch and jobup.ch run semantic/AI search, not keyword matching** — results routinely include titles with no literal connection to the query (verified: a nonsense query still returns unrelated postings), so results need eyeballing rather than trusting `--query` to filter precisely; jobscout24.ch's `--location` is a client-side-only filter (the site's own location param is a no-op). None of the three surface visa-sponsorship data — Swiss work-permit sponsorship for non-EU/EFTA candidates is quota-limited and employer-dependent, so treat every Swiss posting as sponsorship-unconfirmed by default (see Location Filter below).

For wearedevelopers.com, use the dedicated CLI directly: `bun run skills/wearedevelopers-search/cli/src/cli.ts search -q "<query>" --country <code|all> --jobage <days>`. It hits the portal's own documented Markdown API (`/jobs.md`), not scraped HTML. Country is a coarse whole-country filter (`AT`/`BE`/`DE`/`ES`/`FR`/`IT`/`LT`/`NL`/`RS`/`UK`/`US`/`VN`/`all`) — many EU-remote roles are aggregated from Indeed/BuscoJobs/etc. and explicitly state relocation/visa support (or restrict eligibility to specific countries) in the full description, so always run `detail` on promising hits and check for both signals before including.

For indeed.com, use the built-in `Indeed` MCP connector (`search_jobs` / `get_job_details`) instead of a `site:indeed.com` Google search — it hits Indeed's own job search API directly and returns structured results with real apply links, rather than relying on whatever Google has indexed.

## Query Categories

Queries are grouped by priority. Write **each category in every language from your Languages table** (see Language scope above). Combine each query with your location terms (e.g. your city, region, or metro area) where the site supports it.

**Organize by function, not job title.** The same underlying work carries different titles across companies and markets (a "Data Scientist" role at one employer may be posted as "Insights Analyst" or "Data Consultant" at another). Name each priority category after the function it covers, and list several plausible job titles as query variants within that category rather than betting an entire priority tier on one exact title string.

For this candidate, most queries pair role and skill terms with "remote" rather than a fixed city, since the primary preference is remote work with openness to relocation only if visa and relocation are sponsored.

### Priority 1: Go (Golang) Backend / Software Developer, Software Engineer

Core, most desired career direction. Role-title variants to search (each paired with
"Go"/"Golang" as a skill signal, since title breadth alone would pull in irrelevant
non-Go roles): **Golang Developer, Go Backend Developer, Backend Developer, Software
Developer, Software Engineer** — each also searched with **Senior** and **Lead**
prefixes.

```
site:linkedin.com/jobs "Golang Developer" remote
site:linkedin.com/jobs "Senior Golang Developer" remote
site:linkedin.com/jobs "Lead Golang Developer" remote
site:linkedin.com/jobs "Go Backend Developer" remote
site:linkedin.com/jobs "Backend Developer" "Golang" remote
site:linkedin.com/jobs "Senior Backend Developer" "Golang" remote
site:linkedin.com/jobs "Software Developer" "Golang" remote
site:linkedin.com/jobs "Senior Software Developer" "Golang" remote
site:linkedin.com/jobs "Software Engineer" "Golang" remote
site:linkedin.com/jobs "Senior Software Engineer" "Golang" remote
site:linkedin.com/jobs "Lead Software Engineer" "Golang" remote
site:naukri.com "Golang Developer"
site:naukri.com "Senior Golang Developer"
hiringcafe-search: golang backend developer
hiringcafe-search: golang developer remote
hiringcafe-search: golang software engineer
hiringcafe-search: senior golang developer
hiringcafe-search: lead golang engineer
japandev-search: golang --visa yes
tokyodev-search: golang
jobs-ch-search: golang developer
jobs-ch-search: senior golang software engineer
jobup-search: golang developer
jobup-search: senior golang software engineer
jobscout24-search: golang developer
jobscout24-search: senior golang software engineer
indeed MCP connector: search_jobs("Golang Developer", "remote", "IN")
indeed MCP connector: search_jobs("Senior Backend Developer Golang", "remote", "IN")
"Golang Developer" remote hiring
"Backend Engineer" "Go" remote visa sponsorship
"Senior Software Engineer" "Golang" remote hiring
```

### Priority 2: Distributed Systems / Microservices Expertise

Match domain expertise (gRPC, microservices, distributed backend systems).

```
site:linkedin.com/jobs "microservices" "Golang" remote
site:linkedin.com/jobs "distributed systems" "Go" remote
"gRPC" "Go" backend engineer remote
site:wellfound.com Golang backend
```

### Priority 3: Adjacent Roles (Platform Engineer / SRE)

Adjacent roles the candidate could pivot into, given AWS/Docker/Kubernetes/observability experience.

```
site:linkedin.com/jobs "Platform Engineer" "Go" remote
site:linkedin.com/jobs "Site Reliability Engineer" Golang remote
"SRE" "Golang" remote hiring
```

### Priority 4: Broader Backend / Consulting

Wider net for general backend roles.

```
site:linkedin.com/jobs "Backend Developer" remote
site:remoteok.com Golang
site:weworkremotely.com backend Go
indeed MCP connector: search_jobs("Golang Developer", "remote", "IN")
```

## Location Filter

Relocation is **not** a deal-breaker. Define acceptable areas:
- Remote (fully remote, any country) - ideal
- India, especially Delhi NCR / Gurugram - acceptable (no relocation needed)
- Any location requiring relocation/visa, sponsorship confirmed - acceptable, flag explicitly for the user to confirm sponsorship is real before applying
- Any location requiring relocation/visa, sponsorship **unstated or unknown** - include, flag as "relocation/visa support unknown - verify before applying"
- Any location requiring relocation/visa, sponsorship **explicitly denied by the posting** - deal-breaker, exclude
- Japan via japandev-search/tokyodev-search: same rule as above - `sponsors_visas_yes` (japandev-search) or a stated-yes in the tokyodev-search detail description gets included and confirmed; unconfirmed/unknown still gets included and flagged, not excluded
- Switzerland via jobs-ch-search/jobup-search/jobscout24-search: none of these three surface visa-sponsorship data per posting - treat every Swiss posting as sponsorship-unknown, include, and flag for the user to verify directly with the employer before applying
- **Region-restricted-candidate exclusion (separate from relocation):** exclude a posting if it explicitly states eligibility is limited to candidates already located in a specific region/country the candidate isn't in - e.g. "Remote - US Timezone", "Remote (US)", "US Candidates only", a single-country remote tag like "Brazil (Remote)". This is different from relocation/visa sponsorship (which is never a deal-breaker per the rule above) - it's the posting stating up front that non-regional candidates aren't eligible at all, so there's nothing to sponsor. Ambiguous cases (a city name alone, with no explicit eligibility statement) are NOT this - treat those under the relocation rule instead.

## Experience Filter (hard deal-breaker)

Exclude a posting if its detail text explicitly states a minimum years-of-experience requirement above 6 (e.g. "8+ years", "minimum 8 years", "12-15 years"). Check the actual stated number only - never infer from a seniority title alone ("Lead"/"Staff"/"Principal" titles vary widely in practice, some state as little as 3+ years). If no explicit number is stated in the detail text, don't exclude on this basis.

## Compensation Filter (hard deal-breaker)

Only surface roles offering compensation at or above **50 LPA INR** (or currency-equivalent-or-higher for roles outside India). If a posting's salary is unclear, include it but flag as "compensation unconfirmed - verify before applying."

## Language Filter

Your working languages and levels are in CLAUDE.md's Languages table. When filtering scraped results, apply `04-job-evaluation.md`'s Language Gate: a posting requiring a language you haven't declared at all is excluded; a posting requiring a higher level than you declared in a language you do work in is not excluded, flag it clearly instead (see `job-scraper/SKILL.md`'s Step 3 "Quick Fit Assessment" for how the flag surfaces in `/scrape` output). Postings simply *written* in a language you don't work in, that don't require it on the job, are fine.

## Date Filter

Only include jobs posted within the last 14 days, or with an application deadline that has not yet passed. If a posting date cannot be determined, include it but flag as "date unknown".

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also generate 2-3 custom queries for that focus. For example:
- "/scrape [focus_area]" -> relevant category queries + custom focus-specific queries
