/**
 * CivicPulse — Supabase Client & Persistence Bridge
 *
 * Uses the official @supabase/supabase-js client with the service-role key.
 * No hardcoded project URL/key fallback: if env vars are missing, every
 * function here is a safe no-op and checkSupabaseStatus() reports exactly
 * why, instead of silently talking to an unrelated/guessed project.
 */

import crypto from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CivicReport, Priority, ReportStatus } from "../civic-data";
import { StatusHistoryEntry } from "./status-engine";

/** Reverse of saveReportToSupabase's mapping — Supabase row -> CivicReport. */
function rowToCivicReport(row: any): CivicReport {
  return {
    id: row.id,
    title: row.title,
    category: row.category_id,
    categoryLabel: row.category_label,
    description: row.description,
    ward: row.ward,
    area: row.area,
    status: (row.status || "SUBMITTED").toLowerCase() as ReportStatus,
    priority: (row.priority || "medium") as Priority,
    department: row.department_name,
    worker: row.worker_name || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    aiConfidence: row.ai_confidence ?? 0.9,
    duplicateProbability: row.duplicate_probability ?? 0,
    upvotes: row.upvotes ?? 0,
    upvotedBy: row.upvoted_by || [],
    anonymous: Boolean(row.anonymous),
    x: row.x ?? 50,
    y: row.y ?? 50,
    mediaUrls: row.media_paths || [],
    resolutionMediaUrls: row.resolution_media_paths || [],
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    resolutionNotes: row.resolution_notes || undefined,
    reportedBy: row.citizen_username || undefined,
  };
}

/** Reverse of saveStatusHistoryToSupabase's mapping. */
function rowToStatusHistoryEntry(row: any): StatusHistoryEntry {
  return {
    id: row.id,
    reportId: row.report_id,
    oldStatus: row.old_status ? (row.old_status.toLowerCase() as ReportStatus) : null,
    newStatus: (row.new_status || "submitted").toLowerCase() as ReportStatus,
    changedBy: row.changed_by,
    role: row.role || "Staff",
    changedAt: row.changed_at,
    comment: row.comment || "",
    metadata: row.metadata || undefined,
  };
}

const SUPABASE_URL = process.env["SUPABASE_URL"] || "";
const SUPABASE_KEY =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["VITE_SUPABASE_ANON_KEY"] || "";
const SUPABASE_PROJECT_NAME = process.env["SUPABASE_PROJECT_NAME"] || "(unnamed)";
const STORAGE_BUCKET = process.env["SUPABASE_STORAGE_BUCKET"] || "report-media";

const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
    : null;

export type SupabaseStatus = {
  configured: boolean;
  connected: boolean;
  projectName: string;
  url: string;
  hasKey: boolean;
  message: string;
};

export async function checkSupabaseStatus(): Promise<SupabaseStatus> {
  if (!SUPABASE_URL) {
    return {
      configured: false,
      connected: false,
      projectName: SUPABASE_PROJECT_NAME,
      url: "",
      hasKey: false,
      message:
        "SUPABASE_URL is not set. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your environment to enable cloud sync.",
    };
  }
  if (!supabase) {
    return {
      configured: true,
      connected: false,
      projectName: SUPABASE_PROJECT_NAME,
      url: SUPABASE_URL,
      hasKey: false,
      message: "SUPABASE_URL is set but no key (SUPABASE_SERVICE_ROLE_KEY) was found.",
    };
  }

  try {
    const { error } = await supabase.from("reports").select("id", { count: "exact", head: true });
    if (!error) {
      return {
        configured: true,
        connected: true,
        projectName: SUPABASE_PROJECT_NAME,
        url: SUPABASE_URL,
        hasKey: true,
        message: "Successfully connected to Supabase PostgreSQL & Storage.",
      };
    }
    return {
      configured: true,
      connected: false,
      projectName: SUPABASE_PROJECT_NAME,
      url: SUPABASE_URL,
      hasKey: true,
      message: `Supabase reachable but query failed: ${error.message}. Run the schema SQL for this project.`,
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      projectName: SUPABASE_PROJECT_NAME,
      url: SUPABASE_URL,
      hasKey: true,
      message: `Connection attempt error: ${err.message}`,
    };
  }
}

/**
 * Save / Upsert report to Supabase PostgreSQL
 */
export async function saveReportToSupabase(report: CivicReport): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("reports").upsert({
      id: report.id,
      tracking_id: report.id,
      title: report.title,
      description: report.description,
      category_id: report.category,
      category_label: report.categoryLabel,
      ward: report.ward,
      area: report.area,
      status: report.status.toUpperCase(),
      priority: report.priority,
      department_name: report.department,
      worker_name: report.worker,
      media_paths: report.mediaUrls || [],
      resolution_notes: report.resolutionNotes,
      resolution_media_paths: report.resolutionMediaUrls || [],
      latitude: report.latitude,
      longitude: report.longitude,
      upvotes: report.upvotes || 0,
      upvoted_by: report.upvotedBy || [],
      anonymous: report.anonymous,
      citizen_username: report.anonymous ? null : report.reportedBy || null,
      created_at: report.createdAt,
      updated_at: report.updatedAt,
    });
    if (error) {
      console.warn("[Supabase Sync Report Warning]:", error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn("[Supabase Sync Report Warning]:", err.message);
    return false;
  }
}

/**
 * Save status history audit log to Supabase PostgreSQL
 */
export async function saveStatusHistoryToSupabase(entry: StatusHistoryEntry): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("report_status_history").insert({
      id: entry.id,
      report_id: entry.reportId,
      old_status: entry.oldStatus ? entry.oldStatus.toUpperCase() : null,
      new_status: entry.newStatus.toUpperCase(),
      changed_by: entry.changedBy,
      role: entry.role,
      changed_at: entry.changedAt,
      comment: entry.comment,
      metadata: entry.metadata || {},
    });
    if (error) {
      console.warn("[Supabase Sync History Warning]:", error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn("[Supabase Sync History Warning]:", err.message);
    return false;
  }
}

/**
 * Clear old reports and history from Supabase, leaving only the latest one.
 */
export async function clearSupabaseAndSeedLatest(
  latestReport: CivicReport,
  historyEntry: StatusHistoryEntry,
): Promise<{ success: boolean; message: string }> {
  if (!supabase) {
    return {
      success: true,
      message: "Supabase not configured in this environment; local storage cleaned.",
    };
  }

  try {
    await supabase.from("report_status_history").delete().neq("id", "");
    await supabase.from("reports").delete().neq("id", "");
    await saveReportToSupabase(latestReport);
    await saveStatusHistoryToSupabase(historyEntry);

    return {
      success: true,
      message: "Supabase completely cleared of all previous complaints; latest report saved.",
    };
  } catch (err: any) {
    console.warn("[Supabase Clear Error]:", err.message);
    return {
      success: false,
      message: `Supabase clear error: ${err.message}`,
    };
  }
}

/**
 * Delete a specific report and its status history from Supabase PostgreSQL
 */
export async function deleteReportFromSupabase(reportId: string): Promise<boolean> {
  if (!supabase) {
    console.info(
      `[Supabase Delete]: Not configured in this environment, skipped remote delete for ${reportId}.`,
    );
    return true;
  }

  try {
    const cleanId = reportId.trim();
    await supabase.from("report_status_history").delete().eq("report_id", cleanId);
    await supabase.from("reports").update({ duplicate_of_id: null }).eq("duplicate_of_id", cleanId);
    const { error } = await supabase
      .from("reports")
      .delete()
      .or(`id.eq.${cleanId},tracking_id.eq.${cleanId}`);

    if (!error) {
      console.info(`[Supabase Delete]: Successfully deleted report ${reportId} from Supabase.`);
      return true;
    }
    console.warn(`[Supabase Delete Warning]: ${error.message}`);
    return false;
  } catch (err: any) {
    console.warn(`[Supabase Delete Error for ${reportId}]:`, err.message);
    return false;
  }
}

/**
 * Save user to Supabase app_users table
 */
export async function saveUserToSupabase(user: {
  id: string;
  username: string;
  passwordHash: string;
  role: string;
  displayName?: string;
  createdAt?: string;
  updatedAt?: string;
}): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("app_users").upsert({
      id: user.id,
      username: user.username,
      password_hash: user.passwordHash,
      role: user.role,
      display_name: user.displayName || user.username,
      created_at: user.createdAt || new Date().toISOString(),
      updated_at: user.updatedAt || new Date().toISOString(),
    });
    if (error) {
      console.warn("[Supabase Sync User Warning]:", error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn("[Supabase Sync User Warning]:", err.message);
    return false;
  }
}

/**
 * Fetch user by username from Supabase app_users table
 */
export async function fetchUserFromSupabase(username: string): Promise<any | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("app_users")
      .select("*")
      .eq("username", username)
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const u = data[0];
    return {
      id: u.id,
      username: u.username,
      passwordHash: u.password_hash,
      role: u.role,
      displayName: u.display_name || u.username,
      createdAt: u.created_at,
      updatedAt: u.updated_at,
    };
  } catch (err: any) {
    console.warn("[Supabase Fetch User Warning]:", err.message);
    return null;
  }
}

/**
 * Upload a media file (evidence or resolution proof) to the report-media
 * Storage bucket and return its object path and a public URL.
 */
export async function uploadMediaToSupabase(
  reportId: string,
  file: { buffer: Buffer; contentType: string; extension: string },
  kind: "evidence" | "resolution",
): Promise<{ path: string; url: string } | null> {
  if (!supabase) return null;
  try {
    const objectPath =
      kind === "resolution"
        ? `reports/${reportId}/resolution/${crypto.randomUUID()}.${file.extension}`
        : `reports/${reportId}/${crypto.randomUUID()}.${file.extension}`;

    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(objectPath, file.buffer, {
      contentType: file.contentType,
      upsert: false,
    });
    if (error) {
      console.warn("[Supabase Upload Warning]:", error.message);
      return null;
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath);
    return { path: objectPath, url: data.publicUrl };
  } catch (err: any) {
    console.warn("[Supabase Upload Error]:", err.message);
    return null;
  }
}

/**
 * Fetch a single report by id from Supabase. This is the read-through path
 * that makes Supabase the actual shared source of truth across serverless
 * containers — local/in-memory state alone can't reflect a change made by
 * a different container (e.g. admin on one, citizen polling on another).
 */
export async function fetchReportFromSupabase(id: string): Promise<CivicReport | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .or(`id.eq.${id},tracking_id.eq.${id}`)
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return rowToCivicReport(data[0]);
  } catch (err: any) {
    console.warn("[Supabase Fetch Report Warning]:", err.message);
    return null;
  }
}

/** Fetch all non-deleted reports from Supabase. */
export async function fetchAllReportsFromSupabase(): Promise<CivicReport[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (error || !data) return null;
    return data.map(rowToCivicReport);
  } catch (err: any) {
    console.warn("[Supabase Fetch Reports Warning]:", err.message);
    return null;
  }
}

/** Fetch status history for a report from Supabase. */
export async function fetchStatusHistoryFromSupabase(
  reportId: string,
): Promise<StatusHistoryEntry[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("report_status_history")
      .select("*")
      .eq("report_id", reportId)
      .order("changed_at", { ascending: true });
    if (error || !data) return null;
    return data.map(rowToStatusHistoryEntry);
  } catch (err: any) {
    console.warn("[Supabase Fetch History Warning]:", err.message);
    return null;
  }
}
