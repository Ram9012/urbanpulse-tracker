/**
 * CivicPulse — AI Vision Service Bridge
 *
 * Server-side TypeScript module that communicates with the Python
 * AI Verification Microservice running at AI_SERVICE_URL.
 *
 * If the AI service is unavailable:
 * - The resolution upload is NOT blocked.
 * - A pending verification record is created for manual review.
 * - An admin notification is generated.
 *
 * This module is intentionally separate from ai-service.ts (the Groq LLM
 * integration) so the two AI subsystems can evolve independently.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  verifyResolutionEvidence,
  assessResolutionWithVision,
  visionConfig,
  type ResolutionVlmAssessment,
} from "./ai-service";

const AI_SERVICE_URL = process.env["AI_SERVICE_URL"] || "http://localhost:8001";

const AI_SERVICE_TOKEN =
  process.env["AI_SERVICE_SECRET_KEY"] || "civicpulse-ai-secret-change-in-production";

const AI_SERVICE_TIMEOUT_MS = parseInt(process.env["AI_SERVICE_TIMEOUT_MS"] || "5000", 10);

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type VerificationJobStatus = "pending" | "processing" | "completed" | "failed";

export type VerificationOutcome =
  "VERIFIED" | "NEEDS_REVIEW" | "INSUFFICIENT_EVIDENCE" | "PENDING" | "UNAVAILABLE";

export type VerificationRecord = {
  id: string;
  reportId: string;
  originalImageUrl: string;
  resolutionImageUrl: string;
  jobStatus: VerificationJobStatus;
  verificationStatus: VerificationOutcome;
  sceneConsistencyScore?: number | undefined;
  siameseSimilarityScore?: number | undefined;
  bidirectionalScore?: number | undefined;
  segmentationScore?: number | undefined;
  qualityScore?: number | undefined;
  finalVerificationScore?: number | undefined;
  evidenceExplanation?: string | undefined;
  flags?: string[] | undefined;
  modelVersion?: string | undefined;
  processingDurationMs?: number | undefined;
  isSuspectedDuplicate?: boolean | undefined;
  /** Vision-language model: is the defect from the original photo actually fixed? (0-1) */
  resolutionScore?: number | undefined;
  /** Vision-language model: do both photos show the same place? (0-1) */
  locationMatchScore?: number | undefined;
  /** Vision-language model sub-scores (0-1). */
  surroundingsScore?: number | undefined;
  viewpointScore?: number | undefined;
  defectVisibleScore?: number | undefined;
  repairQualityScore?: number | undefined;
  /** Why the optional Siamese/ORB/segmentation checks did not run (Python service). */
  geometricError?: string | undefined;
  vlmVerdict?: ResolutionVlmAssessment["verdict"] | undefined;
  vlmModel?: string | undefined;
  /** Why the image-analysis model could not run, in plain language. Absent when it ran. */
  visionError?: string | undefined;
  /** Vision assessment kept on the record until the Python pipeline finishes, then merged. */
  pendingVlm?: ResolutionVlmAssessment | undefined;
  adminDecision?: "approved" | "rejected" | "manual_review" | undefined;
  adminDecisionBy?: string | undefined;
  adminDecisionAt?: string | undefined;
  adminDecisionNote?: string | undefined;
  createdAt: string;
  updatedAt: string;
};

// ──────────────────────────────────────────────────────────────────────────────
// Local verification store (JSON file)
// ──────────────────────────────────────────────────────────────────────────────

const IS_VERCEL = Boolean(process.env["VERCEL"] || process.env["AWS_LAMBDA_FUNCTION_NAME"]);
const STORAGE_DIR = IS_VERCEL
  ? path.join("/tmp", "civic-storage")
  : path.join(process.cwd(), "storage");

const VERIFICATIONS_FILE = path.join(STORAGE_DIR, "civic-verifications.json");

// Last successfully-read snapshot. If the file is momentarily unreadable
// (e.g. mid-write on another request) we serve this instead of an empty
// list, which the UI would otherwise render as "Awaiting Verification".
let lastGoodSnapshot: VerificationRecord[] = [];

function loadVerifications(): VerificationRecord[] {
  try {
    if (fs.existsSync(VERIFICATIONS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(VERIFICATIONS_FILE, "utf-8"));
      if (Array.isArray(parsed)) {
        lastGoodSnapshot = parsed;
        return parsed;
      }
    }
  } catch {
    // Partial/corrupt read — fall back to the last good snapshot.
    return lastGoodSnapshot.map((v) => ({ ...v }));
  }
  return lastGoodSnapshot.map((v) => ({ ...v }));
}

function saveVerifications(records: VerificationRecord[]): void {
  lastGoodSnapshot = records.map((v) => ({ ...v }));
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    // Atomic write: readers never observe a half-written file.
    const tmp = `${VERIFICATIONS_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(records, null, 2), "utf-8");
    fs.renameSync(tmp, VERIFICATIONS_FILE);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[Vision Service] Failed to persist verifications:", message);
  }
}

// Serializes every read-modify-write cycle against the verifications file
// within this process. Node is single-threaded, but an `await` inside an
// unprotected load→mutate→save sequence still lets two concurrent requests
// interleave and clobber each other's write — this chains them instead.
let verificationsMutex: Promise<unknown> = Promise.resolve();

function withVerificationsLock<T>(fn: (all: VerificationRecord[]) => T): Promise<T> {
  const run = verificationsMutex.then(() => {
    const all = loadVerifications();
    const result = fn(all);
    saveVerifications(all);
    return result;
  });
  // Keep the chain alive even if this step rejects, so later callers aren't
  // stuck behind a permanently-rejected promise.
  verificationsMutex = run.catch(() => undefined);
  return run;
}

export function getVerificationsForReport(reportId: string): VerificationRecord[] {
  const all = loadVerifications();
  const list = all
    .filter((v) => v.reportId.toLowerCase() === reportId.toLowerCase())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Normalize finalVerificationScore from percentages (>1) to [0, 1] range if needed
  let modified = false;
  for (const v of list) {
    if (typeof v.finalVerificationScore === "number" && v.finalVerificationScore > 1) {
      v.finalVerificationScore = Math.round((v.finalVerificationScore / 100) * 1000) / 1000;
      modified = true;
    }
  }

  if (modified) {
    saveVerifications(all);
  }

  return list;
}

export function getVerificationById(id: string): VerificationRecord | null {
  const all = loadVerifications();
  return all.find((v) => v.id === id) || null;
}

export function upsertVerification(record: VerificationRecord): Promise<void> {
  return withVerificationsLock((all) => {
    const idx = all.findIndex((v) => v.id === record.id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...record };
    } else {
      all.unshift(record);
    }
  });
}

/**
 * Replace a record's id (used when the local pending id is superseded by
 * the AI microservice's real job id) and apply the given updates, under
 * the same lock as every other write so this can't race a concurrent
 * upsert/poll for the same record.
 */
function replaceVerificationId(oldId: string, updated: VerificationRecord): Promise<void> {
  return withVerificationsLock((all) => {
    const filtered = all.filter((v) => v.id !== oldId);
    filtered.unshift(updated);
    all.length = 0;
    all.push(...filtered);
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Image upload helpers
// ──────────────────────────────────────────────────────────────────────────────

const UPLOADS_DIR = IS_VERCEL
  ? path.join("/tmp", "civic-uploads")
  : path.join(process.cwd(), "public", "media", "uploads");

export async function saveUploadedImage(
  dataUrl: string,
  reportId: string,
  slot: "worker" | "resolution",
): Promise<string> {
  if (dataUrl.startsWith("data:")) {
    if (IS_VERCEL) {
      // /tmp is a private, ephemeral lambda directory — Vercel never serves
      // it over HTTP, so writing there and returning a "/tmp/..." URL would
      // 404 in the browser. Until real object storage (e.g. a Storage
      // bucket) is wired up here, return the data: URL itself so the image
      // still renders — it just won't persist beyond this request/response.
      return dataUrl;
    }

    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    const timestamp = Date.now();
    const filename = `${reportId}_${slot}_${timestamp}.jpg`;
    const filePath = path.join(UPLOADS_DIR, filename);
    const parts = dataUrl.split(",");
    const base64 = parts[1] ?? "";
    fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
    return `/media/uploads/${filename}`;
  }

  // Already a URL or path — return as-is
  return dataUrl;
}

// ──────────────────────────────────────────────────────────────────────────────
// AI Service communication
// ──────────────────────────────────────────────────────────────────────────────

async function callAiService(
  endpoint: string,
  method: "GET" | "POST",
  body?: unknown,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_SERVICE_TIMEOUT_MS);

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-service-token": AI_SERVICE_TOKEN,
      },
      signal: controller.signal,
    };
    if (body !== undefined) {
      fetchOptions.body = JSON.stringify(body);
    }
    const response = await fetch(`${AI_SERVICE_URL}${endpoint}`, fetchOptions);
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`AI service returned HTTP ${response.status}`);
    }
    return (await response.json()) as Record<string, unknown>;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export async function checkAiServiceHealth(): Promise<boolean> {
  try {
    const data = await callAiService("/health", "GET");
    return data["status"] === "healthy";
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Hybrid verification: Siamese/ORB (same place?) + vision-language model (fixed?)
// ──────────────────────────────────────────────────────────────────────────────

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const FETCH_TIMEOUT_MS = 15000;

/** Resolve a data: URL, local /media path or http(s) URL into a base64 data URL. */
async function loadImageAsDataUrl(src: string): Promise<string> {
  if (!src || typeof src !== "string") throw new Error("Image URL is missing");
  if (src.startsWith("data:image/")) return src;
  if (src.startsWith("data:")) throw new Error("Embedded file is not an image");
  if (src.startsWith("blob:")) {
    throw new Error(
      "Photo is a browser-only blob: URL that the server cannot read (upload did not complete)",
    );
  }
  if (/^https?:\/\//i.test(src)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(src, { signal: controller.signal });
      if (!res.ok) throw new Error(`Image fetch failed (${res.status}): ${src.slice(0, 120)}`);
      let mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "";
      if (!mime.startsWith("image/")) {
        mime = MIME_BY_EXT[path.extname(new URL(src).pathname).toLowerCase()] || "";
      }
      if (!mime) throw new Error(`URL did not return an image: ${src.slice(0, 120)}`);
      return `data:${mime};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
    } finally {
      clearTimeout(timer);
    }
  }
  const rel = src.replace(/^\/+/, "");
  const publicDir = path.resolve(process.cwd(), "public");
  const abs = path.resolve(publicDir, rel);
  if (!abs.startsWith(publicDir)) throw new Error("Image path outside public directory");
  if (!fs.existsSync(abs)) throw new Error(`Photo not found on the server: ${src.slice(0, 120)}`);
  const mime = MIME_BY_EXT[path.extname(abs).toLowerCase()] || "image/jpeg";
  return `data:${mime};base64,${fs.readFileSync(abs).toString("base64")}`;
}

/** Plain-language reason the optional Python checks did not run. */
function describeServiceError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/HTTP 401/i.test(raw)) {
    return "the service token does not match (AI_SERVICE_SECRET_KEY must equal AI_API_SECRET_KEY)";
  }
  if (/HTTP \d+/i.test(raw)) return `the service returned an error (${raw.slice(0, 80)})`;
  return `the Python AI service is not running at ${AI_SERVICE_URL}`;
}

/** Plain-language reason for a failed image analysis, shown to staff. */
function describeVisionError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/GEMINI_API_KEY is not configured/i.test(raw)) {
    return "the image-analysis key (GEMINI_API_KEY) is not configured on the server";
  }
  if (/\((401|403)\)|API key not valid|PERMISSION_DENIED/i.test(raw)) {
    return "the image-analysis API key was rejected";
  }
  if (/\(429\)|RESOURCE_EXHAUSTED|quota/i.test(raw)) {
    return "the image-analysis service is rate-limited or out of quota";
  }
  if (/\(5\d\d\)|UNAVAILABLE|overloaded/i.test(raw)) {
    return "the image-analysis service is temporarily unavailable";
  }
  if (/too large/i.test(raw)) return raw;
  if (
    /not found on the server|blob:|Image fetch failed|did not return an image|not an image|missing/i.test(
      raw,
    )
  ) {
    return `one of the photos could not be read (${raw.slice(0, 140)})`;
  }
  if (/abort|timeout|fetch failed|ECONN|ENOTFOUND/i.test(raw)) {
    return "the image-analysis service could not be reached";
  }
  return raw.slice(0, 180);
}

const isTransient = (err: unknown) =>
  /\(429\)|\(5\d\d\)|RESOURCE_EXHAUSTED|UNAVAILABLE|abort|timeout|fetch failed|ECONN/i.test(
    err instanceof Error ? err.message : String(err),
  );

async function runVisionAssessment(params: {
  originalImageUrl: string;
  resolutionImageUrl: string;
  reportCategory?: string | undefined;
  reportDescription?: string | undefined;
}): Promise<ResolutionVlmAssessment> {
  const [originalDataUrl, resolutionDataUrl] = await Promise.all([
    loadImageAsDataUrl(params.originalImageUrl),
    loadImageAsDataUrl(params.resolutionImageUrl),
  ]);
  const request = {
    originalDataUrl,
    resolutionDataUrl,
    ...(params.reportCategory ? { category: params.reportCategory } : {}),
    ...(params.reportDescription ? { description: params.reportDescription } : {}),
  };
  try {
    return await assessResolutionWithVision(request);
  } catch (err) {
    if (!isTransient(err)) throw err;
    // One retry for rate limits, 5xx and network blips.
    await new Promise((r) => setTimeout(r, 1500));
    return assessResolutionWithVision(request);
  }
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Merge the Siamese/ORB scores (is it the same place?) with the vision model's
 * judgement (is it fixed?) into the final record fields.
 * Either input may be absent; the result degrades gracefully to whichever exists.
 */
function applyHybridVerdict(
  base: VerificationRecord,
  vlm: ResolutionVlmAssessment | undefined,
): VerificationRecord {
  if (!vlm) {
    return base.visionError
      ? { ...base, flags: [...(base.flags ?? []), "image_analysis_unavailable"] }
      : base;
  }

  const geometric = [
    base.sceneConsistencyScore,
    base.siameseSimilarityScore,
    base.bidirectionalScore,
  ].filter((n): n is number => typeof n === "number");
  const locationMatch = geometric.length
    ? avg([...geometric, vlm.sameLocationScore])
    : vlm.sameLocationScore;
  const quality =
    typeof base.qualityScore === "number"
      ? Math.min(base.qualityScore, vlm.evidenceClarityScore)
      : vlm.evidenceClarityScore;
  const finalScore = round3(0.35 * locationMatch + 0.65 * vlm.resolvedScore);

  const flags = new Set([...(base.flags ?? []), ...vlm.flags]);
  if (vlm.looksStagedOrReused) flags.add("resolution_photo_looks_staged_or_reused");
  if (base.isSuspectedDuplicate) flags.add("duplicate_resolution_photo");

  let status: VerificationOutcome;
  if (quality < 0.25) status = "INSUFFICIENT_EVIDENCE";
  else if (
    vlm.verdict === "DIFFERENT_LOCATION" ||
    locationMatch < 0.4 ||
    base.isSuspectedDuplicate ||
    vlm.looksStagedOrReused
  )
    status = "NEEDS_REVIEW";
  else if (vlm.verdict === "RESOLVED" && vlm.resolvedScore >= 0.6 && finalScore >= 0.6)
    status = "VERIFIED";
  else if (vlm.verdict === "NOT_RESOLVED" && vlm.resolvedScore < 0.3)
    status = "INSUFFICIENT_EVIDENCE";
  else status = "NEEDS_REVIEW";

  return {
    ...base,
    // Explicit undefined so the upsert merge clears the stored copy.
    pendingVlm: undefined,
    visionError: undefined,
    jobStatus: "completed",
    verificationStatus: status,
    qualityScore: round3(quality),
    resolutionScore: round3(vlm.resolvedScore),
    locationMatchScore: round3(locationMatch),
    surroundingsScore: round3(vlm.surroundingsMatchScore),
    viewpointScore: round3(vlm.viewpointMatchScore),
    defectVisibleScore: round3(vlm.defectVisibleBeforeScore),
    repairQualityScore: round3(vlm.repairQualityScore),
    finalVerificationScore: finalScore,
    vlmVerdict: vlm.verdict,
    vlmModel: vlm.model,
    evidenceExplanation: vlm.explanation,
    flags: [...flags],
    modelVersion: base.modelVersion ? `${base.modelVersion} + Vision AI` : "Vision AI",
    updatedAt: new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Primary public API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Submit a resolution verification job to the AI microservice.
 *
 * If the AI service is unavailable, creates a local PENDING record
 * so the upload is never lost and can be manually reviewed.
 *
 * This function is non-blocking — it returns quickly.
 * The actual verification runs asynchronously in the Python worker.
 */
export async function submitVerificationJob(params: {
  reportId: string;
  originalImageUrl: string;
  resolutionImageUrl: string;
  reportCategory?: string;
  reportDescription?: string;
  submittedBy?: string;
}): Promise<VerificationRecord> {
  const now = new Date().toISOString();
  const localId = `VER-${Date.now().toString(36).toUpperCase()}`;

  // Create a local PENDING record immediately so the upload is never lost
  const pendingRecord: VerificationRecord = {
    id: localId,
    reportId: params.reportId,
    originalImageUrl: params.originalImageUrl,
    resolutionImageUrl: params.resolutionImageUrl,
    jobStatus: "pending",
    verificationStatus: "PENDING",
    createdAt: now,
    updatedAt: now,
  };

  await upsertVerification(pendingRecord);

  // Run the Siamese/ORB service and the vision-language model side by side.
  setImmediate(async () => {
    const [pythonRes, vlmRes] = await Promise.allSettled([
      callAiService("/api/verification/submit", "POST", {
        report_id: params.reportId,
        original_image_url: params.originalImageUrl,
        resolution_image_url: params.resolutionImageUrl,
        report_category: params.reportCategory,
        report_description: params.reportDescription,
        submitted_by: params.submittedBy,
      }),
      runVisionAssessment(params),
    ]);

    const vlm = vlmRes.status === "fulfilled" ? vlmRes.value : undefined;
    const visionError =
      vlmRes.status === "rejected" ? describeVisionError(vlmRes.reason) : undefined;
    if (vlmRes.status === "rejected") {
      console.warn(`[Vision Service] Image analysis failed for ${params.reportId}:`, vlmRes.reason);
    }

    // Python service accepted the job: keep the VLM result on the record and
    // merge it once polling sees the Siamese/ORB scores complete.
    if (pythonRes.status === "fulfilled") {
      const jobId = pythonRes.value["job_id"];
      await replaceVerificationId(localId, {
        ...pendingRecord,
        id: typeof jobId === "string" ? jobId : localId,
        jobStatus: "processing",
        pendingVlm: vlm,
        visionError,
        updatedAt: new Date().toISOString(),
      });
      console.info(`[Vision Service] Verification job submitted for report ${params.reportId}`);
      return;
    }

    console.warn(
      `[Vision Service] Python AI microservice not reachable (${String(pythonRes.reason)}).`,
    );
    const geometricError = describeServiceError(pythonRes.reason);

    // Python down, vision model worked: vision-only verdict.
    if (vlm) {
      await upsertVerification(
        applyHybridVerdict({ ...pendingRecord, jobStatus: "completed", geometricError }, vlm),
      );
      return;
    }

    // Neither image analysis nor the Siamese/ORB service could run. Never guess from text:
    // hand it to a person and say exactly why.
    await upsertVerification({
      ...pendingRecord,
      jobStatus: "completed",
      verificationStatus: "NEEDS_REVIEW",
      evidenceExplanation: `Automatic image analysis could not run: ${visionError ?? "the verification service is unavailable"}. A supervisor needs to review the before and after photos manually.`,
      flags: ["image_analysis_unavailable", "manual_review_required"],
      modelVersion: "Unavailable",
      geometricError,
      visionError: visionError ?? "the verification service is unavailable",
      updatedAt: new Date().toISOString(),
    });
  });

  return pendingRecord;
}

/**
 * Poll the AI service for the latest result for a verification job.
 * Updates the local record if a result is available.
 */
export async function pollVerificationResult(
  verificationId: string,
): Promise<VerificationRecord | null> {
  const local = getVerificationById(verificationId);
  if (!local) return null;

  // If already completed or failed, return local record
  if (local.jobStatus === "completed" || local.jobStatus === "failed") {
    return local;
  }

  try {
    const response = await callAiService(`/api/verification/${verificationId}`, "GET");

    const pStatus = response["processing_status"];
    const vStatus = response["verification_status"];
    const scores = (response["scores"] || {}) as Record<string, unknown>;
    const details = (response["details"] || {}) as Record<string, unknown>;

    if (pStatus === "completed" || vStatus) {
      const updated: VerificationRecord = {
        ...local,
        jobStatus: pStatus === "completed" ? "completed" : local.jobStatus,
        verificationStatus:
          typeof vStatus === "string" ? (vStatus as VerificationOutcome) : local.verificationStatus,
        sceneConsistencyScore:
          typeof scores["scene_consistency_score"] === "number"
            ? scores["scene_consistency_score"]
            : undefined,
        siameseSimilarityScore:
          typeof scores["siamese_similarity_score"] === "number"
            ? scores["siamese_similarity_score"]
            : undefined,
        bidirectionalScore:
          typeof scores["bidirectional_score"] === "number"
            ? scores["bidirectional_score"]
            : undefined,
        segmentationScore:
          typeof scores["segmentation_score"] === "number"
            ? scores["segmentation_score"]
            : undefined,
        qualityScore:
          typeof scores["quality_score"] === "number" ? scores["quality_score"] : undefined,
        finalVerificationScore:
          typeof scores["final_verification_score"] === "number"
            ? scores["final_verification_score"]
            : undefined,
        evidenceExplanation:
          typeof details["evidence_explanation"] === "string"
            ? details["evidence_explanation"]
            : undefined,
        flags: Array.isArray(details["flags"]) ? (details["flags"] as string[]) : undefined,
        modelVersion:
          typeof details["model_version"] === "string" ? details["model_version"] : undefined,
        processingDurationMs:
          typeof response["processing_duration_ms"] === "number"
            ? response["processing_duration_ms"]
            : undefined,
        isSuspectedDuplicate:
          typeof details["is_suspected_duplicate"] === "boolean"
            ? details["is_suspected_duplicate"]
            : undefined,
        updatedAt: new Date().toISOString(),
      };
      // Fold in the vision model's "is it fixed?" judgement once the
      // Siamese/ORB stage has finished.
      const merged =
        updated.jobStatus === "completed" ? applyHybridVerdict(updated, local.pendingVlm) : updated;
      await upsertVerification(merged);
      return merged;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[Vision Service] Poll failed for ${verificationId}: ${message}`);
  }

  return local;
}

/**
 * Record an administrator decision on a verification record.
 */
export async function recordAdminDecision(
  verificationId: string,
  decision: "approved" | "rejected" | "manual_review",
  adminUsername: string,
  note?: string,
): Promise<VerificationRecord | null> {
  const record = getVerificationById(verificationId);
  if (!record) return null;

  const updated: VerificationRecord = {
    ...record,
    adminDecision: decision,
    adminDecisionBy: adminUsername,
    adminDecisionAt: new Date().toISOString(),
    ...(note !== undefined ? { adminDecisionNote: note } : {}),
    updatedAt: new Date().toISOString(),
  };
  await upsertVerification(updated);
  return updated;
}

/** Status of the optional Python service (Siamese / ORB / segmentation). */
async function getPythonServiceStatus() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${AI_SERVICE_URL}/health`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { models_loaded?: Record<string, boolean> };
    return { url: AI_SERVICE_URL, reachable: true, modelsLoaded: data.models_loaded ?? {} };
  } catch (err) {
    return {
      url: AI_SERVICE_URL,
      reachable: false,
      reason: describeServiceError(err),
      note: "Optional. Without it the verdict uses the vision AI alone.",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Self-test for the image-analysis setup. Sends the two bundled sample photos through the
 * exact same path real verifications use and reports success or the precise reason it failed.
 */
export async function diagnoseVision() {
  const config = visionConfig();
  const pythonService = await getPythonServiceStatus();
  const started = Date.now();
  try {
    const result = await runVisionAssessment({
      originalImageUrl: "/media/evidence/pothole_before.jpg",
      resolutionImageUrl: "/media/evidence/pothole_resolved.jpg",
      reportCategory: "Road & pothole",
    });
    return {
      ok: true,
      config,
      pythonService,
      ms: Date.now() - started,
      verdict: result.verdict,
      sameLocationScore: result.sameLocationScore,
      resolvedScore: result.resolvedScore,
    };
  } catch (err) {
    return {
      ok: false,
      config,
      pythonService,
      ms: Date.now() - started,
      error: describeVisionError(err),
      detail: err instanceof Error ? err.message.slice(0, 400) : String(err).slice(0, 400),
    };
  }
}
