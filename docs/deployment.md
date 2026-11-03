# Deployment

## Topology

```
GitHub (main) ──▶ Vercel (Nitro "vercel" preset, serverless functions + static assets)
                    │
                    ├──▶ Supabase Postgres (durable data)
                    ├──▶ Groq (AI)         └──▶ SerpAPI (search)
```

- **Build command:** `NITRO_PRESET=vercel vite build` (set in `vercel.json` and `npm run build`);
  output goes to `.vercel/output`.
- `vercel.json` sets `"framework": null` — Vercel does not auto-detect a framework.
- Every PR gets a **Vercel preview deployment**; `main` deploys to production.

## First-time setup

1. **Supabase:** create a project, then run `supabase/schema.sql` in the SQL editor.
2. **Vercel:** import the GitHub repo and add environment variables
   ([configuration.md](configuration.md)): `GROQ_API_KEY`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SERPAPI_API_KEY` (optional), `GROQ_MODEL` (optional).
   Use server-side names (no `VITE_` prefix) for secrets.
3. Deploy `main`. Check `GET /api/supabase/status` returns `connected: true`.
4. Smoke test: sign in, submit a report, check it appears in Supabase `reports`.

## Release checklist (dev → main)

- [ ] CI on the PR: `install`, `format`, `build`, `secret-scan` green; typecheck error count not
      above main's baseline
- [ ] Vercel preview deployed and smoke-tested (report flow, upvote, admin transition, chatbot)
- [ ] Database migrations applied to production **before** merging (e.g.
      `ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS upvoted_by TEXT[] DEFAULT '{}';`)
- [ ] No secrets or demo/test data in the diff (`git diff origin/main...origin/dev --stat`)
- [ ] `docs/` and ADRs updated for architectural changes
- [ ] Rollback plan noted (below)

## Rollback

- **Code:** in Vercel, promote the previous production deployment (instant), then `git revert` the
  merge commit on `main` via a PR.
- **Database:** schema changes here are additive (`ADD COLUMN IF NOT EXISTS`), so code rollback
  does not require a DB rollback. Avoid destructive migrations without a backup.

## Production caveats (read before going live)

1. **Ephemeral filesystem.** On Vercel the JSON files live in `/tmp` and vanish on cold start or
   differ per container. Without Supabase, data is lost; with Supabase, writes are
   fire-and-forget and the app does not reload reports from it on cold start
   ([ADR-0005](adr/0005-hybrid-persistence.md)). Fixing this is the highest-value reliability work.
2. **No server-side auth** on any endpoint ([security.md](security.md)).
3. **Single-instance assumptions.** In-memory state means two concurrent function instances can
   diverge (e.g. upvote counts).
4. **Secrets in source.** Rotate and remove embedded fallback keys before launch.
5. **No monitoring.** Only `console.*` logs in Vercel; add error tracking and uptime checks.

## Operations

| Need                  | How                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| View logs             | Vercel dashboard → Deployment → Functions logs                                                   |
| Check DB connectivity | `GET /api/supabase/status`                                                                       |
| Reset demo data       | `/api/admin/clean-database` (**destructive, unauthenticated** — protect or remove before launch) |
| Rotate a secret       | Update the Vercel env var → redeploy                                                             |
