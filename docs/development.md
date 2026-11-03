# Development Guide

## Repository layout

```
src/
  routes/                 File-based routes (TanStack Router). __root.tsx is the shell.
    index, how-it-works, explore, impact, help, signin
    report.tsx            Multi-step reporting flow (largest page)
    dashboard.tsx         Citizen dashboard + PulseBot
    reports.$id.tsx       Report detail + timeline
    admin.tsx, admin.index.tsx, admin.reports.tsx, admin.map.tsx   Staff portal
  components/
    site/                 App components: layout, maps, chatbot, primitives
    ui/                   shadcn/ui primitives (generated, edit sparingly)
  lib/
    civic-data.ts         Domain types, demo data, routing rules, mock classifier, geo helpers
    auth-client.ts        Client session (localStorage) + useAuth()
    error-*.ts            Error capture / reporting / page
    server/               Server-only: api-middleware, status-engine, auth-store, ai-service,
                          supabase-client, seed-users
  server.ts, start.ts, router.tsx, routeTree.gen.ts (generated)
  styles.css              Tailwind v4 + design tokens
storage/                  Local JSON persistence (demo seed data)
supabase/schema.sql       Database schema
public/                   Static assets, demo evidence images
docs/                     This documentation
```

Rules of thumb:

- Server-only code goes in `src/lib/server/` — never import it from route components.
- Don't create `src/pages/` or Next/Remix conventions; see `src/routes/README.md`.
- Never edit `src/routeTree.gen.ts`.
- Use design tokens from `src/styles.css`; don't hardcode colors.
- Business logic belongs in `src/lib/server/*`; keep API handlers thin.

## Coding conventions

- TypeScript strict mode with `exactOptionalPropertyTypes` — optional props can't be assigned
  `undefined` explicitly.
- Prettier is enforced in CI (`bun run format` before committing).
- ESLint 9; avoid `any` and empty blocks (existing code has debt here — don't add to it).
- Keep AI features as _suggestions with an edit path_, with a deterministic fallback when the LLM
  fails ([ADR-0006](adr/0006-groq-ai-with-fallbacks.md)).

## Branching & release flow

```
feature/* or fix/* ──PR──▶ dev ──PR──▶ main ──▶ Vercel production
```

- `main` is production; `dev` is integration. Both are PR-only targets for CI.
- Branch names: `feature/<topic>`, `fix/<topic>`, `docs/<topic>`.
- Commit style: Conventional-ish (`feat:`, `fix:`, `ci:`, `docs:`, `style:`, `chore:`).
- Merge with merge commits (history uses them).
- Before promoting `dev` → `main`, use the checklist in [deployment.md](deployment.md).

## CI (`.github/workflows/ci.yml`)

Runs on pull requests into `main` and `dev`.

| Job                | Blocking? | Notes                                                               |
| ------------------ | --------- | ------------------------------------------------------------------- |
| `install`          | yes       | `npm ci`                                                            |
| `typecheck`        | **no**    | `continue-on-error` until pre-existing type errors are fixed        |
| `lint`             | **no**    | Lints files changed vs the base branch only                         |
| `format`           | yes       | `prettier --check .`                                                |
| `build`            | yes       | `npm run build`                                                     |
| `secret-scan`      | yes       | gitleaks (note: it has not flagged keys already present in history) |
| `dependency-audit` | **no**    | `npm audit --audit-level=high`                                      |

Because typecheck/lint are non-blocking, **run them locally and compare with the baseline**
(`main` currently has 11 type errors; a PR must not add more).

## Testing

There is **no automated test suite** yet. Until one exists:

- Run `typecheck`, `lint` (changed files), `format:check`, `build`.
- Manually exercise: report submission (incl. voice, camera, duplicate prompt), upvote, admin
  transition flow, delete, sign-in/out, PulseBot with and without a Groq key.

## Pull request checklist

- [ ] Builds locally; no new type errors; Prettier clean
- [ ] No secrets, tokens or personal data added (including in `storage/*.json`)
- [ ] Schema changes included in `supabase/schema.sql` with an idempotent migration
- [ ] API changes mirrored in **both** `handleApiRequest` and `civicPulseApiPlugin`, and in
      [api.md](api.md)
- [ ] Docs/ADR updated for architectural decisions
- [ ] Runtime data files (`storage/*.json`) not modified by accident when running the app locally

## Writing an ADR

Copy `docs/adr/0000-template.md` to the next number, fill it in, add it to `docs/adr/README.md`,
and link it from the PR. Supersede rather than rewrite old decisions.

## Dependency hygiene

- Both `bun.lock` and `package-lock.json` exist; update both when changing dependencies (CI uses
  npm).
- Run `npm audit` periodically; see [known-issues.md](known-issues.md) for
  the current advisory picture.
