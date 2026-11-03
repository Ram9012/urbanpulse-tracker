# ADR-0005: Hybrid persistence — in-memory + JSON files + best-effort Supabase sync

- **Status:** Accepted (with known weaknesses) — superseded in intent by a proposed move to Supabase as the single source of truth
- **Recorded:** 2026-11-04 (retrospective — rationale inferred from the code and history unless stated)

## Context

The app began as a front-end demo with seed data, then gained a backend. A working demo needed to run with no external services, while production needed a real database. On Vercel the filesystem is ephemeral and per-container.

## Decision

State lives in module-level memory, mirrored to JSON files (`storage/` locally, `/tmp/civic-storage` on Vercel) and, when Supabase credentials exist, pushed to Supabase via REST **fire-and-forget**. Supabase is write-only for reports/history; only users are read back. Users additionally travel in a cookie to survive cold starts.

## Consequences

- Zero-config local development and resilient demos; user flows never block on the database.
  − **Not durable or consistent on serverless:** cold starts drop `/tmp`; instances diverge; reports are never rehydrated from Supabase.
  − Silent sync failures (e.g. missing column) lose data without any signal.
  − Demo data and user hashes are committed to the repo.
  **Follow-up:** make Supabase the source of truth (read-through, await writes with retries), keep JSON only as a dev fallback, move users to a proper auth store, and stop committing runtime data.

## Alternatives considered

- **Supabase only** — correct for production but requires keys to even run locally.
- **SQLite/libSQL (Turso)** — durable and simple, not adopted.
- **Supabase client SDK with realtime** — available, not used (raw REST today).
