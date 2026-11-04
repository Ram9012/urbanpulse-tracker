/**
 * PulseBot guardrails.
 *
 * Layers (cheapest first):
 *   1. Input sanitising  — only user/assistant turns, bounded count and length,
 *      no client-supplied "system" messages, control characters stripped.
 *   2. Injection screen  — deterministic patterns for obvious jailbreak /
 *      prompt-extraction attempts, answered with a canned reply (no model call).
 *   3. Scoped system prompt — the model must prefix any out-of-scope answer with
 *      OUT_OF_SCOPE_TOKEN; the server then replaces it with a canned refusal so
 *      off-topic content never reaches the user.
 *   4. Output screen — strips reasoning/HTML and blocks replies that leak the
 *      prompt or name the underlying AI vendor.
 *
 * Pattern screens are best-effort, not a security boundary: the real controls
 * are that the model never gets tools or secrets, only sees data the citizen's
 * own browser supplied, and its output is escaped before rendering.
 */

export const MAX_HISTORY_MESSAGES = 10;
export const MAX_MESSAGE_CHARS = 800;
export const MAX_REPLY_CHARS = 1800;
export const OUT_OF_SCOPE_TOKEN = "[OUT_OF_SCOPE]";

export const REFUSAL_REPLY =
  "I can only help with civic services on CivicPulse — tracking your complaints, how to report an " +
  "issue, expected repair timelines, the stages a report goes through, and municipal helpline numbers. " +
  "Is there something like that I can help you with?";

export const INJECTION_REPLY =
  "I can't help with that. I'm here for civic services on CivicPulse — for example checking the " +
  "status of a complaint or explaining how to report an issue. What would you like to know?";

export const LEAK_REPLY =
  "Sorry, I couldn't put together a proper answer to that. I can help with tracking complaints, " +
  "reporting an issue, repair timelines and municipal helplines — what would you like to know?";

export type ChatTurn = { role: "user" | "assistant"; content: string };

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Keep only well-formed user/assistant turns; never trust client-supplied roles. */
export function sanitizeMessages(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const turns: ChatTurn[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const cleaned = content.replace(CONTROL_CHARS, "").trim().slice(0, MAX_MESSAGE_CHARS);
    if (cleaned) turns.push({ role, content: cleaned });
  }
  const recent = turns.slice(-MAX_HISTORY_MESSAGES);
  // The conversation must end on a user turn.
  while (recent.length && recent[recent.length - 1]!.role !== "user") recent.pop();
  return recent;
}

/** Single-line, bounded, tag-free text for values interpolated into the prompt. */
export function sanitizeField(value: unknown, max = 80): string {
  if (typeof value !== "string") return "";
  return value
    .replace(CONTROL_CHARS, " ")
    .replace(/[<>`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier|your)\s+(instructions?|rules?|prompts?|directions?)/i,
  /disregard\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier|your)/i,
  /forget\s+(everything|all|your)\s+(you|instructions?|rules?|above)/i,
  /(reveal|show|print|repeat|display|output|leak|tell me)\s+(me\s+)?(your|the)\s+(system|initial|hidden|original|secret)?\s*(prompt|instructions?|rules?|configuration)/i,
  /what\s+(is|are|were)\s+your\s+(system\s+)?(prompt|instructions?|rules?)/i,
  /\b(system|developer)\s*(prompt|message|instructions?)\b/i,
  /you\s+are\s+now\s+(a|an|in|no longer|dan|free|unrestricted|my)\b/i,
  /\b(act|behave|respond|pretend)\s+(as|like)\s+(if\s+you\s+(are|were)\s+)?(a|an|the)?\s*(dan|developer|jailbroken|unrestricted|evil)/i,
  /\b(jailbreak|jail-break|dan mode|developer mode|do anything now)\b/i,
  /pretend\s+(you|to)\s+(are|be|have)\b/i,
  /(bypass|override|disable|turn off)\s+(your\s+)?(safety|guard\s*rails?|filters?|restrictions?|rules?)/i,
  /\bwhich\s+(llm|model|ai)\s+(are\s+you|powers|is\s+behind)\b/i,
  /<\s*\/?\s*(system|assistant|instructions?)\s*>/i,
];

export function detectInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(text));
}

const VENDOR_PATTERN =
  /\b(openai|gpt-?\d*|chatgpt|groq|qwen|llama|gemini|google ai|anthropic|claude|mistral)\b/i;
const PROMPT_LEAK_MARKERS =
  /(SECURITY RULES|OUT_OF_SCOPE|CITIZEN CONTEXT|SCOPE OF HELP|<citizen_reports>|system prompt)/i;

/**
 * Final pass over the model's reply. Returns the text to show the citizen and
 * whether anything was intercepted (for logging).
 */
export function screenReply(raw: string): { reply: string; intercepted: boolean } {
  // Drop reasoning blocks some models emit.
  let reply = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  if (reply.startsWith(OUT_OF_SCOPE_TOKEN) || reply.includes(OUT_OF_SCOPE_TOKEN)) {
    return { reply: REFUSAL_REPLY, intercepted: true };
  }
  if (!reply) return { reply: LEAK_REPLY, intercepted: true };
  if (PROMPT_LEAK_MARKERS.test(reply) || VENDOR_PATTERN.test(reply)) {
    return { reply: LEAK_REPLY, intercepted: true };
  }

  // Defence in depth: the UI also escapes, but never ship markup from the model.
  reply = reply.replace(/<[^>]*>/g, "").slice(0, MAX_REPLY_CHARS);
  return { reply, intercepted: false };
}
