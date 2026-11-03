# ADR-0012: Server-side authentication and role-based authorization

- **Status:** Proposed
- **Recorded:** 2026-11-04 (retrospective — rationale inferred from the code and history unless stated)

## Context

[ADR-0011](0011-client-held-session-auth.md) leaves every endpoint unauthenticated and stores credentials weakly. Destructive actions (delete, transition, purge) and the user list are reachable by anyone.

## Decision

We will: (1) adopt a real identity provider — preferably **Supabase Auth** since Supabase is already the datastore — or implement argon2id-hashed passwords with signed, HTTP-only, SameSite session cookies; (2) add shared server middleware that authenticates every request and enforces roles (`citizen`, `staff`, `admin`) per endpoint, with citizens limited to their own reports; (3) tighten Supabase RLS to match; (4) remove the users cookie, plaintext/alternate-password paths and the committed user file; (5) restrict or remove `/api/admin/clean-database` and never allow mutations via `GET`; (6) add CSRF protection and rate limiting.

## Consequences

- Closes the P0 security findings; enables ownership and trustworthy upvotes/audit trails.
  − Migration work for existing users (force password reset); touches every endpoint and the client auth hook.
  − Pairs naturally with [ADR-0007](0007-custom-api-middleware.md) (shared middleware).

## Alternatives considered

- **Keep the demo auth** — acceptable only for a closed demo.
- **Third-party SSO (Google/DigiLocker)** — a possible later addition for citizens.
