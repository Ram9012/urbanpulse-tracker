# Configuration

Configuration is via environment variables (`.env` locally, Vercel Project Settings in production).
`.env` and `.env.*` are git-ignored except `.env.example`. **Never commit real values.**

## Variables read by the code

| Variable                             | Used in              | Required   | Purpose                                                                           |
| ------------------------------------ | -------------------- | ---------- | --------------------------------------------------------------------------------- |
| `GROQ_API_KEY`                       | `ai-service.ts`      | For AI     | Groq API key. **Must be set explicitly — see warning below.**                     |
| `GROQ_BASE_URL`                      | `ai-service.ts`      | No         | Default `https://api.groq.com/openai/v1`                                          |
| `GROQ_MODEL`                         | `ai-service.ts`      | No         | Default `qwen/qwen3.8-27b`; chatbot also tries fallback models                    |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | `supabase-client.ts` | For sync   | Project URL                                                                       |
| `SUPABASE_SERVICE_ROLE_KEY`          | `supabase-client.ts` | For sync   | Preferred server key (bypasses RLS) — server-side only                            |
| `VITE_SUPABASE_ANON_KEY`             | `supabase-client.ts` | Fallback   | Used only if no service-role key; note `VITE_*` vars are bundled into client code |
| `SUPABASE_PROJECT_NAME`              | `supabase-client.ts` | No         | Display name in status endpoint                                                   |
| `SERPAPI_API_KEY`                    | `api-middleware.ts`  | For search | Municipal web search                                                              |
| `VERCEL`, `AWS_LAMBDA_FUNCTION_NAME` | storage modules      | auto       | Detected to switch storage to `/tmp`                                              |
| `NITRO_PRESET`                       | build script         | build      | Set to `vercel` by `npm run build`                                                |

## Variables in `.env.example` that nothing reads

`CEREBRAS_*`, `CLOUDFLARE_API_KEY`, `ZENSERP_API_KEY`, `SUPABASE_DB_PASSWORD`,
`VITE_COMPANY_NAME`. They are unused placeholders.

## ⚠️ Fallback secrets and hardcoded defaults in code

Some source files fall back to embedded values when an env var is missing:

- `ai-service.ts` — a default `GROQ_API_KEY`
- `api-middleware.ts` — a default `SERPAPI_API_KEY`
- `supabase-client.ts` — a default `SUPABASE_URL`

Because the repository is public, embedded keys must be treated as **compromised**: rotate them,
set the real values in the environment, and delete the fallbacks. This is tracked as the top item in
[known-issues.md](known-issues.md) and [security.md](security.md).

## Client vs server variables

Anything prefixed `VITE_` is injected into the browser bundle. Keep secrets (service-role key, API
keys) **without** the `VITE_` prefix.

## Build/CI configuration files

| File                              | Purpose                                                      |
| --------------------------------- | ------------------------------------------------------------ |
| `vite.config.ts`                  | Vite + Lovable TanStack config, dev API plugin, Nitro preset |
| `vercel.json`                     | `framework: null`, build command with `NITRO_PRESET=vercel`  |
| `tsconfig.json`                   | Strict TS, path alias `@/*` → `src/*`                        |
| `eslint.config.js`, `.prettierrc` | Lint / format rules                                          |
| `components.json`                 | shadcn/ui generator config                                   |
| `bunfig.toml`                     | Bun install settings (24 h release-age guard)                |
| `.github/workflows/ci.yml`        | CI pipeline ([development.md](development.md))               |
