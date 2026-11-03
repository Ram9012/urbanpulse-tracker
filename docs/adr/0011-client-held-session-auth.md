# ADR-0011: Unified username/password auth with a client-held session (current state)

- **Status:** Accepted as a demo-stage shortcut — **Superseded by ADR-0012 (proposed)**
- **Recorded:** 2026-11-04 (retrospective — rationale inferred from the code and history unless stated)

## Context

The demo needed citizen and admin sign-in without standing up an auth provider, and it had to survive serverless cold starts with an ephemeral filesystem.

## Decision

Users (`admin`, `citizen`) are stored in `app_users` / `civic-users.json`, with seed users bundled in code. Login returns the user object, which the browser keeps in `localStorage`; admin pages check it client-side. Passwords are SHA-256 hashed (unsalted), with legacy plaintext matches and some convenience bypasses. The server sets a cookie containing the user list and merges it back on requests to keep users across containers.

## Consequences

- Fast to build; works offline.
  − **Not secure**: no server-side sessions or authorization, weak hashing, plaintext/bypass paths, user list exposed in a cookie and forgeable. See [security.md](../security.md) S2–S6.
  − Everything that needs identity (upvotes, ownership, admin actions) rests on client-supplied claims.

## Alternatives considered

- **Supabase Auth / Auth.js / Clerk** — see ADR-0012.
