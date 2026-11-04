# Getting Started

## Prerequisites

- **Node.js 20+** (CI uses 20) and either **Bun** (recommended by the project) or **npm**
- Git, and a modern browser (Chrome/Edge for voice dictation)
- Optional: a Groq API key, a Supabase project, a SerpAPI key — the app runs without them using
  fallbacks

## Install & run

```bash
git clone https://github.com/Ram9012/urbanpulse-tracker.git
cd urbanpulse-tracker
bun install        # or: npm ci
cp .env.example .env
bun run dev        # http://localhost:8080
```

`bun run dev` starts Vite with the CivicPulse API middleware, so UI and `/api/*` share one port.

## What works without any keys

| Feature                      | Without keys                                           |
| ---------------------------- | ------------------------------------------------------ |
| Reporting, dashboards, admin | Fully functional with local JSON storage in `storage/` |
| AI classification / chatbot  | Deterministic offline fallbacks                        |
| Supabase sync                | Skipped (status endpoint reports "not connected")      |
| Municipal search             | Needs SerpAPI                                          |
| Maps                         | Works (OpenStreetMap needs no key)                     |

## Demo accounts

The seeded accounts live in `src/lib/server/seed-users.ts` and `storage/civic-users.json`
(an `admin` account and several citizens). Credentials are intentionally weak demo data and must be
replaced before any real deployment — see [security.md](security.md).

## Common tasks

| Task                      | Command                                                                |
| ------------------------- | ---------------------------------------------------------------------- |
| Type-check                | `bun run typecheck`                                                    |
| Lint                      | `bun run lint`                                                         |
| Format (write / check)    | `bun run format` / `bun run format:check`                              |
| Production build (Vercel) | `bun run build` (sets `NITRO_PRESET=vercel`)                           |
| Preview the build         | `bun run preview`                                                      |
| Reset demo data           | `git checkout -- storage/` (or call the admin clean-database endpoint) |

## Troubleshooting

| Symptom                                          | Likely cause / fix                                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `typecheck` shows ~11 errors on a clean checkout | Known pre-existing errors; CI treats typecheck as non-blocking. Make sure _you_ add none.           |
| Voice button does nothing                        | Browser lacks Web Speech API (use Chrome/Edge) or mic permission denied                             |
| Reports disappear on Vercel after some time      | `/tmp` storage is ephemeral; configure Supabase ([deployment.md](deployment.md))                    |
| Supabase writes silently fail                    | Missing columns — re-run `supabase/schema.sql` (notably `upvoted_by`); check `/api/supabase/status` |
| AI replies say "Offline Fallback"                | Groq key missing/invalid or rate-limited                                                            |
| Port 8080 busy                                   | Stop the other process; the dev config uses strict port                                             |
| `routeTree.gen.ts` changed after adding a route  | Expected; it is generated — commit it                                                               |
