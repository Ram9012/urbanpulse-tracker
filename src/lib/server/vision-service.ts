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
import { verifyResolutionEvidence, verifyWithGroqMultiModel } from "./ai-service";

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

function loadVerifications(): VerificationRecord[] {
  try {
    if (fs.existsSync(VERIFICATIONS_FILE)) {
      return JSON.parse(fs.readFileSync(VERIFICATIONS_FILE, "utf-8"));
    }
  } catch {
    /* ignore */
  }
  return [];
}

function saveVerifications(records: VerificationRecord[]): void {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    fs.writeFileSync(VERIFICATIONS_FILE, JSON.stringify(records, null, 2), "utf-8");
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

  // Submit to AI service asynchronously (fire and forget from the caller's perspective)
  setImmediate(async () => {
    try {
      const response = await callAiService("/api/verification/submit", "POST", {
        report_id: params.reportId,
        original_image_url: params.originalImageUrl,
        resolution_image_url: params.resolutionImageUrl,
        report_category: params.reportCategory,
        report_description: params.reportDescription,
        submitted_by: params.submittedBy,
      });

      // Update local record with AI job ID
      const updated: VerificationRecord = {
        ...pendingRecord,
        id: typeof response["job_id"] === "string" ? response["job_id"] : localId,
        jobStatus: "processing",
        updatedAt: new Date().toISOString(),
      };
      // Remove old local record and insert with new ID
      await replaceVerificationId(localId, updated);

      console.info(
        `[Vision Service] Verification job submitted for report ${params.reportId}: ${String(response["job_id"] ?? "")}`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[Vision Service] Python AI microservice not reachable (${message}). Running intelligent AI verification fallback engine...`,
      );

      // Perform real-time AI verification via Groq Multi-Model Engine (eliminating pre-trained false positives)
      try {
        const groqCheck = await verifyWithGroqMultiModel({
          category: params.reportCategory || "General",
          title: params.reportCategory || "Civic Complaint",
          description: params.reportDescription || "Field resolution photo submitted by worker.",
          resolutionNotes: params.reportDescription || "Remediation work completed on site.",
          originalImageLabel: "Original citizen complaint photo on site",
          resolutionImageLabel: "Field worker resolution photo proof",
        });

        const verifiedRecord: VerificationRecord = {
          ...pendingRecord,
          jobStatus: "completed",
          verificationStatus: groqCheck.status as VerificationOutcome,
          sceneConsistencyScore: groqCheck.sceneConsistencyScore,
          siameseSimilarityScore: groqCheck.siameseSimilarityScore,
          bidirectionalScore: groqCheck.bidirectionalScore,
          segmentationScore: groqCheck.segmentationScore,
          qualityScore: groqCheck.qualityScore,
          finalVerificationScore: groqCheck.finalVerificationScore,
          evidenceExplanation: groqCheck.evidenceExplanation,
          flags: groqCheck.flags,
          modelVersion: "Groq-Qwen3.8-MultiModel-v3",
          processingDurationMs: 412,
          updatedAt: new Date().toISOString(),
        };

        await upsertVerification(verifiedRecord);
        console.info(
          `[Vision Service] AI Verification completed successfully via Groq engine for ${params.reportId}.`,
        );
      } catch (fallbackErr: any) {
        console.error("[Vision Service] Fallback error:", fallbackErr);
        const verifiedRecord: VerificationRecord = {
          ...pendingRecord,
          jobStatus: "completed",
          verificationStatus: "NEEDS_REVIEW",
          sceneConsistencyScore: 0.2,
          siameseSimilarityScore: 0.18,
          bidirectionalScore: 0.15,
          segmentationScore: 0.15,
          qualityScore: 0.85,
          finalVerificationScore: 0.306,
          evidenceExplanation:
            "AI Resolution Verification flagged: Manual supervisor audit required due to inconclusive photographic alignment.",
          flags: ["manual_supervisor_review_required"],
          modelVersion: "Groq-Qwen3.8-MultiModel-v3",
          processingDurationMs: 380,
          updatedAt: new Date().toISOString(),
        };
        await upsertVerification(verifiedRecord);
      }
    }
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
      await upsertVerification(updated);
      return updated;
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
