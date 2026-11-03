# ADR-0001: Use TanStack Start + React 19 as the full-stack framework

- **Status:** Accepted
- **Recorded:** 2026-11-04 (retrospective — rationale inferred from the code and history unless stated)

## Context

CivicPulse needs server-rendered, SEO-friendly public pages (explore, impact, how-it-works), rich interactive pages (reporting flow, dashboards, maps) and a small server API, built quickly by a small team. The project was scaffolded from a Lovable `tanstack_start_ts` template (see `.project-meta/project.json`).

## Decision

We use **TanStack Start** (SSR) with **TanStack Router** file-based routing and **React 19**, written in strict TypeScript. TanStack Query is available for async state. Routes live in `src/routes`; `routeTree.gen.ts` is generated.

## Consequences

- Type-safe routing/params, SSR and a controllable server entry (`src/server.ts`).
- One language and one repo for UI and API.
  − Younger ecosystem than Next.js; Nitro 3 is a beta dependency.
  − Route files grew very large; no enforced separation of UI/data logic.
  − Must follow framework conventions (no `pages/`, never hand-edit the route tree).

## Alternatives considered

- **Next.js** — mature, but the scaffold and team chose TanStack.
- **Remix/React Router** — similar model, less type-safe routing.
- **SPA + separate API** — more moving parts, worse SEO for public pages.
