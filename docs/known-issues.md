# Known Issues

Snapshot as of 2026-11-04 on `main` (`e6159ae`). Security items are detailed in
[security.md](security.md).

## Known issues

### Correctness / consistency

- **Status vocabularies disagree.** Front-end `ReportStatus` has 6 lowercase values; the schema
  enum has 12 uppercase ones; transitions use lowercase names such as `resolved`.
- **No transition validation.** `transitionReportStatus` accepts any `newStatus`.
- **Phantom reports.** Transitioning an unknown report id synthesizes a demo streetlight/pothole
  report instead of returning 404.
- **Supabase is write-only for reports.** Only users are read back; reports are never rehydrated
  from Supabase on cold start.
- **Fire-and-forget sync hides failures** (`.catch(() => {})`) — e.g. a missing column loses writes
  silently.
- **Duplicate-check fallback is keyword-based** and only a coarse heuristic when Groq is down.
- **`zod` declared but unused;** several `.env.example` keys unused (Cerebras, Cloudflare, Zenserp).
- **Two lockfiles** (`bun.lock`, `package-lock.json`) can drift.
- **Brand/placeholder drift:** code mentions a "Hassan Municipal Council" and Zenith Stack; the
  Supabase project is named `videoediting` (a leftover).

### Code health

- ~56 lint problems in files touched by the dev branch (`no-explicit-any` dominates; a few
  `react-hooks/exhaustive-deps` warnings); 11 pre-existing type errors on `main` (missing
  `checkSupabaseStatus` import in `api-middleware.ts`, `auth-store.ts` typing under
  `exactOptionalPropertyTypes`, `__root.tsx` error component signature).
- Very large route files (`report.tsx` ≈ 1.6k lines, `admin.reports.tsx` ≈ 1.4k,
  `reports.$id.tsx` ≈ 1.3k) mix UI, data fetching and business logic.
- API handlers are implemented twice (Fetch and Node variants).
- `civic-data.ts` mixes domain types, demo data, helpers and a mock classifier.
- No tests.

### Operational

- No error tracking, metrics or alerting.
- Admin "clean database" endpoint exists in production code.
- Committed runtime data under `storage/` is overwritten whenever the app runs locally — easy to
  commit accidentally.

## Done recently (for context)

- PR #1: duplicate detection + upvoting (geo distance + AI + per-user/IP dedupe)
- PR #2: restored `recognitionRef` (voice input crash), added `upvoted_by` to schema, removed demo
  data from the release, hardened upvote identity and the duplicate fallback, lint fixes
- PR #3: promoted `dev` to `main`
