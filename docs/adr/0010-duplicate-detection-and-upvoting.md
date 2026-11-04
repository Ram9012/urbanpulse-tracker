# ADR-0010: Duplicate detection (geo + AI) with upvoting instead of duplicate reports

- **Status:** Accepted
- **Recorded:** 2026-11-04 (retrospective — rationale inferred from the code and history unless stated)

## Context

Multiple citizens report the same pothole; duplicates waste staff time and hide the true scale of a problem.

## Decision

Before submitting, the client looks for nearby reports using GPS distance and asks the AI to compare text. A report is treated as a likely duplicate if the AI says so, similarity ≥ 60 %, or the distance is ≤ 80 m (stronger signal ≤ 50 m). The citizen is offered to **upvote/add information to the existing report** instead. Upvotes are deduplicated per claimed username and per platform-reported IP, recorded in `upvotedBy`, and written to the audit trail and Supabase (`upvotes`, `upvoted_by`). If the AI is unavailable, a conservative keyword fallback requires ≥ 2 shared keywords.

## Consequences

- Cleaner queue; upvote counts give a priority signal.
  − The 80 m / 60 % thresholds are heuristics, untested against real data.
  − Identity is weak (client-supplied username, shared NATs, rotating IPs); no rate limiting.
  − `upvotedBy` now stores IP-derived keys (personal data) in a column readable under permissive RLS.

## Alternatives considered

- **No dedupe** — noisy queue.
- **AI-only** — slow/costly per submission and unavailable offline.
- **Geo-only** — misses same issue reported from different spots.
