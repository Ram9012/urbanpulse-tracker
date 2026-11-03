# ADR-0004: Deploy to Vercel using the Nitro "vercel" preset

- **Status:** Accepted
- **Recorded:** 2026-11-04 (retrospective — rationale inferred from the code and history unless stated)

## Context

We need zero-ops hosting with per-PR preview deployments for a student/small-team project.

## Decision

We build with `NITRO_PRESET=vercel vite build` (`vercel.json`: `framework: null`, explicit build command) and deploy `main` to Vercel production; PRs get preview deployments.

## Consequences

- Simple CI/CD, previews, HTTPS and CDN included.
  − Serverless: no durable local disk and no shared memory between instances — directly drives [ADR-0005](0005-hybrid-persistence.md).
  − Function timeouts and cold starts constrain AI calls (hence the ~800 ms AI-verification budget).

## Alternatives considered

- **Cloudflare Workers** — the wrapper's default target; not chosen.
- **Container/VM hosting** — would allow local state but adds ops burden.
