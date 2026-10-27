# Search Queries for Job Scraper

## Search Sites

Primary:
- **linkedin.com/jobs** - LinkedIn job listings (filter: Remote / India / worldwide)
- **naukri.com** - largest Indian job board
- **wellfound.com** (AngelList Talent) - startup/remote-friendly roles
- **weworkremotely.com** - remote-only roles, international
- **remoteok.com** - remote-only roles, international
- **indeed.com** - general job board, India + international

Secondary (company career pages via Google):
- Direct Google searches with `site:` filters for known target companies

Note: this framework's built-in CLI tools (Jobindex, Jobbank, Jobdanmark, Jobnet) are Denmark-specific and not relevant here. Rely on LinkedIn, Naukri, and Google `site:` searches on the boards above, or add new portal integrations via `/add-portal` if a specific site should be scraped directly.

## Query Categories

Queries are grouped by priority. Since the primary preference is remote work with openness to relocation only if visa/relocation is sponsored, most queries should combine role/skill terms with "remote" rather than a fixed city.

### Priority 1: Go (Golang) Backend Developer

Core, most desired career direction.

```
site:linkedin.com/jobs "Golang Developer" remote
site:linkedin.com/jobs "Go Backend Developer" remote
site:naukri.com "Golang Developer"
"Golang Developer" remote hiring
"Backend Engineer" "Go" remote visa sponsorship
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
site:indeed.com "Golang Developer" remote
```

## Location Filter

Preference is remote-first, with openness to relocation only if the employer covers relocation and visa sponsorship. Define acceptable areas:
- Remote (fully remote, any country) - ideal
- India, especially Delhi NCR / Gurugram - acceptable (no relocation needed)
- Any location with employer-sponsored relocation and visa - acceptable, flag explicitly for the user to confirm sponsorship is real before applying
- Any location requiring self-funded relocation or visa - too far (deal-breaker)

## Compensation Filter (hard deal-breaker)

Only surface roles offering compensation at or above **50 LPA INR** (or currency-equivalent-or-higher for roles outside India). If a posting's salary is unclear, include it but flag as "compensation unconfirmed - verify before applying."

## Date Filter

Only include jobs posted within the last 14 days, or with an application deadline that has not yet passed. If a posting date cannot be determined, include it but flag as "date unknown".

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also generate 2-3 custom queries for that focus. For example:
- "/scrape [focus_area]" -> relevant category queries + custom focus-specific queries
