---
framework_version: 1.1.1
---

# Candidate Profile

<!-- SETUP: This file is populated by running /setup -->
<!-- After running /setup, all sections will be filled with your actual information -->

## Identity
- **Name:** Himanshu Jakhmola
- **Location:** Delhi, India (works remote)
- **Phone:** +91-8368891620
- **Email:** himanshujakhmola143@gmail.com
- **LinkedIn:** linkedin.com/in/himanshu-j-719b33b4
- **GitHub:** https://github.com/Himanshujk
- **Status:** Currently employed - Back End Developer at DC Forte India Private Limited
- **Constraints:** Remote preferred; open to relocation to any location if the employer covers relocation and visa costs

### Languages
<!-- Every language you can work in professionally, with your honest level. Used by the
Language Gate in 04-job-evaluation.md and by job-scraper/search-queries.md's query-language
generation. Omit any language you don't actually work in - an undeclared language is treated as
a hard no, not a gap to smooth over. -->

| Language | Level | Notes |
|----------|-------|-------|
| Hindi | Native | |
| English | Fluent | Professional working language |

## Education

| Degree | Period | Institution |
|--------|--------|-------------|
| B.Tech, Computer Science & Information Technology | 2017 - 2021 | Dronacharya College of Engineering, Gurugram |

## Professional Experience

### Back End Developer - DC Forte India Private Limited (May 2026 - Present)
Gurugram - Remote
<!-- Customer base: serves both B2B and B2C customers (candidate-confirmed) - safe to cite "experience with B2B systems" on a posting nice-to-have. -->
- Lead design and development of scalable backend architectures in Go for DC Forte's talent intelligence platform with AI capabilities
- Provide architectural expertise for high-performance APIs, microservices, and backend integration across end-to-end platform workflows
- Lead design of the CV vectorization pipeline enabling AI-powered semantic search and candidate matching
- Built resume/job parsing using OpenAI API to structure unstructured CV and job description data
- Built an AI voice interview/screening agent using LiveKit (real-time transport), Deepgram (STT), Cartesia (TTS), and Simli (real-time avatar)
- Develop and maintain the Agent Registry, using Temporal for workflow orchestration of agents throughout their lifecycles
- Design scalable data models and backend services for reliable, performant, manageable platforms
- Built a multi-agent content-generation pipeline orchestrated via the Anthropic Claude API (brief synthesis, budget modeling, content-generation agents), packaged as a cross-platform Electron desktop app with a local Express server and SQLite storage
- Extended platform backend services in Django REST Framework (Python) and PHP/Laravel alongside Go and Node.js, integrating WhatsApp Business API and third-party content/distribution APIs (Bit.ly, Google Drive, image/video generation services)
- Coach and mentor backend developers via code reviews and best-practice sharing
- Main point of contact for backend at DC Forte (candidate-stated 2026-10-27 as "the main person to contact"; exact scope, on-call vs general escalation, not confirmed - do not put on a CV until clarified)
- Ported the platform's core API backend from Node.js/Express to Go (candidate-confirmed 2026-10-21; source: project memory of the migration). Worked in phases (auth, core routes, data layer with sqlc, storage, workers), matched Node's AES-256-CBC PII encryption exactly, and ran handler-by-handler parity audits against the Node code using Claude Code. Parity fixes found by the audits included a Go default of isActive=false where Node defaults true, and a missing organisation-scope check on job delete. Do not name the internal product on CVs.
- Go services authenticate with JWT; third-party integrations use OAuth; monitoring uses OpenTelemetry and Prometheus (candidate-confirmed 2026-10-21, applies to both DC Forte and GrowThrive)
- Work within a multinational engineering team (candidate-confirmed)
- Work in Agile/Scrum-style delivery, with sprint/task tracking in monday.com (candidate-confirmed; ceremony-level detail such as sprint planning/estimation/retros not individually confirmed)
- Collaborate with AI, Product, Frontend, and DevOps teams to ship production-grade products under tight deadlines
- Manage and maintain the platform's codebases across multiple languages (Go, Python, PHP, Node.js backend, TypeScript/React frontend) using AI coding agents (Claude Code, used daily)

### Backend Developer - GrowThrive Private Limited (September 2024 - April 2026)
Gurugram - Remote
<!-- Customer base: serves both B2B and B2C customers (candidate-confirmed) - safe to cite "experience with B2B systems" on a posting nice-to-have. -->
- Architect and implement reliable, high-performance, secure APIs for business-critical operations
- Designed and built a multi-tenant permissions system (RBAC + attribute-based rules) with JWT-based claims and DB-backed roles/permissions tables (PostgreSQL/CockroachDB), enforced via middleware across API endpoints
- Mentor and guide junior developers on coding, design, and system architecture practices
- Worked within multinational engineering teams (candidate-confirmed)
- Worked in Agile/Scrum-style delivery with Jira for tracking (candidate-confirmed; Jira confirmed for the earlier roles, exact employer split not specified)
- Collaborate with designers, frontend, DevOps, and QA to deliver seamless end-to-end solutions
- Designed and implemented database schemas and queries optimizing performance and scalability for complex systems
- Ensured system reliability via monitoring tools (Grafana, Jaeger, OpenTelemetry, Prometheus), actively resolving production issues
- Participated in an on-call rotation (candidate-confirmed 2026-10-27)
- Go services authenticated with JWT; third-party integrations used OAuth (candidate-confirmed 2026-10-21)
- Scale/impact metrics (candidate-confirmed 2026-10-21, approximate figures): 20-25 Go microservices processing millions of matches; 99.9% uptime; average API latency under 200 ms (exceptions: long file fetch/export operations); most production issues resolved in under an hour
- Used GitHub Copilot for AI-assisted development (candidate-confirmed 2026-10-21)
- Data layer at GrowThrive (candidate-confirmed 2026-10-21): 2 CockroachDB clusters (3 nodes each), 2 Elasticsearch clusters, 3 vector database clusters
- Mentored around 10-12 developers and reviewed code for 20+ developers (candidate-confirmed 2026-10-21; stated in GrowThrive context, employer attribution assumed - confirm if citing for DC Forte)
- Codebase size (candidate-stated, NOT used on CVs): core 26GB+, webBFF 10GB+, mobileBFF 10GB+ - likely repository size rather than source code, reads oddly to technical reviewers; use only if the interviewer asks, and describe what it measures. Architecture at GrowThrive: core services plus web BFF and mobile BFF (backend-for-frontend) layers - candidate-confirmed 2026-10-21 as citable on CVs (as architecture, not by repo size); core services and both BFF layers are all written in Go (candidate-confirmed 2026-10-21). Unknown whether the BFFs count within the 20-25 microservices, so CV wording says "20-25 microservices plus web and mobile BFF layers".
- Drove adoption of microservices architecture to enhance modularity and scalability
- Built resume parsing feature using OpenAI API
- Used GCP (Cloud Storage, BigQuery) for object storage and data warehousing needs
- Used AWS IAM for access control and permissions management
- Optimized multiple APIs for speed and reliability
- Used RabbitMQ for asynchronous messaging between backend services
- Optimized a slow export API from 16 minutes down to under 2 seconds, using PostgreSQL query tuning, code-level concurrency, fetching only the required data, and restructuring the fetch/response pipeline

### Junior Backend Developer - GrowThrive Private Limited (November 2022 - September 2024)
Gurugram - Remote
- Developed and maintained backend services using Golang, Docker, Git, CockroachDB, PostgreSQL, gRPC, Protocol Buffers, RPC, and AWS
- Collaborated cross-functionally to design and deliver scalable, high-performance, reliable backend solutions
- Contributed to architecture and implementation of efficient systems, ensuring seamless integration and optimal performance
- Optimized system performance and troubleshot complex issues to ensure reliability and uptime

### Software Engineer - Think Future Technologies (August 2021 - November 2022)
Gurugram - Remote
- Led development of a project from scratch using Golang, Git, Linux, PostgreSQL, MySQL, Jira and RPC
- Architected backend infrastructure for scalability, performance, and security throughout the project lifecycle
- Collaborated cross-functionally to define requirements, design APIs, and implement business logic
- Integrated multiple services and technologies for seamless communication and optimal performance
- Delivered the project on time, meeting business objectives while maintaining high-quality coding standards
- Worked within a multinational team (candidate-confirmed)

### Software Trainee - Think Future Technologies (February 2021 - August 2021)
Gurugram - Remote
- Gained foundational knowledge and hands-on experience in Golang through active development of backend services and internal tools
- Profiled Go code using pprof and optimized performance
- Participated in code reviews and development meetings to learn industry-standard practices

## Independent Projects
<!-- Projects outside of employment: freelance, open source, personal -->
- **Skill-Matcher**: Terminal tool (Go, Bubble Tea TUI) that scans Excel datasets for skill matches - exact text matching or exact + semantic fallback using FastText word embeddings. Concurrent processing of every file in a folder; over 300 built-in skill aliases for normalization (e.g. "js" to "javascript"). [GitHub](https://github.com/Himanshujk/skill-matcher)
- **DSA Meets Design** (open source contribution): Merged pull request adding full Go language support across all 20 machine-coding/LLD interview problems (+22,007/-161 lines, 218 files) to a community machine-coding interview-prep repo. [PR #2](https://github.com/jkaus324/machine-coding-interview-questions/pull/2)
- **Go performance writing (LinkedIn)**: published Go technical posts and carousels, e.g. GOMEMLIMIT vs GOGC benchmark runs, sync.Pool GC-pause fix, Go error-handling guidance (seen on the public LinkedIn profile 2026-10-21; claims in the posts such as the 340 ms p99 story are the candidate's own and not confirmed for CV use).
- **CalcDock: Calculators & Tools**: Flutter mobile calculator app (iOS/Android), built and managed solo using AI coding agents (Claude Code). Live on Google Play (candidate-confirmed 2026-10-27; previously in closed testing; iOS App Store status not stated). [Google Play](https://play.google.com/store/apps/details?id=com.realonlinecalculator.calcdock) (link supplied by the candidate; my fetch of the page was inconclusive).
- **realonlinecalculator.com**: Web-based calculator site built with Astro, deployed on Cloudflare, built and managed solo using AI coding agents (Claude Code). Live/deployed.
- **Elemental Merge**: Flutter mobile physics-merge game using the Flame game engine and Flame Forge2D physics engine. Built solo using AI coding agents (Claude Code). Early/in-development, not yet released.

## Employer Platform Components (DC Forte / Kalido)
<!-- Built as an employee, not independent projects. Same underlying work as the CV vectorization/semantic-search bullet under DC Forte in Professional Experience - do not double-count as "personal projects." If ever included in a Projects section on a CV, strip employer name, domain, and infra specifics (see 05-cv-templates.md). -->
- **Candidate Semantic Match Service**: gRPC (Protocol Buffers) + HTTP service matching candidates to job descriptions. Exact-match filtering on must-have fields, then vector search via a Weaviate database using Ollama embeddings (`text2vec-ollama`), with environment-specific (staging/prod) configuration.
- **CV Generator Service**: Go service generating LaTeX CV PDFs across 6 style variants (3 color schemes x 2 sidebar layouts). Containerized, deployed on Kubernetes (autoscaling 2-10 pods) via GitLab CI/CD, exposed via a JSON API. (Corrects an earlier inaccurate note in this file claiming AWS Lambda/serverless deployment and "4 templates" - verified against the repo README, no Lambda option exists.)

## Technical Skills

<!-- Candidate-confirmed 2026-10-21: every skill listed below is used in production, except the "Secondary stacks - AI-assisted exposure only" line, which stays AI-assisted exposure. -->

### Programming & ML
- **Go (Golang)** (5+ years, professional): gRPC, RPC, Protocol Buffers, GoMock, pprof, Ginkgo, Gin, Cobra
- **C++, C**
- Semantic search / vector search integration (Weaviate, Ollama embeddings, VectorDB)
- AI/LLM integration: OpenAI API, Anthropic Claude API (multi-agent orchestration), LiveKit (real-time audio/video/agents), Deepgram (STT), Cartesia (TTS), Simli (real-time avatar)
- **Secondary stacks - AI-assisted exposure only (via Claude Code)**: Python (Django, Django REST Framework, Celery), PHP (Laravel), Node.js/TypeScript/React, Electron. Directed and reviewed through Claude Code on DC Forte's polyglot platform; can describe what these services do and why, but not independently fluent - would not be able to debug/extend them unaided in an interview or pairing session. Do not list these as standalone "skills" on a CV; only cite them as AI-assisted platform exposure, never implying independent hands-on depth. Primary hands-on depth is Go.

### Domain Expertise
- Backend microservices architecture & distributed systems
- Identity & access management: RBAC, attribute-based access control, JWT-based authentication/authorization for Go services, OAuth for third-party integrations, multi-tenant permission scoping
- API platforms: RESTful APIs, OAuth2, OpenAPI/Swagger, WebSockets, Kong API gateway
- Database design: CockroachDB, PostgreSQL, MySQL, Redis, Elasticsearch
- Cloud & DevOps: Docker, Kubernetes, AWS (Lambda, CloudFormation, S3, Bedrock, IAM), GCP (Cloud Storage, BigQuery), CI/CD, Linux
- Observability: OpenTelemetry, Prometheus, Grafana, Jaeger, Tempo, Loki, Pyroscope
- Messaging: RabbitMQ, Temporal
- Third-party API integration: WhatsApp Business API, Bit.ly, Google Drive
- Version control: GitHub

### Software & Tools
- Project tracking / Agile: Jira (earlier roles), monday.com (current)
- LaTeX
- GitHub Copilot (used at GrowThrive, candidate-confirmed 2026-10-21)
- Claude Code (used daily in real engineering work, candidate-confirmed 2026-10-08), Cursor, Antigravity CLI, MCP (Model Context Protocol) - agentic coding workflows, custom MCP server integrations

## Publications
None

## Certifications
- **Go (Basic)** - HackerRank
- **Go (Intermediate)** - HackerRank
- **Problem Solving** - HackerRank

### Older / academic certifications (2018-2020, pre-professional)
<!-- Certificates held for all of these. Generally too junior/dated to surface on a 5+yr senior CV per relevance-weighted cutting - kept here as a complete record in case a posting specifically calls for workplace-communication/soft-skills training or foundational C/C++ coursework. -->
- **Interview Crack** - Coding Ninjas (aggregate 200/200)
- **Workplace Communication** (C2CWC1xA18) - IIT Bombay (IITBombayX, "College to Corporate" programme)
- **Soft Skills** (C2CSS1xA18) - IIT Bombay (IITBombayX, "College to Corporate" programme)
- **Writing, Running and Fixing Code in C** - Coursera (6-week program: writing, running, debugging C, writing test cases)
- **Programming with C and C++** - Internshala (6-week program)
- **Android App Development** - IIT Delhi (8-hour workshop)
- **Problem Solving through Programming in C** - NPTEL (6-week certification)
- **Modern C++** - Udemy (C++11/14/17)
- **C Training** - IIT Bombay, Spoken Tutorial Project (remote exam, funded by National Mission on Education through ICT, MHRD, Govt. of India)
- **COD-A-THON** - participation certificate, Regional Student Convention (CSI-RSC 2018), Dronacharya College of Engineering

## Awards
- **SuperQuiz '18** - 2nd position, SAEINDIA (Society of Automotive Engineers India) Collegiate Club, Dronacharya College of Engineering, Gurugram

## Personal Interests
- Chess
- Photography
- Gaming
