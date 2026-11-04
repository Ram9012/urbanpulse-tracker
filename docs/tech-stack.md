# Tech Stack

Versions are the ranges in `package.json` (resolved versions are in the lockfiles).

## Application

| Area           | Technology                                                              | Version                     | Why / notes                                                                 | ADR  |
| -------------- | ----------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------- | ---- |
| Language       | TypeScript (strict, `exactOptionalPropertyTypes`)                       | ^5.8                        | One language end-to-end                                                     | 0001 |
| UI library     | React                                                                   | ^19.2                       | Ecosystem, concurrent rendering                                             | 0001 |
| Framework      | TanStack Start (SSR) + TanStack Router                                  | start ^1.169, router ^1.170 | Type-safe file-based routing, SSR, server entry control                     | 0001 |
| Data fetching  | TanStack Query                                                          | ^5.101                      | Cache/async state (alongside direct `fetch` in pages)                       | 0001 |
| Build tool     | Vite                                                                    | ^8.2                        | Fast dev server; hosts the dev API plugin                                   | 0002 |
| Build wrapper  | `@lovable.dev/vite-tanstack-config`                                     | ^2.12                       | Project template (origin: Lovable); bundles TanStack/Tailwind/Nitro plugins | 0002 |
| Server runtime | Nitro (Vercel preset)                                                   | 3.0.x beta                  | Produces Vercel output from TanStack Start                                  | 0004 |
| Styling        | Tailwind CSS v4                                                         | ^4.2                        | Utility CSS + design tokens                                                 | 0003 |
| Components     | shadcn/ui on Radix UI primitives, `lucide-react` icons, `sonner` toasts | various                     | Accessible, owned components (`components.json`)                            | 0003 |
| Forms          | react-hook-form (+ `@hookform/resolvers`)                               | ^7.71                       | Form state                                                                  | —    |
| Validation     | zod                                                                     | ^3.24                       | Declared dependency, **not imported by app code today**                     | —    |
| Charts         | Recharts                                                                | ^2.15                       | Admin / impact dashboards                                                   | —    |
| Maps           | Leaflet + OpenStreetMap tiles + Nominatim                               | leaflet ^1.9                | Free, no API key                                                            | 0009 |
| Dates          | date-fns                                                                | ^4.1                        | Formatting                                                                  | —    |

## Backend services

| Service        | Used for                                                                                                                     | Access                                | ADR  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---- |
| Supabase       | Postgres persistence (reports, history, notifications, users); Realtime/Storage/Auth available but only REST is used         | REST with service-role or anon key    | 0005 |
| Groq           | LLM: classification, duplicate check, resolution verification, workload insights, chatbot (default model `qwen/qwen3.8-27b`) | OpenAI-compatible `/chat/completions` | 0006 |
| SerpAPI        | "Municipal search" results shown to users                                                                                    | REST, API key                         | —    |
| OpenStreetMap  | Map tiles and Nominatim reverse/forward geocoding                                                                            | Public endpoints                      | 0009 |
| Web Speech API | Voice dictation of the report description (browser-native)                                                                   | Client-side                           | —    |

`.env.example` also lists Cerebras, Cloudflare and Zenserp keys; **no code currently uses them**.

## Tooling & delivery

| Area            | Technology                                     | Notes                                                                          | ADR  |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------------------------ | ---- |
| Package manager | Bun (`bun.lock`) and npm (`package-lock.json`) | Both lockfiles are committed; CI uses `npm ci`                                 | 0013 |
| Lint / format   | ESLint 9, Prettier 3                           | `bun run lint`, `bun run format:check`                                         | 0014 |
| CI              | GitHub Actions (`.github/workflows/ci.yml`)    | install, typecheck, lint (changed files), format, build, gitleaks, `npm audit` | 0014 |
| Hosting         | Vercel (`vercel.json`, `NITRO_PRESET=vercel`)  | Preview deploys per PR                                                         | 0004 |
| Supply-chain    | `bunfig.toml` `minimumReleaseAge = 86400`      | Skips package versions younger than 24 h (Bun only)                            | 0013 |

## Alternatives considered (inferred)

| Choice         | Alternatives             | Why the choice likely won                                    |
| -------------- | ------------------------ | ------------------------------------------------------------ |
| TanStack Start | Next.js, Remix           | Template provided by the Lovable scaffold; type-safe routing |
| Supabase       | Firebase, plain Postgres | Postgres + RLS + REST/Realtime with no server to run         |
| Groq           | OpenAI, self-hosted      | Very low latency and a free tier suited to a demo            |
| Leaflet/OSM    | Google Maps, Mapbox      | No API key or billing                                        |
