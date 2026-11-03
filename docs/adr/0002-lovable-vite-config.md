# ADR-0002: Build through @lovable.dev/vite-tanstack-config

- **Status:** Accepted
- **Recorded:** 2026-11-04 (retrospective — rationale inferred from the code and history unless stated)

## Context

The scaffold wires TanStack Start, React, Tailwind, tsconfig paths, Nitro, VITE_* injection, React/TanStack dedupe and error-logging plugins. `vite.config.ts` warns not to add these manually or the app breaks (duplicate plugins).

## Decision

We keep `vite.config.ts` minimal: `defineConfig` from `@lovable.dev/vite-tanstack-config`, adding only the CivicPulse API plugin (`civicPulseApiPlugin`), the custom server entry (`server: { entry: "server" }`) and the `vercel` Nitro preset.

## Consequences

- Less config to maintain; plugin ordering handled for us.
  − Coupled to a third-party wrapper (its releases are exempt from Bun's 24 h release-age guard in `bunfig.toml`).
  − Harder to debug build issues; must not duplicate its plugins.
  − Its default Nitro target is Cloudflare; we override to Vercel.

## Alternatives considered

- **Hand-written Vite config** — full control, but we would own plugin integration and upgrades.
