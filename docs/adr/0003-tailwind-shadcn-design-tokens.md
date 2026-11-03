# ADR-0003: Tailwind CSS v4, shadcn/ui on Radix, and design tokens

- **Status:** Accepted
- **Recorded:** 2026-11-04 (retrospective — rationale inferred from the code and history unless stated)

## Context

The product needs a consistent, accessible, civic-trust look (navy/blue/teal palette) across ~15 pages, with motion that respects reduced-motion preferences.

## Decision

We use **Tailwind CSS v4** with all colors, radii, shadows, motion and typography defined as **tokens in `src/styles.css`**; components must not hardcode colors. UI primitives come from **shadcn/ui** (Radix UI + `components.json`) with `lucide-react` icons and `sonner` toasts.

## Consequences

- Accessible primitives, consistent theming, fast iteration, components are owned (copied) not imported.
  − `components/ui` is generated code; large utility-class strings in pages hurt readability.
  − Token discipline relies on review (no lint rule enforces it).

## Alternatives considered

- **MUI/Chakra** — heavier runtime, harder to match the brand.
- **Plain CSS modules** — slower to build and keep consistent.
