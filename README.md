# CivicPulse — Report Civic Issues and Track Resolutions

> "See a problem. Report it. Track the solution."

CivicPulse is a civic issue reporting and municipal service management platform. Citizens report
problems (potholes, streetlights, garbage, water, safety, parks) with photos, GPS location and a
description; municipal staff triage, assign and resolve them; everyone can follow progress on a
status timeline. AI assists with classification, duplicate detection, resolution verification and a
citizen chatbot ("PulseBot"), always as a reviewable recommendation rather than a decision.

- **Stack:** TanStack Start (React 19, SSR) · Tailwind CSS v4 · shadcn/Radix UI · Leaflet/OpenStreetMap ·
  Groq LLM · Supabase (Postgres) · Vercel (Nitro)
- **Status:** Working product with demo data. **Not yet production-hardened** — read
  [docs/security.md](docs/security.md) before exposing it to real users.

## Quick start

```bash
bun install            # or: npm ci
cp .env.example .env   # fill in values (see docs/configuration.md); the app also runs without keys
bun run dev            # http://localhost:8080
```

Useful scripts: `dev`, `build`, `preview`, `typecheck`, `lint`, `format`, `format:check`.

## Pages

| Audience | Route                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------- |
| Public   | `/`, `/how-it-works`, `/explore`, `/impact`, `/help`, `/signin`                                                     |
| Citizen  | `/report` (multi-step reporting flow), `/dashboard` (own reports, PulseBot, society map), `/reports/:id` (timeline) |
| Staff    | `/admin` (overview), `/admin/reports` (queue, filters, assignment), `/admin/map` (map + AI side panel)              |

## Documentation

Everything lives in [`docs/`](docs/README.md):

| Doc                                                        | What it covers                                          |
| ---------------------------------------------------------- | ------------------------------------------------------- |
| [Architecture](docs/architecture.md)                       | System design, request flow, persistence, key modules   |
| [Tech stack](docs/tech-stack.md)                           | Every technology, its version and why it is used        |
| [ADRs](docs/adr/README.md)                                 | Architecture Decision Records (14) incl. proposed fixes |
| [API reference](docs/api.md)                               | All `/api/*` endpoints                                  |
| [Data model](docs/data-model.md)                           | Report lifecycle, entities, Supabase schema             |
| [Getting started](docs/getting-started.md)                 | Setup, running, troubleshooting                         |
| [Configuration](docs/configuration.md)                     | Environment variables                                   |
| [Development guide](docs/development.md)                   | Repo layout, conventions, CI, branching, PR flow        |
| [Deployment](docs/deployment.md)                           | Vercel + Supabase, release checklist                    |
| [Security](docs/security.md)                               | Current security posture, known gaps, remediation plan  |
| [Known issues & roadmap](docs/known-issues-and-roadmap.md) | Tech debt, inconsistencies, prioritized next steps      |

## License / ownership

Organization metadata in the code refers to "Zenith Stack". No license file is present; add one
before publishing the project as open source.
