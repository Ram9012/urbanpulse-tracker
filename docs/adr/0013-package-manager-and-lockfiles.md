# ADR-0013: Bun as the project package manager, npm in CI, with a release-age guard

- **Status:** Accepted
- **Recorded:** 2026-11-04 (retrospective — rationale inferred from the code and history unless stated)

## Context

The scaffold uses Bun (`bun.lock`, `bunfig.toml`), but GitHub Actions and many contributors use npm (`package-lock.json`).

## Decision

Developers may use Bun (`bun install`, `bun run dev`); CI installs with `npm ci`. `bunfig.toml` sets `minimumReleaseAge = 86400` so Bun skips versions published in the last 24 h (supply-chain guard), with explicit exemptions for the Lovable packages. **Both lockfiles are committed.**

## Consequences

- Fast local installs; some protection from freshly published malicious versions.
  − Two lockfiles can drift, producing different dependency trees locally vs CI; the release-age guard does not apply to npm installs.

## Alternatives considered

- **npm only** / **pnpm** — a single standard tool.
