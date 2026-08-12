# CivicPulse — Report Civic Issues and Track Resolutions

"See a problem. Report it. Track the solution."

CivicPulse is a civic issue reporting and municipal service management platform for
citizens and municipal staff. This build is the full front-end product (TanStack Start
+ React + Tailwind v4) running on realistic, clearly-labelled demonstration data.

## Pages

Citizen-facing: `/` (homepage), `/how-it-works`, `/explore` (public report explorer),
`/impact`, `/help`, `/signin`, `/report` (4-step reporting flow),
`/dashboard` (citizen dashboard), `/reports/:id` (report detail + timeline).

Municipal staff portal: `/admin` (overview), `/admin/reports` (queue, filters,
assignment modal), `/admin/map` (map view with AI classification side panel).

## Design system

All colours, radii, shadows, motion and typography are tokens in `src/styles.css`
(navy `#0B1F33`, civic blue `#146EF5`, teal `#00A896`, mint, soft canvas, semantic
success/warning/critical). Components never hardcode colours. Motion respects
`prefers-reduced-motion`.

## Data and AI

`src/lib/civic-data.ts` holds the demo dataset, routing rules and `mockClassify()`,
a modular mock classifier that stands in for the NLP/vision service. Every AI
suggestion is presented as a reviewable recommendation with an edit path — never as
a decision.

## Local development

```bash
bun install
bun run dev      # http://localhost:8080
bun run build    # production build
```

## Next step (backend)

Adding a backend adds auth (citizen / staff / manager / field worker / admin),
Postgres with row-level security, secure media storage, real notifications and the
live AI classification endpoint. Suggested tables: `users`, `citizen_profiles`,
`staff_profiles`, `departments`, `field_workers`, `reports`, `report_media`,
`report_status_history`, `assignments`, `notifications`, `comments`,
`duplicate_matches`, `audit_logs`, `routing_rules`.
