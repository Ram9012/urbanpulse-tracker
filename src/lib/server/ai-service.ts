/**
 * CivicPulse AI Engine (Groq + Secondary Providers)
 * Handles:
 * 1. Report understanding & summarization
 * 2. Priority recommendation with reasoning
 * 3. Duplicate semantic analysis
 * 4. Resolution evidence verification (Before vs After)
 * 5. Workflow anomaly / SLA delay detection
 * 6. Workload analytics assistant for municipal staff
 */

const GROQ_API_KEY = process.env["GROQ_API_KEY"] || "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";
const GROQ_BASE_URL = process.env["GROQ_BASE_URL"] || "https://api.groq.com/openai/v1";
const GROQ_MODEL = process.env["GROQ_MODEL"] || "qwen/qwen3.8-27b";

async function callGroqChat(messages: Array<{ role: string; content: string }>, jsonMode = true, maxTokens = 600) {
  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.1,
      max_tokens: maxTokens,
      response_format: jsonMode ? { type: "json_object" } : undefined,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  return jsonMode ? JSON.parse(content) : content;
}

/**
 * AI Service 1 & 2: Report Understanding, Summarization & Priority Recommendation
 */
export async function analyzeReportDescription(description: string, categoryName?: string) {
  const prompt = `You are the CivicPulse Municipal AI Assistant.
Analyze this civic issue report submitted by a citizen:
"${description}"
${categoryName ? `Selected category: "${categoryName}"` : ""}

Return a strictly valid JSON object with:
{
  "summary": "1 concise sentence summarizing the exact issue and location mentioned",
  "keywords": ["array", "of", "3-5", "key", "terms"],
  "severity_signals": ["specific hazards like 'road obstruction', 'flooding risk', 'accident hazard'"],
  "priority_recommendation": "critical" | "high" | "medium" | "low",
  "priority_reason": "Specific operational rationale for the priority recommendation",
  "confidence": 0.94
}`;

  return await callGroqChat([
    { role: "system", content: "You are an expert municipal infrastructure dispatcher. Always return valid JSON." },
    { role: "user", content: prompt },
  ]);
}

/**
 * AI Service 3: Duplicate Analysis (Compares new report description with nearby existing reports)
 */
export async function analyzeDuplicateReport(
  newDescription: string,
  existingReport: { id: string; title: string; description: string; area: string }
) {
  const prompt = `Compare these two civic reports to check if they describe the SAME real-world incident/issue:

NEW REPORT:
"${newDescription}"

EXISTING REPORT (${existingReport.id}):
Title: "${existingReport.title}"
Description: "${existingReport.description}"
Area: "${existingReport.area}"

Return a strictly valid JSON object:
{
  "is_duplicate": true or false,
  "similarity_score": number between 0 and 100,
  "explanation": "Clear explanation comparing location and nature of the two reports",
  "recommended_action": "add_info_to_existing" | "keep_separate"
}`;

  return await callGroqChat([
    { role: "system", content: "You are an intelligent municipal duplicate detection service. Always return valid JSON." },
    { role: "user", content: prompt },
  ]);
}

/**
 * AI Service 5: Resolution Evidence Analysis (Before vs After comparison)
 */
export async function verifyResolutionEvidence(
  originalReport: { title: string; description: string; category: string },
  resolutionNotes: string,
  mediaLabels: string[] = []
) {
  const prompt = `Verify if field worker completion evidence satisfies the original civic complaint:

ORIGINAL REPORT:
Category: ${originalReport.category}
Title: ${originalReport.title}
Description: ${originalReport.description}

WORKER RESOLUTION EVIDENCE:
Worker notes: "${resolutionNotes}"
Uploaded media items: ${JSON.stringify(mediaLabels)}

Analyze whether this resolution appears genuine, consistent with the original problem, or if it looks incomplete/suspicious.
Return a strictly valid JSON object:
{
  "consistent": true or false,
  "confidence": number between 0 and 100,
  "assessment": "Detailed assessment of the evidence",
  "recommendation": "send_for_staff_approval" | "request_more_evidence" | "flag_suspicious",
  "flags": ["any suspicious signals or empty array if normal"]
}`;

  return await callGroqChat([
    { role: "system", content: "You are a municipal quality-assurance supervisor assistant. Always return valid JSON." },
    { role: "user", content: prompt },
  ]);
}

/**
 * AI Service 7: Department Workload & Anomaly Analytics Assistant
 */
export async function generateWorkloadInsights(departmentData: any) {
  const prompt = `You are the CivicPulse Municipal Operations Advisor.
Analyze this departmental workload data:
${JSON.stringify(departmentData, null, 2)}

Provide actionable executive operational insights for municipal directors.
Return a strictly valid JSON object:
{
  "overview": "2-sentence high level summary of municipal performance",
  "key_bottlenecks": ["2-3 specific bottleneck observations with wards/departments"],
  "recommended_actions": ["2-3 concrete staffing or resource redistribution steps"],
  "sla_alerts": ["immediate priority warnings if any"]
}`;

  return await callGroqChat([
    { role: "system", content: "You are a municipal executive operations advisor. Always return valid JSON." },
    { role: "user", content: prompt },
  ]);
}
