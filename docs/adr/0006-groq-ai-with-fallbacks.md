# ADR-0006: Groq LLM for AI features, always advisory, always with a fallback

- **Status:** Accepted
- **Recorded:** 2026-11-04 (retrospective — rationale inferred from the code and history unless stated)

## Context

Features such as classification, duplicate detection, resolution verification, workload insights and the PulseBot chatbot benefit from an LLM, but civic decisions must stay human-reviewed, the demo must work offline, and calls must not block core flows.

## Decision

We call Groq's OpenAI-compatible `/chat/completions` (default model `qwen/qwen3.8-27b`, overridable; the chatbot tries several models in order) at low temperature (0.1 for structured tasks, 0.3 for chat) with prompts demanding strict JSON. Every AI feature has a **deterministic fallback** (`mockClassify`, keyword duplicate heuristic, rule-based chatbot reply labelled "Offline Fallback"). AI output is shown as a suggestion with an edit path; resolution verification runs under an ~800 ms budget.

## Consequences

- Very low latency/cost; app degrades gracefully without the LLM.
- Humans stay in the loop.
  − Fallback quality is much lower (keyword matching can mis-flag duplicates; mitigated by requiring ≥ 2 shared keywords).
  − Prompts embed raw user text (prompt-injection risk); no rate limiting on paid calls.
  − A default API key was embedded in source (see [security.md](../security.md)).

## Alternatives considered

- **OpenAI/Anthropic APIs** — higher quality/cost, similar integration.
- **Self-hosted model** — ops burden.
- **Rules only** — no natural-language understanding.
