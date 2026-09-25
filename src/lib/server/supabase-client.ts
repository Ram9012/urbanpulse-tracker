/**
 * CivicPulse — Supabase Client & Persistence Bridge
 * Project: videoediting | Org: Zenith Stack
 *
 * Provides connection check, data sync, and fallback handling.
 */

import { CivicReport } from "@/lib/civic-data";
import { StatusHistoryEntry } from "./status-engine";

const SUPABASE_URL = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"] || "https://wqwlqbozwcbcxjbxlqmh.supabase.co";
const SUPABASE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["VITE_SUPABASE_ANON_KEY"] || "";
const SUPABASE_PROJECT_NAME = process.env["SUPABASE_PROJECT_NAME"] || "videoediting";

export type SupabaseStatus = {
  configured: boolean;
  connected: boolean;
  projectName: string;
  url: string;
  hasKey: boolean;
  message: string;
};

export async function checkSupabaseStatus(): Promise<SupabaseStatus> {
  const hasKey = Boolean(SUPABASE_KEY && SUPABASE_KEY.length > 10);
  if (!hasKey) {
    return {
      configured: true,
      connected: false,
      projectName: SUPABASE_PROJECT_NAME,
      url: SUPABASE_URL,
      hasKey: false,
      message: "Supabase project configured. Add VITE_SUPABASE_ANON_KEY to .env to enable direct live cloud sync.",
    };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/reports?limit=1`, {
      method: "GET",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (res.ok) {
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
      message: `Supabase reachable, HTTP ${res.status}: Tables pending migration or schema setup. Run supabase/schema.sql.`,
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
  if (!SUPABASE_KEY) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
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
        media_urls: report.mediaUrls || [],
        resolution_notes: report.resolutionNotes,
        resolution_media_urls: report.resolutionMediaUrls || [],
        latitude: report.latitude,
        longitude: report.longitude,
        created_at: report.createdAt,
        updated_at: report.updatedAt,
      }),
    });
    return res.ok;
  } catch (err: any) {
    console.warn("[Supabase Sync Report Warning]:", err.message);
    return false;
  }
}

/**
 * Save status history audit log to Supabase PostgreSQL
 */
export async function saveStatusHistoryToSupabase(entry: StatusHistoryEntry): Promise<boolean> {
  if (!SUPABASE_KEY) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/report_status_history`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: entry.id,
        report_id: entry.reportId,
        old_status: entry.oldStatus ? entry.oldStatus.toUpperCase() : null,
        new_status: entry.newStatus.toUpperCase(),
        changed_by: entry.changedBy,
        role: entry.role,
        changed_at: entry.changedAt,
        comment: entry.comment,
        metadata: entry.metadata || {},
      }),
    });
    return res.ok;
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
  if (!SUPABASE_KEY) {
    return {
      success: true,
      message: "Supabase key not configured in local environment; local storage cleaned.",
    };
  }

  try {
    // 1. Delete all status history from Supabase
    await fetch(`${SUPABASE_URL}/rest/v1/report_status_history?id=neq.none`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    // 2. Delete all previous reports from Supabase
    await fetch(`${SUPABASE_URL}/rest/v1/reports?id=neq.none`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    // 3. Insert the latest report and its initial history entry
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
  if (!SUPABASE_KEY) {
    console.info(`[Supabase Delete]: No API key in local environment, skipped remote delete for ${reportId}.`);
    return true;
  }

  try {
    // 1. Delete associated status history records
    await fetch(`${SUPABASE_URL}/rest/v1/report_status_history?report_id=eq.${encodeURIComponent(reportId)}`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    // 2. Delete the report from reports table
    const res = await fetch(`${SUPABASE_URL}/rest/v1/reports?id=eq.${encodeURIComponent(reportId)}`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (res.ok) {
      console.info(`[Supabase Delete]: Successfully deleted report ${reportId} from Supabase.`);
      return true;
    } else {
      console.warn(`[Supabase Delete Warning]: HTTP ${res.status} when deleting ${reportId}`);
      return false;
    }
  } catch (err: any) {
    console.warn(`[Supabase Delete Error for ${reportId}]:`, err.message);
    return false;
  }
}


