# ADR-0008: A central status engine with a full audit trail and notifications

- **Status:** Accepted
- **Recorded:** 2026-11-04 (retrospective — rationale inferred from the code and history unless stated)

## Context

Citizens and staff must see exactly how a report progressed, who changed it, and when, and citizens must be notified.

## Decision

All report mutations go through `status-engine.ts`. Each creation, status transition and upvote appends a `StatusHistoryEntry` (old/new status, actor, role, comment, metadata) and creates notifications; changes are mirrored to Supabase tables `reports`, `report_status_history`, `notifications`. The schema models 12 workflow states.

## Consequences

- Single place for business rules and a complete timeline for the UI and for audits.
  − Transitions are **not validated** (any status can be set); status vocabularies differ between UI types and schema.
  − Unknown report ids create synthetic placeholder reports.

## Alternatives considered

- **Ad-hoc updates in handlers** — no audit trail.
- **DB triggers for history** — possible once Supabase is the source of truth.
