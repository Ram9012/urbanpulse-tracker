# Architecture Decision Records

ADRs capture significant architectural decisions, their context and consequences. They are
**immutable once accepted** — to change a decision, add a new ADR that supersedes the old one.
Template: [0000-template.md](0000-template.md). These were written retrospectively on 2026-11-04.

| ADR                                              | Title                                                     | Status                                  |
| ------------------------------------------------ | --------------------------------------------------------- | --------------------------------------- |
| [0001](0001-tanstack-start-react.md)             | TanStack Start + React 19 as the full-stack framework     | Accepted                                |
| [0002](0002-lovable-vite-config.md)              | Build through `@lovable.dev/vite-tanstack-config`         | Accepted                                |
| [0003](0003-tailwind-shadcn-design-tokens.md)    | Tailwind v4, shadcn/ui on Radix, design tokens            | Accepted                                |
| [0004](0004-vercel-nitro-deployment.md)          | Deploy to Vercel with the Nitro preset                    | Accepted                                |
| [0005](0005-hybrid-persistence.md)               | Hybrid persistence (memory + JSON + best-effort Supabase) | Accepted, weak — rework planned         |
| [0006](0006-groq-ai-with-fallbacks.md)           | Groq LLM, advisory-only, with deterministic fallbacks     | Accepted                                |
| [0007](0007-custom-api-middleware.md)            | Single hand-rolled `/api/*` middleware                    | Accepted, revisit                       |
| [0008](0008-status-engine-audit-trail.md)        | Central status engine with audit trail                    | Accepted                                |
| [0009](0009-leaflet-openstreetmap.md)            | Leaflet + OpenStreetMap + Nominatim                       | Accepted                                |
| [0010](0010-duplicate-detection-and-upvoting.md) | Duplicate detection (geo + AI) and upvoting               | Accepted                                |
| [0011](0011-client-held-session-auth.md)         | Client-held session auth (current)                        | Accepted, superseded by 0012 (proposed) |
| [0012](0012-server-side-auth-and-rbac.md)        | Server-side authentication and RBAC                       | **Proposed**                            |
| [0013](0013-package-manager-and-lockfiles.md)    | Bun + npm lockfiles, release-age guard                    | Accepted, needs cleanup                 |
| [0014](0014-ci-and-branching-strategy.md)        | `dev` → `main` branching with PR-gated CI                 | Accepted                                |
