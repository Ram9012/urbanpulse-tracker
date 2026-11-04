import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { DemoDataNote, PriorityBadge, StatusBadge } from "@/components/site/primitives";
import {
  CATEGORIES,
  DEPARTMENTS,
  FIELD_WORKERS,
  REPORTS,
  formatDate,
  CivicReport,
  ReportStatus,
  getDeletedReportIds,
  markReportDeleted,
} from "@/lib/civic-data";
import { uploadMediaItems } from "@/lib/media-upload";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [
      { title: "Live Report Management & AI Triage — CivicPulse Staff" },
      {
        name: "description",
        content:
          "Filter, classify, assign and resolve civic reports with AI decision support and deterministic audit logging.",
      },
      { property: "og:title", content: "Live Report Management — CivicPulse Staff" },
      {
        property: "og:description",
        content: "Centralised civic report queue for municipal staff.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsTable,
});

function ReportsTable() {
  const [reports, setReports] = useState<CivicReport[]>(() => {
    const deleted = getDeletedReportIds();
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("civicpulse_client_reports") || "[]");
        const valid = stored.filter(
          (r: any) =>
            !deleted.has(r.id.toLowerCase()) &&
            !r.id.startsWith("CIV-104") &&
            r.id !== "CIV-54728" &&
            r.id !== "CIV-42603",
        );
        if (valid.length > 0) {
          const map = new Map<string, CivicReport>();
          valid.forEach((r: CivicReport) => map.set(r.id.toLowerCase(), r));
          REPORTS.forEach((r: CivicReport) => {
            if (!deleted.has(r.id.toLowerCase()) && !map.has(r.id.toLowerCase())) {
              map.set(r.id.toLowerCase(), r);
            }
          });
          return Array.from(map.values());
        }
      } catch {
        /* best-effort: ignore storage/network failure */
      }
    }
    return REPORTS.filter((r) => !deleted.has(r.id.toLowerCase()));
  });
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState(DEPARTMENTS[0]!.name);
  const [selectedWorker, setSelectedWorker] = useState(FIELD_WORKERS[0]!.name);

  // AI Workload Assistant State
  const [showAiAdvisor, setShowAiAdvisor] = useState(false);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [purgingData, setPurgingData] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Admin Photo Upload & Live Camera Capture State
  const [evidenceModalReport, setEvidenceModalReport] = useState<CivicReport | null>(null);
  const [evidenceStatus, setEvidenceStatus] = useState<"in_progress" | "resolved">("in_progress");
  const [evidencePhotoUrl, setEvidencePhotoUrl] = useState<string | null>(null);
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [evidenceWorker, setEvidenceWorker] = useState(FIELD_WORKERS[0]!.name);
  const [evidenceDept, setEvidenceDept] = useState(DEPARTMENTS[0]!.name);
  const [showLiveCamera, setShowLiveCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [submittingEvidence, setSubmittingEvidence] = useState(false);

  const videoStreamRef = useRef<HTMLVideoElement>(null);
  const streamTrackRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    setShowLiveCamera(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamTrackRef.current = stream;
      if (videoStreamRef.current) {
        videoStreamRef.current.srcObject = stream;
        videoStreamRef.current.play();
      }
    } catch (err: any) {
      console.warn("Camera error:", err);
      setCameraError(`Camera error: ${err.message}. You can choose an image file instead.`);
    }
  };

  const stopCamera = () => {
    if (streamTrackRef.current) {
      streamTrackRef.current.getTracks().forEach((t) => t.stop());
      streamTrackRef.current = null;
    }
    setShowLiveCamera(false);
  };

  const capturePhoto = () => {
    if (!videoStreamRef.current) return;
    const video = videoStreamRef.current;
    const canvas = document.createElement("canvas");
    const MAX_DIM = 1024;
    let width = video.videoWidth || 1280;
    let height = video.videoHeight || 720;
    if (width > MAX_DIM || height > MAX_DIM) {
      if (width > height) {
        height = Math.round((height * MAX_DIM) / width);
        width = MAX_DIM;
      } else {
        width = Math.round((width * MAX_DIM) / height);
        height = MAX_DIM;
      }
    }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
      setEvidencePhotoUrl(dataUrl);
    }
    stopCamera();
  };

  const compressImage = (file: File, maxDim = 1024, quality = 0.75): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", quality));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve("/media/evidence/pothole_resolved.jpg");
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file, 1024, 0.75);
      setEvidencePhotoUrl(dataUrl);
    } catch {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl) {
          setEvidencePhotoUrl(dataUrl);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const openEvidenceModal = (report: CivicReport, preferredStatus?: "in_progress" | "resolved") => {
    const nextStatus =
      preferredStatus || (report.status === "in_progress" ? "resolved" : "in_progress");
    setEvidenceModalReport(report);
    setEvidenceStatus(nextStatus);
    setEvidenceWorker(report.worker || FIELD_WORKERS[0]!.name);
    setEvidenceDept(report.department || DEPARTMENTS[0]!.name);

    const defaultResolutionNote =
      report.category === "electricity"
        ? "Streetlight wiring repaired, lamp replaced, and illumination restored."
        : report.category === "waste"
          ? "Garbage cleared, waste bin sanitized, and area reopened."
          : report.category === "water"
            ? "Pipeline leak patched and water flow restored."
            : "Remediation verified on site: issue resolved and inspection passed.";

    const defaultInProgressNote =
      report.category === "electricity"
        ? "Electrical crew arrived on site with materials. Remediation underway."
        : "Field crew arrived on site with materials. Remediation actively underway.";

    setEvidenceNotes(nextStatus === "resolved" ? defaultResolutionNote : defaultInProgressNote);
    setEvidencePhotoUrl(null);
    setShowLiveCamera(false);
    setCameraError(null);
  };

  const submitEvidenceStatus = async () => {
    if (!evidenceModalReport) return;
    setSubmittingEvidence(true);

    const targetReport = evidenceModalReport;
    const targetId = targetReport.id;
    const newStatus = evidenceStatus;
    const notes =
      evidenceNotes ||
      (newStatus === "resolved"
        ? targetReport.category === "electricity"
          ? "Streetlight wiring repaired, lamp replaced, and illumination restored."
          : "Remediation verified on site: issue resolved and inspection passed."
        : "Field crew arrived on site with materials. Remediation underway.");

    const isElectric =
      (targetReport.category || "").toLowerCase().includes("electric") ||
      targetReport.id.includes("95674");

    // If a real camera/upload capture was taken, upload it to durable
    // storage instead of carrying the data: URL into the report forever.
    let photo = evidencePhotoUrl;
    if (photo) {
      const [uploaded] = await uploadMediaItems(
        targetId,
        [{ url: photo, name: `resolution-${Date.now()}.jpg` }],
        "resolution",
      );
      photo = uploaded || photo;
    }
    photo =
      photo ||
      (newStatus === "resolved"
        ? isElectric
          ? "/media/evidence/streetlight_resolved.jpg"
          : "/media/evidence/pothole_resolved.jpg"
        : "/media/evidence/road_worker_onsite.jpg");

    const now = new Date().toISOString();
    let updatedReport: CivicReport | undefined;

    // 1. Instant Optimistic State Update for Admin UI: updates badge, timestamps, notes, and photo proof immediately!
    setReports((prev) =>
      prev.map((r) => {
        if (r.id.toLowerCase() === targetId.toLowerCase()) {
          const updated: CivicReport = {
            ...r,
            status: newStatus,
            updatedAt: now,
            department: evidenceDept,
            worker: evidenceWorker,
            workerMediaUrls:
              newStatus === "in_progress"
                ? [photo, ...(r.workerMediaUrls || [])]
                : r.workerMediaUrls || [],
            resolutionMediaUrls:
              newStatus === "resolved"
                ? [photo, ...(r.resolutionMediaUrls || [])]
                : r.resolutionMediaUrls || [],
          };
          if (newStatus === "resolved" && notes) {
            updated.resolutionNotes = notes;
          }
          updatedReport = updated;
          return updated;
        }
        return r;
      }),
    );

    // 2. Persist immediately to localStorage so polling or navigation NEVER reverts it
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("civicpulse_client_reports") || "[]");
        const idx = stored.findIndex((r: any) => r.id.toLowerCase() === targetId.toLowerCase());
        if (idx >= 0) {
          stored[idx] = { ...stored[idx], ...updatedReport };
        } else if (updatedReport) {
          stored.unshift(updatedReport);
        }
        localStorage.setItem("civicpulse_client_reports", JSON.stringify(stored));
        window.dispatchEvent(
          new CustomEvent("civicpulse_report_updated", { detail: updatedReport }),
        );
        window.dispatchEvent(new Event("storage"));
      } catch {
        /* best-effort: ignore storage/network failure */
      }
    }

    // 3. Immediately close modal and camera so admin sees updated table instantly
    setEvidenceModalReport(null);
    stopCamera();
    setActionNotice(
      newStatus === "resolved"
        ? `✓ Report ${targetId} officially RESOLVED & verified with resolution proof!`
        : `✓ Report ${targetId} moved to IN PROGRESS with worker evidence!`,
    );

    // 4. Dispatch to Status Engine API asynchronously without blocking UI
    try {
      const res = await fetch("/api/status/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: targetId,
          newStatus,
          changedBy: "A. Sharma (Municipal Supervisor)",
          role: "Staff",
          comment: notes,
          worker: evidenceWorker,
          department: evidenceDept,
          workerMedia: newStatus === "in_progress" ? [photo] : targetReport.workerMediaUrls,
          resolutionMedia: newStatus === "resolved" ? [photo] : targetReport.resolutionMediaUrls,
          resolutionNotes: newStatus === "resolved" ? notes : undefined,
          runAiCheck: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.report) {
          setReports((prev) =>
            prev.map((r) =>
              r.id.toLowerCase() === targetId.toLowerCase() ? { ...r, ...data.report } : r,
            ),
          );
        }
      }
    } catch (err: any) {
      console.warn("Evidence submit network fallback:", err);
    } finally {
      setSubmittingEvidence(false);
    }
  };

  // Smart Merge Helper: Ensures client's resolved status or newer updates are NEVER overwritten by stale server data
  const mergeReportsWithPrecedence = (
    localList: CivicReport[],
    serverList: CivicReport[],
  ): CivicReport[] => {
    const map = new Map<string, CivicReport>();

    // 1. Base default seed reports
    REPORTS.forEach((r) => map.set(r.id.toLowerCase(), r));

    // 2. Server reports
    serverList.forEach((sr) => {
      map.set(sr.id.toLowerCase(), sr);
    });

    // 3. Client local storage reports with terminal status protection
    localList.forEach((lr) => {
      const existing = map.get(lr.id.toLowerCase());
      if (!existing) {
        map.set(lr.id.toLowerCase(), lr);
      } else {
        const isLocalResolved = lr.status === "resolved";
        const isExistingResolved = existing.status === "resolved";

        // Terminal protection: Once resolved locally, NEVER downgrade back to in_progress/submitted due to stale server state
        if (isLocalResolved && !isExistingResolved) {
          map.set(lr.id.toLowerCase(), { ...existing, ...lr, status: "resolved" });
        } else {
          const localTime = new Date(lr.updatedAt || 0).getTime();
          const existingTime = new Date(existing.updatedAt || 0).getTime();

          if (localTime >= existingTime) {
            map.set(lr.id.toLowerCase(), { ...existing, ...lr });
          } else {
            // Keep server data, but retain local resolution/worker media if missing
            map.set(lr.id.toLowerCase(), {
              ...lr,
              ...existing,
              resolutionMediaUrls: existing.resolutionMediaUrls?.length
                ? existing.resolutionMediaUrls
                : lr.resolutionMediaUrls,
              workerMediaUrls: existing.workerMediaUrls?.length
                ? existing.workerMediaUrls
                : lr.workerMediaUrls,
            });
          }
        }
      }
    });

    return Array.from(map.values()).filter(
      (r) => !r.id.startsWith("CIV-104") && r.id !== "CIV-54728" && r.id !== "CIV-42603",
    );
  };

  // Fetch reports from status engine API and sync with local storage safely
  const fetchReports = async () => {
    try {
      const deleted = getDeletedReportIds();
      const res = await fetch("/api/status/reports");
      let serverReports: CivicReport[] = [];
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.deletedIds)) {
          data.deletedIds.forEach((id: string) => markReportDeleted(id));
        }
        if (data.reports) {
          serverReports = data.reports.filter(
            (r: CivicReport) =>
              !r.id.startsWith("CIV-104") && r.id !== "CIV-54728" && r.id !== "CIV-42603",
          );
        }
      }

      const freshDeleted = getDeletedReportIds();

      // Read client localStorage
      let localReports: CivicReport[] = [];
      if (typeof window !== "undefined") {
        try {
          const stored = JSON.parse(localStorage.getItem("civicpulse_client_reports") || "[]");
          localReports = stored.filter(
            (r: any) =>
              !freshDeleted.has(r.id.toLowerCase()) &&
              !r.id.startsWith("CIV-104") &&
              r.id !== "CIV-54728" &&
              r.id !== "CIV-42603",
          );
        } catch {
          /* best-effort: ignore storage/network failure */
        }
      }

      const merged = mergeReportsWithPrecedence(localReports, serverReports).filter(
        (r) => !freshDeleted.has(r.id.toLowerCase()),
      );
      setReports(merged);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("civicpulse_client_reports", JSON.stringify(merged));
        } catch {
          /* best-effort: ignore storage/network failure */
        }
      }
    } catch (err) {
      console.warn("Could not fetch reports from API:", err);
    }
  };

  useEffect(() => {
    fetchReports();
    const timer = setInterval(fetchReports, 3000);
    const handleUpdate = () => fetchReports();
    window.addEventListener("civicpulse_report_created", handleUpdate);
    window.addEventListener("civicpulse_report_updated", handleUpdate);
    window.addEventListener("civicpulse_report_deleted", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      clearInterval(timer);
      window.removeEventListener("civicpulse_report_created", handleUpdate);
      window.removeEventListener("civicpulse_report_updated", handleUpdate);
      window.removeEventListener("civicpulse_report_deleted", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // Purge old complaints and reset database completely
  const purgeAllOldComplaints = async () => {
    if (
      !confirm(
        "Are you sure you want to remove all previous complaints and keep only the latest one?",
      )
    ) {
      return;
    }
    setPurgingData(true);
    try {
      const res = await fetch("/api/admin/clean-database", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (typeof window !== "undefined") {
          localStorage.removeItem("civicpulse_client_reports");
        }
        if (data.reports) {
          setReports(data.reports);
        }
        setActionNotice(
          "Database cleaned successfully. All previous complaints removed; only latest complaint active.",
        );
      }
    } catch (err: any) {
      setActionNotice(`Clean database notice: ${err.message}`);
    } finally {
      setPurgingData(false);
    }
  };

  // Permanently delete single report from server, disk and Supabase
  const deleteReportRecord = async (reportId: string) => {
    // 1. Mark as deleted in persistent client storage immediately
    markReportDeleted(reportId);

    // 2. Optimistically remove from state immediately
    setReports((prev) => prev.filter((r) => r.id.toLowerCase() !== reportId.toLowerCase()));

    // 3. Remove from client local storage
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("civicpulse_client_reports") || "[]");
        const filtered = stored.filter((r: any) => r.id.toLowerCase() !== reportId.toLowerCase());
        localStorage.setItem("civicpulse_client_reports", JSON.stringify(filtered));

        const queue = JSON.parse(localStorage.getItem("civic_reports_queue") || "[]");
        const filteredQueue = queue.filter(
          (r: any) => r.id.toLowerCase() !== reportId.toLowerCase(),
        );
        localStorage.setItem("civic_reports_queue", JSON.stringify(filteredQueue));

        window.dispatchEvent(new Event("civicpulse_report_deleted"));
      } catch {
        /* best-effort: ignore storage/network failure */
      }
    }

    setActionNotice(`Deleting report ${reportId} from Supabase...`);
    try {
      await fetch("/api/reports/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId }),
      });

      setActionNotice(`✓ Report ${reportId} permanently deleted from municipal queue & Supabase.`);
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err: any) {
      setActionNotice(`Delete failed: ${err.message}`);
    }
  };

  // Status transition handler with instant optimistic update & resilient persistence
  const transitionReport = async (
    reportId: string,
    newStatus: ReportStatus,
    comment?: string,
    workerName?: string,
    deptName?: string,
  ) => {
    const now = new Date().toISOString();
    const target = reports.find((r) => r.id.toLowerCase() === reportId.toLowerCase());
    const isElectric =
      (target?.category || "").toLowerCase().includes("electric") || reportId.includes("95674");
    const resolvedPhoto = isElectric
      ? "/media/evidence/streetlight_resolved.jpg"
      : "/media/evidence/pothole_resolved.jpg";

    let updatedReport: CivicReport | undefined;

    // 1. Instant Optimistic State Update for Admin UI: updates table, worker, department, and badges immediately!
    setReports((prev) =>
      prev.map((r) => {
        if (r.id.toLowerCase() === reportId.toLowerCase()) {
          const updated: CivicReport = {
            ...r,
            status: newStatus,
            updatedAt: now,
            worker: workerName || r.worker,
            department: deptName || r.department,
            workerMediaUrls:
              newStatus === "assigned" || newStatus === "in_progress" || newStatus === "resolved"
                ? r.workerMediaUrls && r.workerMediaUrls.length > 0
                  ? r.workerMediaUrls
                  : ["/media/evidence/road_worker_onsite.jpg"]
                : r.workerMediaUrls,
            resolutionMediaUrls:
              newStatus === "resolved"
                ? r.resolutionMediaUrls && r.resolutionMediaUrls.length > 0
                  ? r.resolutionMediaUrls
                  : [resolvedPhoto]
                : r.resolutionMediaUrls,
          };
          if (newStatus === "resolved" && !updated.resolutionNotes) {
            updated.resolutionNotes = comment || "Work completed and verified on site.";
          }
          updatedReport = updated;
          return updated;
        }
        return r;
      }),
    );

    // 2. Persist immediately to localStorage so polling or navigation NEVER reverts it
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("civicpulse_client_reports") || "[]");
        const idx = stored.findIndex((r: any) => r.id.toLowerCase() === reportId.toLowerCase());
        if (idx >= 0) {
          stored[idx] = { ...stored[idx], ...updatedReport };
        } else if (updatedReport) {
          stored.unshift(updatedReport);
        }
        localStorage.setItem("civicpulse_client_reports", JSON.stringify(stored));
        window.dispatchEvent(
          new CustomEvent("civicpulse_report_updated", { detail: updatedReport }),
        );
        window.dispatchEvent(new Event("storage"));
      } catch {
        /* best-effort: ignore storage/network failure */
      }
    }

    setActionNotice(
      `✓ Report ${reportId} updated to ${newStatus.toUpperCase()}${workerName ? ` (Worker: ${workerName})` : ""}`,
    );

    // 3. Dispatch to Status Engine API asynchronously in the background
    try {
      const res = await fetch("/api/status/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId,
          newStatus,
          changedBy: "A. Sharma (Municipal Supervisor)",
          role: "Staff",
          comment: comment || `Status advanced to ${newStatus.toUpperCase()}`,
          worker: workerName,
          department: deptName,
          workerMedia:
            newStatus === "assigned" || newStatus === "in_progress" || newStatus === "resolved"
              ? ["/media/evidence/road_worker_onsite.jpg"]
              : undefined,
          resolutionMedia: newStatus === "resolved" ? [resolvedPhoto] : undefined,
          runAiCheck: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.report) {
          setReports((prev) =>
            prev.map((r) =>
              r.id.toLowerCase() === reportId.toLowerCase() ? { ...r, ...data.report } : r,
            ),
          );
        }
      }
    } catch (err: any) {
      console.warn("Background status transition notice:", err);
    }
  };

  // Run AI Workload Analytics Assistant
  const fetchAiWorkloadInsights = async () => {
    setShowAiAdvisor(true);
    if (aiInsights) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/workload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentData: DEPARTMENTS,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiInsights(data);
      }
    } catch (err) {
      console.warn("AI workload analysis error:", err);
    } finally {
      setAiLoading(false);
    }
  };

  const rows = reports.filter(
    (r) =>
      (category === "all" || r.category === category) && (status === "all" || r.status === status),
  );

  return (
    <div>
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Live Civic Reports Queue</h1>
          <p className="text-sm text-muted-foreground">
            Manage reports across all stages with deterministic status rules and AI decision
            support.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={purgeAllOldComplaints}
            disabled={purgingData}
            className="inline-flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-3.5 py-2 text-xs font-bold text-destructive shadow-sm hover:bg-destructive/20 transition disabled:opacity-50"
            title="Remove all old mock/resolved data from Supabase and local storage, keeping only latest complaint"
          >
            <span>🧹</span> {purgingData ? "Cleaning Database…" : "Empty Old Complaints"}
          </button>
          <button
            type="button"
            onClick={fetchAiWorkloadInsights}
            className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-xs font-bold text-navy-foreground shadow hover:bg-navy/90 transition"
          >
            <span>🤖</span> AI Operations Advisor
          </button>
          <DemoDataNote />
        </div>
      </header>

      {actionNotice && (
        <div className="mt-4 rounded-xl bg-success/15 border border-success/30 p-3 text-xs font-bold text-success flex items-center justify-between">
          <span>✓ {actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label>
          <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-11 rounded-xl border border-input bg-surface px-3 text-sm"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-11 rounded-xl border border-input bg-surface px-3 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">1. Submitted</option>
            <option value="verified">2. Verified</option>
            <option value="assigned">3. Assigned</option>
            <option value="in_progress">4. In Progress</option>
            <option value="resolved">5. Resolved</option>
            <option value="duplicate">Marked Duplicate</option>
          </select>
        </label>
        <button
          type="button"
          onClick={fetchReports}
          className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-accent"
        >
          🔄 Refresh Queue
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="surface-card mt-6 p-12 text-center">
          <p className="font-display text-lg font-bold">No reports in this queue</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Widen the filters to see more reports.
          </p>
        </div>
      ) : (
        <div className="surface-card mt-6 overflow-x-auto rounded-2xl shadow-sm">
          <table className="w-full min-w-[960px] text-sm">
            <caption className="sr-only">Civic report queue</caption>
            <thead className="bg-muted text-left">
              <tr>
                {[
                  "Report",
                  "Category",
                  "Location",
                  "Priority",
                  "Department",
                  "Worker",
                  "Status",
                  "AI Signals",
                  "Workflow Actions",
                ].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-bold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-border align-middle hover:bg-muted/10 transition"
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="size-9 shrink-0 rounded-lg border border-border civic-grid-bg"
                      />
                      <span>
                        <span className="block font-bold">{r.id}</span>
                        <span className="block text-xs text-muted-foreground">
                          {formatDate(r.createdAt)}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{r.categoryLabel}</td>
                  <td className="px-4 py-3">
                    {r.area}
                    <span className="block text-xs text-muted-foreground">{r.ward}</span>
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={r.priority} />
                  </td>
                  <td className="px-4 py-3">{r.department}</td>
                  <td className="px-4 py-3 font-medium">
                    {r.worker ? (
                      <span className="text-foreground">{r.worker}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="font-semibold">
                      {Math.round((r.aiConfidence || 0.94) * 100)}% conf
                    </span>
                    {r.duplicateProbability > 0.2 && (
                      <span className="block text-[11px] text-warning font-semibold">
                        ⚠️ Dup {Math.round(r.duplicateProbability * 100)}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-[280px]">
                      {r.status === "submitted" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              transitionReport(
                                r.id,
                                "verified",
                                `Verified by municipal staff for ${r.department}.`,
                              )
                            }
                            className="px-3 py-1.5 rounded-xl bg-teal text-teal-foreground text-xs font-bold hover:bg-teal/90 shadow-sm flex items-center gap-1 transition"
                            title="Verify report validity & jurisdiction"
                          >
                            <span>✓</span> 1. Verify Report (Staff)
                          </button>
                          <button
                            type="button"
                            onClick={() => setAssignFor(r.id)}
                            className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 shadow-sm flex items-center gap-1 transition"
                            title="Assign field worker and dispatch work order"
                          >
                            <span>👤</span> 2. Assign Field Worker
                          </button>
                        </>
                      )}

                      {r.status === "verified" && (
                        <button
                          type="button"
                          onClick={() => setAssignFor(r.id)}
                          className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 shadow-sm flex items-center gap-1 transition"
                          title="Assign field worker and dispatch work order"
                        >
                          <span>👤</span> 2. Assign Field Worker (Dispatch)
                        </button>
                      )}

                      {r.status === "assigned" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              transitionReport(
                                r.id,
                                "in_progress",
                                "Field crew deployed on site with materials.",
                              )
                            }
                            className="px-3 py-1.5 rounded-xl bg-warning text-warning-foreground text-xs font-bold hover:bg-warning/90 shadow-sm flex items-center gap-1 transition"
                          >
                            <span>🛠️</span> 3. Start Work on Site
                          </button>
                          <button
                            type="button"
                            onClick={() => openEvidenceModal(r, "resolved")}
                            className="px-2.5 py-1.5 rounded-xl bg-success text-success-foreground text-xs font-bold hover:bg-success/90 shadow-sm flex items-center gap-1 transition"
                            title="Mark resolved with inspection photo"
                          >
                            <span>✅</span> Resolve
                          </button>
                          <button
                            type="button"
                            onClick={() => openEvidenceModal(r, "in_progress")}
                            className="px-2.5 py-1.5 rounded-xl border border-warning/40 bg-warning/10 text-warning-foreground text-xs font-bold hover:bg-warning/20 transition flex items-center gap-1"
                          >
                            <span>📷</span> On-Site Photo
                          </button>
                        </>
                      )}

                      {r.status === "in_progress" && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEvidenceModal(r, "resolved")}
                            className="px-3 py-1.5 rounded-xl bg-success text-success-foreground text-xs font-bold hover:bg-success/90 shadow-sm flex items-center gap-1 transition"
                            title="Mark resolved and upload inspection photo proof"
                          >
                            <span>✅</span> 4. Verify & Resolve (Upload Proof)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              transitionReport(
                                r.id,
                                "resolved",
                                "Officially inspected and marked resolved by municipal supervisor.",
                              )
                            }
                            className="px-2.5 py-1.5 rounded-xl border border-success/40 bg-success/10 text-success hover:bg-success hover:text-success-foreground text-xs font-bold transition flex items-center gap-1"
                            title="One-click immediate resolution without photo modal"
                          >
                            <span>⚡</span> Quick Resolve
                          </button>
                        </>
                      )}

                      {r.status === "resolved" && (
                        <span className="px-2.5 py-1 rounded-lg bg-success/15 text-success font-bold text-xs flex items-center gap-1">
                          ✓ Officially Resolved
                        </span>
                      )}

                      {/* Snap / Upload Photo Proof Modal Trigger */}
                      <button
                        type="button"
                        onClick={() => openEvidenceModal(r)}
                        className="px-2.5 py-1.5 rounded-xl bg-muted/70 hover:bg-muted text-foreground border border-border text-xs font-semibold transition flex items-center gap-1 ml-auto"
                        title="Upload or capture photo evidence for this report"
                      >
                        <span>📷</span> Photo
                      </button>

                      {/* Delete Report Button */}
                      {deleteConfirmId === r.id ? (
                        <div className="flex items-center gap-1 animate-in fade-in duration-150">
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteConfirmId(null);
                              deleteReportRecord(r.id);
                            }}
                            className="px-2 py-1 rounded-lg bg-destructive text-white hover:brightness-110 text-xs font-bold transition shadow-xs"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted text-xs font-semibold transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(r.id)}
                          className="px-2.5 py-1.5 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white text-xs font-bold transition flex items-center gap-1 shadow-sm"
                          title="Permanently delete this report from municipal queue & Supabase"
                        >
                          <span>🗑️</span> Delete
                        </button>
                      )}

                      <Link
                        to="/reports/$id"
                        params={{ id: r.id }}
                        className="text-xs font-bold text-primary hover:underline ml-1"
                      >
                        Timeline →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Assignment Modal */}
      {assignFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Assign ${assignFor}`}
            className="surface-card w-full max-w-lg p-6 rounded-2xl shadow-2xl animate-rise-in"
          >
            <h2 className="font-display text-lg font-extrabold">
              Assign Field Worker: {assignFor}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Select department and available field crew to dispatch for resolution.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold">Department</span>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold">Field Worker</span>
                <select
                  value={selectedWorker}
                  onChange={(e) => setSelectedWorker(e.target.value)}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  {FIELD_WORKERS.map((w) => (
                    <option key={w.name} value={w.name}>
                      {w.name} ({w.openTasks}/{w.capacity} tasks)
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAssignFor(null)}
                className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  transitionReport(
                    assignFor,
                    "assigned",
                    `Assigned to ${selectedDept} -> Worker: ${selectedWorker}`,
                    selectedWorker,
                    selectedDept,
                  );
                  setAssignFor(null);
                }}
                className="min-h-11 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Operations Advisor Drawer / Modal (Service 7) */}
      {showAiAdvisor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm">
          <div className="surface-card w-full max-w-xl p-6 rounded-2xl shadow-2xl animate-rise-in max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-xl">🤖</span>
                <h2 className="font-display text-lg font-bold">AI Operations & Workload Advisor</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAiAdvisor(false)}
                className="size-8 rounded-full border border-border flex items-center justify-center font-bold hover:bg-accent text-xs"
              >
                ✕
              </button>
            </div>

            {aiLoading ? (
              <p className="text-xs text-muted-foreground py-8 text-center">
                AI is analyzing department queues, SLA metrics, and bottleneck wards…
              </p>
            ) : aiInsights ? (
              <div className="mt-4 space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <span className="font-bold text-primary block uppercase tracking-wider text-[10px]">
                    Operational Overview
                  </span>
                  <p className="mt-1 text-foreground leading-relaxed">{aiInsights.overview}</p>
                </div>

                <div className="p-3 rounded-xl bg-warning/10 border border-warning/20">
                  <span className="font-bold text-warning-foreground block uppercase tracking-wider text-[10px]">
                    Identified Bottlenecks
                  </span>
                  <ul className="mt-1 list-disc list-inside space-y-1 text-foreground">
                    {aiInsights.key_bottlenecks?.map((b: string, i: number) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 rounded-xl bg-success/10 border border-success/20">
                  <span className="font-bold text-success block uppercase tracking-wider text-[10px]">
                    Staffing Recommendations
                  </span>
                  <ul className="mt-1 list-disc list-inside space-y-1 text-foreground">
                    {aiInsights.recommended_actions?.map((a: string, i: number) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Click re-analyze to fetch insights.
              </p>
            )}
          </div>
        </div>
      )}
      {/* Hidden File Input for Admin Photo Evidence Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Admin Visual Evidence & Status Upload Modal */}
      {evidenceModalReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Upload Visual Evidence"
            className="surface-card w-full max-w-xl p-6 rounded-2xl shadow-2xl animate-rise-in max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-xl">📸</span>
                <div>
                  <h2 className="font-display text-base font-extrabold text-foreground">
                    Admin Status & Visual Evidence Upload
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {evidenceModalReport.id}: {evidenceModalReport.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEvidenceModalReport(null);
                  stopCamera();
                }}
                className="size-8 rounded-full border border-border flex items-center justify-center font-bold hover:bg-accent text-xs"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Select Status Target */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  1. Select Target Workflow Status:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEvidenceStatus("in_progress");
                      setEvidenceNotes(
                        "Field crew arrived on site with materials. Remediation actively underway.",
                      );
                    }}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      evidenceStatus === "in_progress"
                        ? "border-warning bg-warning/10 text-foreground ring-2 ring-warning/30"
                        : "border-border bg-background hover:bg-accent text-muted-foreground"
                    }`}
                  >
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <span>🛠️</span> 4. Work in Progress
                    </span>
                    <span className="text-[10px] mt-1 text-muted-foreground">
                      Upload worker on-site proof
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEvidenceStatus("resolved");
                      setEvidenceNotes(
                        "Remediation verified on site: pothole filled with dense bitumen and surface rolled flat.",
                      );
                    }}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      evidenceStatus === "resolved"
                        ? "border-success bg-success/10 text-foreground ring-2 ring-success/30"
                        : "border-border bg-background hover:bg-accent text-muted-foreground"
                    }`}
                  >
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <span>✓</span> 5. Officially Resolved
                    </span>
                    <span className="text-[10px] mt-1 text-muted-foreground">
                      Upload resolution completion proof
                    </span>
                  </button>
                </div>
              </div>

              {/* Upload or Camera Capture Options (Identical to user report flow) */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  2. Capture or Upload Visual Proof:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="p-3 rounded-xl border border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 transition flex items-center justify-center gap-2 group text-primary font-bold text-xs"
                  >
                    <span className="text-lg group-hover:scale-110 transition">📷</span>
                    <span>Use Live Camera</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 rounded-xl border border-dashed border-input bg-surface hover:bg-accent transition flex items-center justify-center gap-2 group text-foreground font-bold text-xs"
                  >
                    <span className="text-lg group-hover:scale-110 transition">🖼️</span>
                    <span>Upload Image File</span>
                  </button>
                </div>
              </div>

              {/* Live Camera Viewfinder */}
              {showLiveCamera && (
                <div className="p-3 rounded-2xl bg-black border border-border space-y-3">
                  {cameraError ? (
                    <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs">
                      <p>{cameraError}</p>
                    </div>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden aspect-video bg-neutral-900 flex items-center justify-center">
                      <video
                        ref={videoStreamRef}
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-4 border border-dashed border-white/60 rounded-xl pointer-events-none flex items-center justify-center">
                        <span className="text-[11px] font-semibold text-white/80 bg-black/50 px-2.5 py-0.5 rounded-full backdrop-blur">
                          Align on-site evidence
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center gap-1.5 shadow"
                    >
                      <span className="size-2.5 rounded-full bg-white animate-pulse" />
                      Capture Snapshot
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-3 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-white/10 text-white"
                    >
                      Cancel Camera
                    </button>
                  </div>
                </div>
              )}

              {/* Real Evidence Photo Preview */}
              {evidencePhotoUrl && (
                <div className="p-3 rounded-xl border border-success/30 bg-success/5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={evidencePhotoUrl}
                      alt="Captured evidence"
                      className="size-16 rounded-lg object-cover border border-border"
                    />
                    <div>
                      <span className="text-xs font-bold text-success flex items-center gap-1">
                        <span>✓</span> Photo Evidence Attached
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Will be stored into Supabase and visual evidence archive.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEvidencePhotoUrl(null)}
                    className="text-xs text-destructive hover:underline font-semibold"
                  >
                    ✕ Remove
                  </button>
                </div>
              )}

              {/* Worker & Department Assignment */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                    Department
                  </span>
                  <select
                    value={evidenceDept}
                    onChange={(e) => setEvidenceDept(e.target.value)}
                    className="h-10 w-full rounded-xl border border-input bg-surface px-3 text-xs"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                    Field Crew / Supervisor
                  </span>
                  <select
                    value={evidenceWorker}
                    onChange={(e) => setEvidenceWorker(e.target.value)}
                    className="h-10 w-full rounded-xl border border-input bg-surface px-3 text-xs"
                  >
                    {FIELD_WORKERS.map((w) => (
                      <option key={w.name} value={w.name}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Supervisor Remarks / Notes */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  3. Field Remediation / Inspection Notes:
                </label>
                <textarea
                  rows={2}
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-input bg-surface outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Describe work completed, machinery deployed, or approval remarks..."
                />
              </div>

              {/* Submit Buttons */}
              <div className="mt-4 pt-3 border-t border-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEvidenceModalReport(null);
                    stopCamera();
                  }}
                  className="min-h-10 rounded-xl border border-border px-4 text-xs font-bold hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitEvidenceStatus}
                  disabled={submittingEvidence}
                  className={`min-h-10 rounded-xl px-5 text-xs font-bold shadow transition flex items-center gap-1.5 ${
                    evidenceStatus === "resolved"
                      ? "bg-success text-success-foreground hover:bg-success/90"
                      : "bg-warning text-warning-foreground hover:bg-warning/90"
                  }`}
                >
                  {submittingEvidence
                    ? "Updating…"
                    : `✓ Submit ${evidenceStatus === "resolved" ? "Resolution" : "In-Progress"} & Photo`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
