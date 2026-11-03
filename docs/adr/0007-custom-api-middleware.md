# ADR-0007: A single hand-rolled `/api/*` middleware instead of framework server routes

- **Status:** Accepted — flagged for revisit
- **Recorded:** 2026-11-04 (retrospective — rationale inferred from the code and history unless stated)

## Context

API endpoints must run in the Vite dev server (so `bun run dev` serves UI + API on one port) and in the production Vercel function, alongside SSR.

## Decision

All endpoints are implemented in `src/lib/server/api-middleware.ts`: `handleApiRequest(request)` (Fetch API; used by `src/server.ts` in production) and `civicPulseApiPlugin()` (a Vite plugin with Node `req/res` handlers for dev). Domain logic is delegated to `status-engine`, `auth-store`, `ai-service`.

## Consequences

- Works identically with the scaffold's server entry and in dev; no framework API surface to learn.
  − **Every endpoint is written twice** and the two copies can drift.
  − No shared middleware for auth, validation, rate limiting or error shaping.
  − Manual routing via `pathname === …` / `startsWith` (prefix matches are loose).
  **Follow-up:** migrate to TanStack Start server routes/functions (or a tiny router) with shared auth/validation middleware.

## Alternatives considered

- **TanStack Start server routes** — preferred long-term.
- **Separate Express/Hono service** — extra deployable.
