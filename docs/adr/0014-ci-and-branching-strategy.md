# ADR-0014: Two long-lived branches (dev → main) with PR-gated CI

- **Status:** Accepted
- **Recorded:** 2026-11-04 (retrospective — rationale inferred from the code and history unless stated)

## Context

Work needs an integration branch where features can be combined and tested before reaching production, with automated checks on every change.

## Decision

Feature/fix branches merge by PR into `dev`; `dev` is promoted to `main` by PR; `main` deploys to production on Vercel. GitHub Actions runs on PRs to both: install, typecheck, lint (changed files only), prettier check, build, gitleaks secret scan and `npm audit`. Typecheck, lint and audit are `continue-on-error` because of pre-existing debt; format, build, install and secret-scan are blocking.

## Consequences

- Clear promotion path; previews on every PR; cheap checks.
  − Non-blocking typecheck/lint means regressions (e.g. a missing `recognitionRef` declaration) can merge unnoticed — compare against the baseline locally.
  − No automated tests; gitleaks didn't flag keys already in history.
  **Follow-up:** fix type errors then make typecheck blocking; add tests; add branch protection requiring CI and review.

## Alternatives considered

- **Trunk-based on `main`** — simpler, needs stronger tests and feature flags.
- **Release branches** — overkill for the current team size.
