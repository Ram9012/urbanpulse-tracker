# Security

**Status: demo-grade. Do not expose to real citizens or real data until the P0 items below are
resolved.** This page records the current posture honestly so it can be fixed deliberately. It
describes classes of problems found by code review on 2026-11-04; it is not a penetration test.

## Summary of findings

| #   | Severity | Area             | Finding                                                                                                                                                                                                             | Fix tracked in                                         |
| --- | -------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| S1  | Critical | Secrets          | API keys / URLs are embedded as fallbacks in source (Groq key, SerpAPI key, Supabase URL) in a **public** repo and git history                                                                                      | Rotate + remove fallbacks (P0)                         |
| S2  | Critical | Authorization    | No server-side authN/authZ on any `/api/*` endpoint, including report delete, status transition, user list and the database-purge endpoint (reachable via `GET`)                                                    | [ADR-0012](adr/0012-server-side-auth-and-rbac.md) (P0) |
| S3  | Critical | Authentication   | Passwords: unsalted SHA-256 (fast hash); some seeded accounts store plaintext passwords; plain-text equality is accepted; one seeded account accepts any password of length ≥ 6; extra "alternate passwords" bypass | ADR-0012 (P0)                                          |
| S4  | Critical | Session          | No session token. The client stores the user object in `localStorage`; admin pages are guarded only in the browser                                                                                                  | ADR-0012 (P0)                                          |
| S5  | High     | Data exposure    | The server sets a cookie containing **all users** (incl. hashes) and trusts it back to merge users — anyone can read it and anyone can forge it to inject users                                                     | ADR-0012 (P0)                                          |
| S6  | High     | Supabase RLS     | `app_users` is publicly readable/insertable/updatable; reports/history policies are permissive; server prefers the service-role key but can fall back to the anon key                                               | ADR-0012                                               |
| S7  | High     | Data in repo     | `storage/civic-users.json` (usernames, hashes) is committed and shipped in the bundle                                                                                                                               | ADR-0005                                               |
| S8  | Medium   | Upvote integrity | Voter identity is a client-supplied username plus platform IP; a determined user can still vote repeatedly (rotating IPs). No rate limiting                                                                         | ADR-0010                                               |
| S9  | Medium   | Input handling   | Request bodies are not schema-validated (`zod` is installed but unused); media are accepted as unbounded data URLs → memory/DoS risk; LLM prompts embed raw user text (prompt injection)                            | Roadmap                                                |
| S10 | Medium   | Availability     | No rate limiting on AI/search endpoints that spend paid API credits                                                                                                                                                 | Roadmap                                                |
| S11 | Medium   | Dependencies     | `npm audit`: 22 issues (1 critical in tooling, 7 high); 5 high in the production-only tree (`vite`, `zod`, `js-yaml`, `nanoid`, `source-map-js`) — mostly DoS; same on main                                         | Roadmap                                                |
| S12 | Low      | CI               | Secret scanning (gitleaks) passes despite embedded keys in history; typecheck/lint/audit are non-blocking                                                                                                           | Roadmap                                                |
| S13 | Low      | Privacy          | Anonymous reports still carry GPS/time; Nominatim/OSM and Groq receive user text/coordinates; no privacy policy or data-retention rules                                                                             | Roadmap                                                |

## Threat model (lightweight)

| Actor                             | Goal                                                 | Today                                                     |
| --------------------------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| Anonymous internet user           | Delete/alter reports, wipe DB, read all users        | Possible (S2, S5)                                         |
| Malicious citizen                 | Fake support (upvotes), spam reports, drain AI quota | Partly mitigated (S8), spam possible (S10)                |
| Curious reader of the public repo | Reuse leaked keys, read user hashes                  | Possible (S1, S7)                                         |
| Compromised dependency            | Supply-chain attack                                  | Reduced by 24 h Bun release-age guard (Bun installs only) |

## What is already done well

- Secrets in `.env` are git-ignored; CI runs gitleaks on PRs.
- A past XSS-related dependency CVE in `@tanstack/react-start` was patched.
- Upvotes are deduplicated per user and per IP, and the audit trail records them.
- AI is advisory: outputs are reviewed by a human, prompts request strict JSON at low temperature,
  and the AI path has time limits / fallbacks so it cannot block core flows.
- `x-forwarded-for` (client-controlled) is no longer trusted for identity; platform headers are used.

## Remediation plan

### P0 — before any real users

1. **Rotate** the Groq and SerpAPI keys (and review the Supabase project key); remove all embedded
   fallbacks; fail fast at startup if required env vars are missing. Purging git history is optional
   once keys are revoked, but revocation is mandatory.
2. **Server-side authentication**: salted slow hashing (argon2id/bcrypt), signed HTTP-only session
   cookies, remove plaintext/alternate-password/any-password paths and the users cookie sync.
3. **Authorization (RBAC)**: protect admin, delete, transition, purge and user-list endpoints; enforce
   role on the server; remove or lock the purge endpoint and don't allow `GET` for mutations.
4. **Supabase**: lock down `app_users` and tighten RLS; use the service-role key only on the server;
   move users out of public tables or behind Supabase Auth.
5. Remove `storage/civic-users.json` from the repo; stop shipping user data in bundles.

### P1

6. Validate every request body with `zod` and cap payload sizes; move media to Supabase Storage /
   object storage with signed URLs and type/size checks.
7. Rate limit AI, search, auth and upvote endpoints (per IP and per user).
8. Add security headers (CSP, `X-Content-Type-Options`, frame options) and CSRF protection for
   cookie-based sessions.
9. Dependency updates (`npm audit fix`; `zod` major bump) and make `dependency-audit` blocking for
   high+ in the production tree.

### P2

10. Prompt-injection hardening for LLM calls; log and review AI outputs.
11. Privacy: policy, retention, minimize data sent to third parties, consent for location.
12. Add security tests (authz tests per endpoint) and make typecheck/lint blocking in CI.

## Reporting a vulnerability

Do not open a public issue for security problems. Contact the repository owner privately (GitHub
profile) with details; add a `SECURITY.md` with a dedicated contact once one exists.
