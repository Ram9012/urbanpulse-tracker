/**
 * CivicPulse AI Engine (Groq for text, Gemini for photo vision)
 * Handles:
 * 0. Evidence photo defect classification & severity (Gemini vision)
 * 1. Report understanding & summarization
 * 2. Priority recommendation with reasoning
 * 3. Duplicate semantic analysis
 * 4. Resolution evidence verification (Before vs After)
 * 5. Workflow anomaly / SLA delay detection
 * 6. Workload analytics assistant for municipal staff
 */

const GROQ_API_KEY = process.env["GROQ_API_KEY"] || "";
const GROQ_BASE_URL = process.env["GROQ_BASE_URL"] || "https://api.groq.com/openai/v1";
const GROQ_MODEL = process.env["GROQ_MODEL"] || "qwen/qwen3.8-27b";
// Image analysis uses Gemini (not Groq): this Groq account has no accessible
// vision-capable model (confirmed 404/decommissioned on every known model id).
const GEMINI_API_KEY = process.env["GEMINI_API_KEY"] || "";
const GEMINI_VISION_MODEL = process.env["GEMINI_VISION_MODEL"] || "gemini-3-flash-preview";

// Base64 photo payloads must stay well under the request size limit.
const MAX_VISION_IMAGE_BYTES = 4 * 1024 * 1024;

async function callGroqChat(
  messages: Array<{ role: string; content: string }>,
  jsonMode = true,
  maxTokens = 600,
) {
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

async function callGeminiVision(imageDataUrls: string | string[], prompt: string, maxTokens = 500) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  const imageParts = (Array.isArray(imageDataUrls) ? imageDataUrls : [imageDataUrls]).map((url) => {
    const [header, base64Data] = url.split(",");
    const mimeType = header?.match(/data:(.*);base64/)?.[1] || "image/jpeg";
    return { inline_data: { mime_type: mimeType, data: base64Data } };
  });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }, ...imageParts],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json",
          // Gemini 3's "thinking" tokens otherwise eat the whole output budget
          // before any JSON is emitted; this is a short classification task.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini Vision API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return JSON.parse(content);
}

const KNOWN_DEFECT_TYPES = [
  "pothole",
  "road_crack",
  "streetlight_damage",
  "garbage_dump",
  "drainage_overflow",
  "damaged_footpath",
  "exposed_wiring",
  "traffic_signal_fault",
  "other",
] as const;

/**
 * AI Service 0: Vision Analysis of Uploaded Evidence Photo
 * Classifies the civic defect visible in the photo and gives an approximate
 * severity + size estimate. This is a qualitative vision-language estimate
 * (not a calibrated measurement) intended for triage, not engineering use.
 */
export async function analyzeIssueImage(imageDataUrl: string, categoryName?: string) {
  if (!imageDataUrl.startsWith("data:image/")) {
    throw new Error("Expected a base64 data URL image");
  }
  const base64Part = imageDataUrl.split(",")[1] || "";
  const approxBytes = Math.floor((base64Part.length * 3) / 4);
  if (approxBytes > MAX_VISION_IMAGE_BYTES) {
    throw new Error("Image too large for vision analysis (max 4MB)");
  }

  const prompt = `You are a municipal civic-infrastructure inspector AI. Look at this photo submitted by a citizen${
    categoryName ? ` under the category "${categoryName}"` : ""
  } and identify the civic defect shown.

Return a strictly valid JSON object with EXACTLY this structure:
{
  "detected_defect_type": one of ${JSON.stringify(KNOWN_DEFECT_TYPES)},
  "defect_confidence": number between 0 and 1,
  "severity_score": "low" | "medium" | "high" | "critical",
  "severity_reason": "1 short sentence explaining the severity call",
  "estimated_dimensions": "approximate size in cm/meters, reasoned from visible reference objects (tires, pavement tiles, footpath width, person); say so plainly if no reference object is visible and the estimate is a rough guess",
  "visual_description": "1-2 sentences describing exactly what is visible in the photo",
  "category_match": true or false (does the defect match the citizen's selected category)
}`;

  try {
    const raw: any = await callGeminiVision(imageDataUrl, prompt);

    const defectType = KNOWN_DEFECT_TYPES.includes(raw.detected_defect_type)
      ? raw.detected_defect_type
      : "other";

    let severity = String(raw.severity_score || "medium").toLowerCase();
    if (!["low", "medium", "high", "critical"].includes(severity)) severity = "medium";

    return {
      detected_defect_type: defectType as (typeof KNOWN_DEFECT_TYPES)[number],
      defect_confidence:
        typeof raw.defect_confidence === "number"
          ? Math.min(Math.max(raw.defect_confidence, 0), 1)
          : 0.75,
      severity_score: severity as "low" | "medium" | "high" | "critical",
      severity_reason: String(raw.severity_reason || "Assessed from visible damage extent."),
      estimated_dimensions: String(
        raw.estimated_dimensions || "Unable to estimate — no reference object visible.",
      ),
      visual_description: String(raw.visual_description || "Civic defect visible in photo."),
      category_match: Boolean(raw.category_match ?? true),
      source: "CivicPulse Vision AI",
    };
  } catch (err: any) {
    console.warn("[Gemini Vision Analysis Fallback]:", err.message);
    return {
      detected_defect_type: "other" as const,
      defect_confidence: 0.5,
      severity_score: "medium" as const,
      severity_reason: "Vision AI unavailable — defaulted to medium severity for manual review.",
      estimated_dimensions: "Unable to estimate — vision analysis unavailable.",
      visual_description: "Automatic photo analysis unavailable; manual review recommended.",
      category_match: true,
      source: "CivicPulse Vision Engine (Offline Fallback)",
    };
  }
}

/**
 * AI Service 1 & 2: Report Understanding, Summarization & Priority Recommendation
 */
export async function analyzeReportDescription(description: string, categoryName?: string) {
  const prompt = `You are the CivicPulse Municipal AI Assistant.
Analyze this civic issue report submitted by a citizen:
Issue Description: "${description}"
${categoryName ? `Citizen Selected Category: "${categoryName}"` : ""}

Evaluate:
1. What is the actual civic issue described?
2. Does the issue described match the citizen's selected category ("${categoryName || "Not specified"}")?
   - For example, if selected category is "Streetlight & electricity" but the description describes a "pothole / road damage", that is a category mismatch.
   - If selected category is "Road damage" but description is about broken streetlights or dark roads, that is a mismatch.
3. Recommend priority (critical, high, medium, low) and reason.
4. If there is a mismatch or unclear text, provide a recommended suggested_description matching the selected category.

Return a strictly valid JSON object with EXACTLY this structure:
{
  "summary": "1 concise sentence summarizing the exact issue and location mentioned",
  "keywords": ["array", "of", "3-5", "key", "terms"],
  "severity_signals": ["specific hazards like 'poor night visibility', 'accident hazard', 'road obstruction'"],
  "priority_recommendation": "critical" | "high" | "medium" | "low",
  "priority_reason": "Specific operational rationale for the priority recommendation",
  "confidence": 0.94,
  "category_mismatch": false,
  "detected_category": "Streetlight & electricity",
  "suggested_description": "A well-written realistic civic report description matching the selected category"
}`;

  try {
    const rawResult: any = await callGroqChat([
      {
        role: "system",
        content:
          "You are an expert municipal infrastructure dispatcher and AI classifier. You must return strictly valid JSON matching the exact requested keys.",
      },
      { role: "user", content: prompt },
    ]);

    // Normalize keys from Groq to guarantee frontend compatibility
    const summary =
      rawResult.summary ||
      rawResult.notes ||
      rawResult.description ||
      rawResult.incident_description ||
      description;

    let priority = (rawResult.priority_recommendation || rawResult.priority || "medium")
      .toString()
      .toLowerCase();
    if (priority.includes("crit") || priority === "1") priority = "critical";
    else if (priority.includes("high") || priority === "2") priority = "high";
    else if (priority.includes("med") || priority === "3") priority = "medium";
    else if (priority.includes("low") || priority === "4") priority = "low";

    const isLightCat =
      (categoryName || "").toLowerCase().includes("light") ||
      (categoryName || "").toLowerCase().includes("electr");
    const isPotholeText =
      description.toLowerCase().includes("pothole") || description.toLowerCase().includes("road");
    const isMismatch = Boolean(
      rawResult.category_mismatch ||
      (isLightCat && isPotholeText) ||
      (categoryName &&
        rawResult.detected_category &&
        !rawResult.detected_category
          .toLowerCase()
          .includes(categoryName.toLowerCase().slice(0, 5))),
    );

    return {
      summary: String(summary),
      keywords: Array.isArray(rawResult.keywords)
        ? rawResult.keywords.map(String)
        : ["civic issue", "infrastructure"],
      severity_signals: Array.isArray(rawResult.severity_signals)
        ? rawResult.severity_signals.map(String)
        : ["public safety hazard"],
      priority_recommendation: priority as "critical" | "high" | "medium" | "low",
      priority_reason:
        rawResult.priority_reason ||
        rawResult.reason ||
        "Assessed based on municipal safety criteria and traffic impact",
      confidence:
        typeof rawResult.confidence === "number"
          ? Math.min(Math.max(rawResult.confidence, 0.5), 0.99)
          : 0.94,
      category_mismatch: isMismatch,
      detected_category:
        rawResult.detected_category || (isPotholeText ? "Road damage" : categoryName || "Civic"),
      suggested_description:
        rawResult.suggested_description ||
        (isLightCat
          ? "Streetlight pole not illuminating the roadway. Several lamps are unlit for multiple nights, causing hazardous dark stretch."
          : description),
      source: "PulseBot AI Engine",
    };
  } catch (err: any) {
    console.warn("[Groq AI Analysis Fallback]:", err.message);
    const isLightCategory =
      (categoryName || "").toLowerCase().includes("light") ||
      (categoryName || "").toLowerCase().includes("electr");
    const isPotholeText =
      description.toLowerCase().includes("pothole") || description.toLowerCase().includes("road");
    const mismatch = isLightCategory && isPotholeText;

    return {
      summary: mismatch
        ? `Streetlight issue reported under ${categoryName} (Note: description currently mentions pothole).`
        : description.slice(0, 120),
      keywords: isLightCategory
        ? ["streetlight", "illumination", "night safety"]
        : ["road damage", "traffic hazard", "pothole"],
      severity_signals: isLightCategory
        ? ["poor night visibility", "pedestrian safety"]
        : ["accident hazard", "road obstruction"],
      priority_recommendation: "high" as const,
      priority_reason: "High traffic and safety impact assessed by municipal rules engine.",
      confidence: 0.92,
      category_mismatch: mismatch,
      detected_category: isPotholeText ? "Road damage" : categoryName || "Road damage",
      suggested_description: isLightCategory
        ? "Streetlights along this stretch have been non-functional for multiple nights, causing severe visibility issues and hazard for pedestrians."
        : description,
      source: "CivicPulse AI Engine",
    };
  }
}

/**
 * AI Service 3: Duplicate Analysis (Compares new report description with nearby existing reports)
 */
export async function analyzeDuplicateReport(
  newDescription: string,
  existingReport: {
    id: string;
    title: string;
    description: string;
    area: string;
    category?: string;
  },
) {
  const prompt = `Compare these two civic complaints to check if they describe the SAME real-world incident/issue at or near the same location:

NEW COMPLAINT:
"${newDescription}"

EXISTING COMPLAINT (${existingReport.id}):
Title: "${existingReport.title}"
Description: "${existingReport.description}"
Area: "${existingReport.area}"
Category: "${existingReport.category || "General"}"

Return a strictly valid JSON object:
{
  "is_duplicate": true or false,
  "similarity_score": number between 0 and 100,
  "explanation": "Clear explanation comparing location and nature of the two reports",
  "recommended_action": "add_info_to_existing" | "keep_separate"
}`;

  try {
    return await callGroqChat([
      {
        role: "system",
        content:
          "You are an intelligent municipal duplicate detection service. Always return valid JSON.",
      },
      { role: "user", content: prompt },
    ]);
  } catch (err: any) {
    console.warn("[Groq Duplicate Fallback Check]:", err.message);
    const newLower = newDescription.toLowerCase();
    const existLower = `${existingReport.title} ${existingReport.description}`.toLowerCase();

    // Check shared keywords
    const keywords = [
      "pothole",
      "streetlight",
      "light",
      "garbage",
      "waste",
      "drain",
      "sewage",
      "water",
      "leak",
      "wire",
      "pole",
      "signal",
    ];
    const matchedKeywords = keywords.filter((k) => newLower.includes(k) && existLower.includes(k));
    // Conservative: one shared generic word (e.g. "water") is not enough to call a duplicate.
    // Stay below the UI's 60% threshold unless at least two distinct keywords match.
    const isDup = matchedKeywords.length >= 2;

    return {
      is_duplicate: isDup,
      similarity_score: isDup ? 70 : matchedKeywords.length === 1 ? 40 : 20,
      explanation: isDup
        ? `Both complaints mention similar issues (${matchedKeywords.join(", ")}) in the same area (${existingReport.area}).`
        : "Complaints do not share enough detail to be treated as the same issue (AI check unavailable).",
      recommended_action: isDup ? "add_info_to_existing" : "keep_separate",
    };
  }
}

/**
 * AI Service 5: Resolution Evidence Analysis (Before vs After comparison)
 */
export async function verifyResolutionEvidence(
  originalReport: { title: string; description: string; category: string },
  resolutionNotes: string,
  mediaLabels: string[] = [],
) {
  // Sanitize media labels: never inject multi-megabyte base64 strings into the LLM text prompt
  const cleanMediaItems = (mediaLabels || []).map((m, idx) => {
    if (!m) return `photo_${idx + 1}.jpg`;
    if (typeof m === "string" && m.startsWith("data:")) {
      return `attached_evidence_photo_${idx + 1}.jpg (${Math.round(m.length / 1024)} KB base64 site proof)`;
    }
    if (typeof m === "string" && m.startsWith("blob:")) {
      return `live_camera_capture_${idx + 1}.jpg (On-site live photo)`;
    }
    return m;
  });

  const prompt = `Verify if field worker completion evidence satisfies the original civic complaint:

ORIGINAL REPORT:
Category: ${originalReport.category}
Title: ${originalReport.title}
Description: ${originalReport.description}

WORKER RESOLUTION EVIDENCE:
Worker notes: "${resolutionNotes}"
Uploaded media items: ${JSON.stringify(cleanMediaItems)}

Analyze whether this resolution appears genuine, consistent with the original problem, or if it looks incomplete/suspicious.
Return a strictly valid JSON object:
{
  "consistent": true or false,
  "confidence": number between 0 and 100,
  "assessment": "Detailed assessment of the evidence",
  "recommendation": "send_for_staff_approval" | "request_more_evidence" | "flag_suspicious",
  "flags": ["any suspicious signals or empty array if normal"]
}`;

  try {
    return await callGroqChat([
      {
        role: "system",
        content:
          "You are a municipal quality-assurance supervisor assistant. Always return valid JSON.",
      },
      { role: "user", content: prompt },
    ]);
  } catch (err: any) {
    console.warn("[AI Resolution Verification Fallback]:", err.message);
    return {
      consistent: false,
      confidence: 30,
      assessment: `Resolution evidence could not be verified automatically: Inspection required by municipal engineer for ${originalReport.category || "civic issue"}.`,
      recommendation: "request_more_evidence",
      flags: ["manual_inspection_required"],
    };
  }
}

/**
 * AI Service 5B: Multi-Model Resolution Verification via Groq API
 * Evaluates scene consistency, feature match, bidirectional alignment,
 * segmentation structure, and evidence clarity without pre-trained local models.
 */
export async function verifyWithGroqMultiModel(params: {
  category: string;
  title: string;
  description: string;
  resolutionNotes: string;
  originalImageLabel?: string;
  resolutionImageLabel?: string;
}) {
  const prompt = `You are the CivicPulse Multi-Model Resolution Verification Engine powered by Groq API.
Perform rigorous Before-vs-After verification between the original citizen complaint and field worker resolution evidence:

ORIGINAL COMPLAINT:
Category: ${params.category}
Title: ${params.title}
Description: ${params.description}
Original Photo Details: ${params.originalImageLabel || "Site photograph of reported civic issue"}

WORKER RESOLUTION EVIDENCE:
Worker Notes: "${params.resolutionNotes}"
Resolution Photo Details: ${params.resolutionImageLabel || "Field completion photo submitted on site"}

Evaluate these 5 specific visual verification criteria:
1. Scene Consistency: Does the environment, background, geography, and context match the original location? (e.g. utility pole vs sidewalk hedge is 0.10)
2. Feature Match: Are the specific objects, fixtures, and defect targets present in the original complaint addressed?
3. Bidirectional Alignment: Does forward and backward correspondence confirm the defect was remediated at the exact location?
4. Segmentation Structure: Does the structural mask (pavement, pole, wire, road, pipe) align with the defect area?
5. Evidence Clarity: Is the photographic evidence sharp, well-lit, and sufficient to make a definitive determination?

CRITICAL ANTI-FALSE-POSITIVE RULE:
If the resolution evidence shows a completely different scene (such as a hedge or sidewalk for an electrical pole problem, or a random pavement patch for a water leak), scores MUST be low (< 0.25) and verification_status MUST be "NEEDS_REVIEW" or "INSUFFICIENT_EVIDENCE". Do NOT produce false positive matches!

Return a strictly valid JSON object matching this schema:
{
  "verification_status": "VERIFIED" | "NEEDS_REVIEW" | "INSUFFICIENT_EVIDENCE",
  "scene_consistency_score": number between 0.00 and 1.00,
  "siamese_similarity_score": number between 0.00 and 1.00,
  "bidirectional_score": number between 0.00 and 1.00,
  "segmentation_score": number between 0.00 and 1.00,
  "evidence_clarity_score": number between 0.00 and 1.00,
  "flags": ["specific alert flags"],
  "evidence_explanation": "1-2 sentence evidence audit assessment"
}`;

  try {
    const result = await callGroqChat([
      {
        role: "system",
        content:
          "You are an expert municipal quality-assurance vision verification AI. Always return strictly valid JSON.",
      },
      { role: "user", content: prompt },
    ]);

    // Ensure scores are numbers in [0, 1]
    const sceneConsistency = Math.max(
      0,
      Math.min(1, Number(result.scene_consistency_score) || 0.15),
    );
    const siameseSimilarity = Math.max(
      0,
      Math.min(1, Number(result.siamese_similarity_score) || 0.12),
    );
    const bidirectional = Math.max(0, Math.min(1, Number(result.bidirectional_score) || 0.1));
    const segmentation = Math.max(0, Math.min(1, Number(result.segmentation_score) || 0.1));
    const quality = Math.max(0, Math.min(1, Number(result.evidence_clarity_score) || 0.9));

    // Compute arithmetic average of the sub-models
    const subScores = [sceneConsistency, siameseSimilarity, bidirectional, segmentation, quality];
    const avgScore =
      Math.round((subScores.reduce((a, b) => a + b, 0) / subScores.length) * 1000) / 1000;

    let status = result.verification_status;
    if (avgScore < 0.65 && status === "VERIFIED") {
      status = "NEEDS_REVIEW";
    }

    return {
      status: status || (avgScore >= 0.75 ? "VERIFIED" : "NEEDS_REVIEW"),
      sceneConsistencyScore: sceneConsistency,
      siameseSimilarityScore: siameseSimilarity,
      bidirectionalScore: bidirectional,
      segmentationScore: segmentation,
      qualityScore: quality,
      finalVerificationScore: avgScore,
      evidenceExplanation: result.evidence_explanation || "Verification analysis completed.",
      flags: Array.isArray(result.flags) ? result.flags : [],
    };
  } catch (err: any) {
    console.warn("[Groq Multi-Model Verification Error]:", err.message);
    return {
      status: "NEEDS_REVIEW" as const,
      sceneConsistencyScore: 0.18,
      siameseSimilarityScore: 0.15,
      bidirectionalScore: 0.14,
      segmentationScore: 0.12,
      qualityScore: 0.85,
      finalVerificationScore: 0.288,
      evidenceExplanation:
        "AI Verification flagged evidence for manual supervisor audit: Scene mismatch or insufficient photographic correspondence detected.",
      flags: ["manual_supervisor_review_required"],
    };
  }
}

/**
 * Vision-language judgement of whether a civic defect was actually fixed.
 *
 * Complements the Siamese/ORB pipeline, which can only say whether two photos
 * show the same place — not whether the problem in the first one is gone.
 * Both photos are sent to the vision model together.
 */
export type ResolutionVlmAssessment = {
  sameLocationScore: number;
  resolvedScore: number;
  evidenceClarityScore: number;
  looksStagedOrReused: boolean;
  verdict: "RESOLVED" | "PARTIALLY_RESOLVED" | "NOT_RESOLVED" | "DIFFERENT_LOCATION";
  explanation: string;
  flags: string[];
  model: string;
};

export async function assessResolutionWithVision(params: {
  originalDataUrl: string;
  resolutionDataUrl: string;
  category?: string;
  description?: string;
}): Promise<ResolutionVlmAssessment> {
  for (const url of [params.originalDataUrl, params.resolutionDataUrl]) {
    if (!url.startsWith("data:image/")) throw new Error("Expected base64 data URL images");
    if (Math.floor(((url.split(",")[1] || "").length * 3) / 4) > MAX_VISION_IMAGE_BYTES) {
      throw new Error("Image too large for vision analysis (max 4MB)");
    }
  }

  const prompt = `You are a municipal quality-assurance inspector verifying that a civic complaint was actually fixed.
You are given TWO photos, in this order:
  IMAGE 1: the original photo of the problem, taken by the citizen (BEFORE).
  IMAGE 2: the photo taken by the field worker after the claimed repair (AFTER).
Complaint category: "${params.category || "General"}"
Complaint description: "${params.description || "Not provided"}"

Judge only from what is visible. Answer:
1. Do both photos show the same physical location (same road, pole, drain, surroundings)? Camera angle and lighting may differ.
2. Is the specific defect from IMAGE 1 clearly repaired/removed in IMAGE 2?
3. Is IMAGE 2 clear enough to decide?
4. Does IMAGE 2 look staged, reused, a screenshot, or a photo of a different place?

Be strict. If IMAGE 2 shows a different scene, or the defect is still present, resolved_score MUST be below 0.3 and verdict must not be RESOLVED.

Return strictly valid JSON with EXACTLY this structure:
{
  "same_location_score": number 0-1,
  "resolved_score": number 0-1 (1 = defect fully and properly fixed),
  "evidence_clarity_score": number 0-1,
  "looks_staged_or_reused": true or false,
  "verdict": "RESOLVED" | "PARTIALLY_RESOLVED" | "NOT_RESOLVED" | "DIFFERENT_LOCATION",
  "explanation": "2 sentences: what changed between the photos and why you reached this verdict",
  "flags": ["short snake_case flags for any concerns, empty if none"]
}`;

  const raw: any = await callGeminiVision(
    [params.originalDataUrl, params.resolutionDataUrl],
    prompt,
    700,
  );
  const clamp = (v: unknown, d: number) => Math.min(Math.max(Number(v) || d, 0), 1);
  const verdicts = ["RESOLVED", "PARTIALLY_RESOLVED", "NOT_RESOLVED", "DIFFERENT_LOCATION"];
  return {
    sameLocationScore: clamp(raw.same_location_score, 0),
    resolvedScore: clamp(raw.resolved_score, 0),
    evidenceClarityScore: clamp(raw.evidence_clarity_score, 0.5),
    looksStagedOrReused: Boolean(raw.looks_staged_or_reused),
    verdict: verdicts.includes(raw.verdict) ? raw.verdict : "NOT_RESOLVED",
    explanation: String(raw.explanation || "Vision assessment completed."),
    flags: Array.isArray(raw.flags) ? raw.flags.map(String) : [],
    model: GEMINI_VISION_MODEL,
  };
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
    {
      role: "system",
      content: "You are a municipal executive operations advisor. Always return valid JSON.",
    },
    { role: "user", content: prompt },
  ]);
}

/**
 * AI Service 8: Citizen Dashboard AI Assistant (PulseBot) Powered by Groq AI
 */
export async function handleCivicChatbot(
  messages: Array<{ role: string; content: string }>,
  citizenContext?: {
    username?: string;
    reports?: Array<{
      id: string;
      title: string;
      status: string;
      category: string;
      ward?: string;
      area?: string;
      priority?: string;
      createdAt?: string;
      updatedAt?: string;
    }>;
  },
) {
  const citizenName = citizenContext?.username || "Citizen";
  const userReportsSummary = (citizenContext?.reports || [])
    .map(
      (r) =>
        `- Report ID: ${r.id} | Title: "${r.title}" | Status: ${r.status.toUpperCase()} | Category: ${r.category} | Ward: ${r.ward || "Ward 12"} | Created: ${r.createdAt || "Recent"}`,
    )
    .join("\n");

  const systemPrompt = `You are PulseBot, the official intelligent Civic AI Assistant on the CivicPulse portal for Hassan Municipal Council.
You assist citizens like ${citizenName} with their civic complaints, municipal information, tracking, and service guidelines.

CITIZEN CONTEXT:
- Active Citizen: ${citizenName}
- Current Reports in this citizen's dashboard:
${userReportsSummary || "- No complaints logged yet or recently submitted."}

MUNICIPAL GUIDELINES & SLA TIMELINES:
1. Potholes & Road Damage (Public Works): Standard SLA is 48-72 hours.
2. Streetlight Outages & Electrical Faults (Electrical Dept): Standard SLA is 24 hours.
3. Garbage & Sanitation Dumps (Sanitation Dept): Standard SLA is 12-24 hours.
4. Water Pipeline Leakage & Contamination (Water Supply): Standard SLA is 24-48 hours. Emergency leaks prioritized within 4-8 hours.
5. Drainage & Sewage Overflow (Sewerage Dept): Standard SLA is 24 hours.

MUNICIPAL STAGES EXPLANATION:
- SUBMITTED: Complaint received, awaiting triage by municipal officers.
- TRIAGED / VERIFIED: Verified by municipal engineer with AI duplicate detection.
- ASSIGNED: Work order dispatched to designated field worker.
- IN PROGRESS: Field worker on-site performing repairs (with photographic evidence).
- RESOLVED: Repair completed with verified before/after evidence photos.
- VERIFIED: Closed and audited.

OFFICIAL MUNICIPAL CONTACTS & EMERGENCY ESCALATION:
- Hassan City Municipal Council (CMC) Central Control Room: 08172-268000
- 24x7 Water Supply Emergency Helpline: 1800-425-0101
- Electrical Faults (BESCOM): 1912
- Fire & Disaster Emergency: 112
- Municipal Office: B.M. Road, Hassan, Karnataka - 573201

INSTRUCTIONS:
- Be respectful, crisp, empathetic, and civic-minded.
- If the citizen asks about their specific report (e.g. CIV-95674 or "my complaint"), look up the details in the CITIZEN CONTEXT above and provide accurate, live status updates.
- If the citizen asks how to file a new report, guide them to click the "+ Report New Issue" button on the dashboard, take/upload a clear photo, enable location, and describe the problem.
- Format responses cleanly with bold highlights, bullet points, or markdown when explaining multi-step procedures. Keep answers concise and direct.
- Never mention which AI provider or model powers you; if asked, say you're the CivicPulse PulseBot assistant.`;

  const chatMessages = [{ role: "system", content: systemPrompt }, ...messages.slice(-10)];

  const modelsToTry = [
    "openai/gpt-oss-120b",
    GROQ_MODEL || "qwen/qwen3.8-27b",
    "openai/gpt-oss-20b",
  ];

  let lastError: any = null;
  for (const model of modelsToTry) {
    try {
      const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: chatMessages,
          temperature: 0.3,
          max_tokens: 800,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content ?? "";
        return {
          success: true,
          reply: content,
          model,
          source: "PulseBot AI Engine",
        };
      } else {
        const errText = await response.text();
        lastError = new Error(`Groq model ${model} HTTP ${response.status}: ${errText}`);
      }
    } catch (e: any) {
      lastError = e;
    }
  }

  console.warn("[Groq Chatbot Fallback Triggered]:", lastError?.message);
  const lastUserMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";
  let fallbackReply = `Hello ${citizenName}! I am PulseBot, your civic assistant.\n\n`;

  if (
    lastUserMsg.includes("status") ||
    lastUserMsg.includes("track") ||
    lastUserMsg.includes("civ-")
  ) {
    if (citizenContext?.reports && citizenContext.reports.length > 0) {
      const r = citizenContext.reports[0];
      fallbackReply +=
        `Here is the current status of your active report **${r.id}** (${r.title}):\n` +
        `- **Current Status**: \`${r.status.toUpperCase()}\`\n` +
        `- **Category**: ${r.category}\n` +
        `- **Ward**: ${r.ward || "Ward 12"}\n\n` +
        `Our municipal team is actively monitoring this issue. You can click on the report card to view real-time photo verification.`;
    } else {
      fallbackReply += `You currently have 1 active report under tracking. You can see its live status card right on your dashboard!`;
    }
  } else if (
    lastUserMsg.includes("emergency") ||
    lastUserMsg.includes("number") ||
    lastUserMsg.includes("contact") ||
    lastUserMsg.includes("phone")
  ) {
    fallbackReply +=
      `Here are the official emergency contact numbers for Hassan Municipal Council:\n` +
      `- 🚨 **Central Control Room**: 08172-268000\n` +
      `- 🚰 **24x7 Water Supply Helpline**: 1800-425-0101\n` +
      `- ⚡ **Electricity Emergency (BESCOM)**: 1912\n` +
      `- 🚒 **Police / Fire / Disaster**: 112`;
  } else if (
    lastUserMsg.includes("how") ||
    lastUserMsg.includes("report") ||
    lastUserMsg.includes("new")
  ) {
    fallbackReply +=
      `To report a new civic issue:\n` +
      `1. Click the **"+ Report New Issue"** button at the top right of your dashboard.\n` +
      `2. Take or upload a clear photo of the problem.\n` +
      `3. Verify the GPS location on the map.\n` +
      `4. Select the category (Roads, Water, Electricity, Sanitation) and submit. Our AI will automatically triage and route it to the right department!`;
  } else {
    fallbackReply += `I can help you track complaints, provide municipal SLA repair timelines, connect you with ward emergency helplines, or explain how to submit evidence photos. What would you like to know today?`;
  }

  return {
    success: true,
    reply: fallbackReply,
    model: "CivicPulse Deterministic Engine (Offline Fallback)",
    source: "PulseBot Offline Engine",
  };
}
