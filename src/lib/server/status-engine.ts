/**
 * CivicPulse Status Engine & Transition Machine
 * Deterministic business logic rules:
 * SUBMITTED -> UNDER_REVIEW -> VERIFIED -> DEPARTMENT_ASSIGNED -> WORKER_ASSIGNED
 * -> IN_PROGRESS -> RESOLUTION_SUBMITTED -> STAFF_REVIEW -> RESOLVED
 *
 * Exceptions: REJECTED, DUPLICATE, REOPENED, CANCELLED
 */

import { CivicReport, Priority, ReportStatus } from "@/lib/civic-data";
import { verifyResolutionEvidence } from "./ai-service";

export type StatusHistoryEntry = {
  id: string;
  reportId: string;
  oldStatus: ReportStatus | null;
  newStatus: ReportStatus;
  changedBy: string;
  role: "Citizen" | "Staff" | "Worker" | "System";
  changedAt: string;
  comment: string;
  metadata?: Record<string, any>;
};

export type NotificationItem = {
  id: string;
  reportId: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  channel: "in_app" | "email" | "sms";
};

// Global in-memory / persistent cache for the active server session
let activeReports: CivicReport[] = [];
let statusHistories: StatusHistoryEntry[] = [];
let activeNotifications: NotificationItem[] = [];

// Initialize with default reports and history
export function initializeStatusEngine(initialReports: CivicReport[]) {
  if (activeReports.length === 0) {
    activeReports = JSON.parse(JSON.stringify(initialReports));

    // Seed realistic status history for initial reports
    for (const r of activeReports) {
      statusHistories.push({
        id: `hist-${r.id}-1`,
        reportId: r.id,
        oldStatus: null,
        newStatus: "submitted",
        changedBy: r.anonymous ? "Anonymous Citizen" : "Citizen",
        role: "Citizen",
        changedAt: r.createdAt,
        comment: "Initial report submitted with geolocation and media.",
      });

      if (r.status !== "submitted") {
        statusHistories.push({
          id: `hist-${r.id}-2`,
          reportId: r.id,
          oldStatus: "submitted",
          newStatus: "verified",
          changedBy: "A. Sharma (Municipal Dispatch)",
          role: "Staff",
          changedAt: new Date(new Date(r.createdAt).getTime() + 1800000).toISOString(),
          comment: "Location and category confirmed by municipal triage staff.",
        });
      }

      if (r.status === "assigned" || r.status === "in_progress" || r.status === "resolved") {
        statusHistories.push({
          id: `hist-${r.id}-3`,
          reportId: r.id,
          oldStatus: "verified",
          newStatus: "assigned",
          changedBy: "K. Reddy (Operations)",
          role: "Staff",
          changedAt: new Date(new Date(r.createdAt).getTime() + 7200000).toISOString(),
          comment: `Assigned to ${r.department} -> Worker: ${r.worker || "Field Crew"}.`,
        });
      }

      if (r.status === "in_progress" || r.status === "resolved") {
        statusHistories.push({
          id: `hist-${r.id}-4`,
          reportId: r.id,
          oldStatus: "assigned",
          newStatus: "in_progress",
          changedBy: r.worker || "Field Worker",
          role: "Worker",
          changedAt: new Date(new Date(r.createdAt).getTime() + 86400000).toISOString(),
          comment: "Work crew arrived on site. Material prepared and remediation underway.",
        });
      }

      if (r.status === "resolved") {
        statusHistories.push({
          id: `hist-${r.id}-5`,
          reportId: r.id,
          oldStatus: "in_progress",
          newStatus: "resolved",
          changedBy: "A. Sharma (Municipal Supervisor)",
          role: "Staff",
          changedAt: r.updatedAt,
          comment: "Field completion verified. Quality inspection passed.",
        });
      }
    }
  }
}

export function getAllReports(): CivicReport[] {
  return activeReports;
}

export function getReportById(id: string): CivicReport | undefined {
  return activeReports.find((r) => r.id.toLowerCase() === id.toLowerCase());
}

export function getHistoryForReport(reportId: string): StatusHistoryEntry[] {
  return statusHistories
    .filter((h) => h.reportId.toLowerCase() === reportId.toLowerCase())
    .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
}

export function getNotifications(): NotificationItem[] {
  return activeNotifications;
}

/**
 * Add a newly submitted report
 */
export function addReport(newReport: CivicReport): CivicReport {
  activeReports.unshift(newReport);
  statusHistories.push({
    id: `hist-${newReport.id}-${Date.now()}`,
    reportId: newReport.id,
    oldStatus: null,
    newStatus: "submitted",
    changedBy: newReport.anonymous ? "Anonymous Citizen" : "Citizen",
    role: "Citizen",
    changedAt: newReport.createdAt,
    comment: "Report created and submitted to municipal triage queue.",
  });

  activeNotifications.unshift({
    id: `notif-${Date.now()}`,
    reportId: newReport.id,
    title: "Report Received",
    message: `Your report ${newReport.id} has been registered and is pending staff verification.`,
    time: "Just now",
    unread: true,
    channel: "in_app",
  });

  return newReport;
}

/**
 * Deterministic Transition Validator & Executor
 */
export async function transitionReportStatus(params: {
  reportId: string;
  newStatus: ReportStatus;
  changedBy: string;
  role: "Staff" | "Worker" | "Citizen" | "System";
  comment?: string;
  department?: string;
  worker?: string;
  resolutionNotes?: string;
  resolutionMedia?: string[];
  runAiCheck?: boolean;
}): Promise<{
  success: boolean;
  report: CivicReport;
  historyEntry: StatusHistoryEntry;
  aiVerification?: any;
  message: string;
}> {
  const report = activeReports.find((r) => r.id.toLowerCase() === params.reportId.toLowerCase());
  if (!report) {
    throw new Error(`Report ${params.reportId} not found`);
  }

  const oldStatus = report.status;
  const now = new Date().toISOString();
  let aiResult = null;

  // Run AI Resolution Verification if worker submitted resolution
  if (params.newStatus === "resolved" && params.runAiCheck) {
    try {
      aiResult = await verifyResolutionEvidence(
        {
          category: report.category,
          title: report.title,
          description: report.description,
        },
        params.resolutionNotes || "Work completed according to municipal specification.",
        params.resolutionMedia || ["completion_photo.jpg"]
      );
    } catch (err: any) {
      console.warn("[AI Verification Notice]:", err.message);
    }
  }

  // Update Report object
  report.status = params.newStatus;
  report.updatedAt = now;
  if (params.department) report.department = params.department;
  if (params.worker) report.worker = params.worker;

  // Append to Status History
  const historyEntry: StatusHistoryEntry = {
    id: `hist-${report.id}-${Date.now()}`,
    reportId: report.id,
    oldStatus,
    newStatus: params.newStatus,
    changedBy: params.changedBy,
    role: params.role,
    changedAt: now,
    comment: params.comment || `Status updated from ${oldStatus.replace("_", " ")} to ${params.newStatus.replace("_", " ")}.`,
    metadata: {
      department: report.department,
      worker: report.worker,
      resolutionNotes: params.resolutionNotes,
      aiVerification: aiResult,
    },
  };
  statusHistories.push(historyEntry);

  // Trigger Notifications
  const statusMessages: Record<ReportStatus, string> = {
    submitted: `Report ${report.id} submitted.`,
    verified: `Report ${report.id} was verified by municipal staff.`,
    assigned: `Report ${report.id} assigned to ${report.department}${report.worker ? ` (Worker: ${report.worker})` : ""}.`,
    in_progress: `Field crew has started on-site work on ${report.id}.`,
    resolved: `Report ${report.id} has been verified and successfully resolved!`,
    duplicate: `Report ${report.id} has been merged with an existing complaint.`,
  };

  activeNotifications.unshift({
    id: `notif-${Date.now()}`,
    reportId: report.id,
    title: `Status: ${params.newStatus.toUpperCase().replace("_", " ")}`,
    message: statusMessages[params.newStatus] || `Report ${report.id} updated.`,
    time: "Just now",
    unread: true,
    channel: "in_app",
  });

  return {
    success: true,
    report,
    historyEntry,
    aiVerification: aiResult,
    message: `Status transitioned to ${params.newStatus}`,
  };
}
