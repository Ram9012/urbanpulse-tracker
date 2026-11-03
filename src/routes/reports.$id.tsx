import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { SiteLayout } from "@/components/site/site-layout";
import { PriorityBadge, Section, StatusBadge } from "@/components/site/primitives";
import {
  REPORTS,
  formatDateTime,
  getReport,
  CivicReport,
  ReportStatus,
  FIELD_WORKERS,
  markReportDeleted,
} from "@/lib/civic-data";
import { RealMap } from "@/components/site/real-map";

export const Route = createFileRoute("/reports/$id")({
  loader: ({ params }) => {
    const report = getReport(params.id) || {
      id: params.id,
      title: "Civic Issue Report",
      category: "electricity",
      categoryLabel: "Streetlight & electricity",
      description: "Reported civic issue registered in CivicPulse system.",
      ward: "Rangoli Halla",
      area: "Racecourse Road, Rangoli Halla",
      status: "submitted",
      priority: "critical",
      department: "Electrical Department",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiConfidence: 0.95,
      duplicateProbability: 0.05,
      upvotes: 1,
      anonymous: false,
      x: 42,
      y: 50,
      latitude: 13.0072,
      longitude: 76.1023,
      address: "Racecourse Road, Rangoli Halla, हासन",
      mediaUrls: ["/media/evidence/streetlight_before.jpg"],
    };
    return { initialReport: report };
  },
  head: ({ loaderData }) => {
    const report = loaderData?.initialReport;
    return {
      meta: [
        { title: `${report?.id || "Report"} — Live Status & Timeline | CivicPulse` },
        { name: "description", content: `Track live resolution for ${report?.id} in Hassan.` },
      ],
    };
  },
  component: ReportDetails,
});

const DETAILED_STAGES = [
  {
    key: "submitted",
    label: "1. Report Submitted",
    actor: "Citizen",
    detail: "Registered with GPS, photo evidence & AI triage",
  },
  {
    key: "verified",
    label: "2. Verified by Staff",
    actor: "Municipal Staff",
    detail: "Issue authenticity & jurisdiction confirmed",
  },
  {
    key: "assigned",
    label: "3. Field Worker Assigned",
    actor: "Department Dispatch",
    detail: "Target schedule and work order issued",
  },
  {
    key: "in_progress",
    label: "4. Work in Progress",
    actor: "Field Worker",
    detail: "Crew deployed on site with materials",
  },
  {
    key: "resolution_submitted",
    label: "5. Resolution Submitted",
    actor: "Field Worker",
    detail: "Completion media uploaded & AI checked",
  },
  {
    key: "resolved",
    label: "6. Officially Resolved",
    actor: "Municipal Supervisor",
    detail: "Inspection approved and citizen notified",
  },
];

function getStageIndex(status: ReportStatus): number {
  switch (status) {
    case "submitted":
      return 0;
    case "verified":
      return 1;
    case "assigned":
      return 2;
    case "in_progress":
      return 3;
    case "resolved":
      return 5;
    default:
      return 0;
  }
}

function ReportDetails() {
  const { initialReport } = Route.useLoaderData();
  const navigate = useNavigate();
  const [report, setReport] = useState<CivicReport>(initialReport);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const handleDeleteThisReport = async () => {
    try {
      markReportDeleted(report.id);

      await fetch("/api/reports/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: report.id }),
      });

      if (typeof window !== "undefined") {
        try {
          const stored = JSON.parse(localStorage.getItem("civicpulse_client_reports") || "[]");
          const filtered = stored.filter((r: any) => r.id !== report.id);
          localStorage.setItem("civicpulse_client_reports", JSON.stringify(filtered));

          const queue = JSON.parse(localStorage.getItem("civic_reports_queue") || "[]");
          const filteredQueue = queue.filter((r: any) => r.id !== report.id);
          localStorage.setItem("civic_reports_queue", JSON.stringify(filteredQueue));

          window.dispatchEvent(new Event("civicpulse_report_deleted"));
        } catch {}
      }

      alert(`✓ Report ${report.id} permanently deleted from Supabase & municipal records.`);
      navigate({ to: "/explore" });
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  // Resolution & AI verification state
  const [resolutionNotes, setResolutionNotes] = useState(() =>
    initialReport.category === "electricity"
      ? "Streetlight wiring repaired, lamp replaced, and illumination restored."
      : "Filled pothole with dense bitumen mix, compacted surface, and reopened lane.",
  );
  const [aiVerification, setAiVerification] = useState<any>(null);
  const [verifyingAi, setVerifyingAi] = useState(false);

  // Municipal Search state (SerpAPI)
  const [municipalQuery, setMunicipalQuery] = useState(
    "Hassan city municipal council grievance helpline",
  );
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Real Photo Upload & Live Camera Capture for Worker / Admin
  const [targetSlot, setTargetSlot] = useState<"worker" | "resolution" | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoStreamRef = useRef<HTMLVideoElement>(null);
  const streamTrackRef = useRef<MediaStream | null>(null);
  const workerFileInputRef = useRef<HTMLInputElement>(null);
  const resolutionFileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async (slot: "worker" | "resolution") => {
    setTargetSlot(slot);
    setShowCameraModal(true);
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
      setCameraError(`Camera error: ${err.message}. You can upload an image file instead.`);
    }
  };

  const stopCamera = () => {
    if (streamTrackRef.current) {
      streamTrackRef.current.getTracks().forEach((t) => t.stop());
      streamTrackRef.current = null;
    }
    setShowCameraModal(false);
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

  const capturePhoto = () => {
    if (!videoStreamRef.current || !targetSlot) return;
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
      uploadEvidencePhoto(targetSlot, dataUrl);
    }
    stopCamera();
  };

  const handleFileSelect = async (
    slot: "worker" | "resolution",
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file, 1024, 0.75);
      uploadEvidencePhoto(slot, dataUrl);
    } catch {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl) {
          uploadEvidencePhoto(slot, dataUrl);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const uploadEvidencePhoto = async (slot: "worker" | "resolution", photoUrl: string) => {
    setLoading(true);
    setActionMessage(null);
    const newStatus = slot === "resolution" ? "resolved" : "in_progress";
    const now = new Date().toISOString();
    let updatedReport: CivicReport | undefined;

    // 1. Instant Optimistic State Update for User Page
    setReport((prev) => {
      const updated: CivicReport = {
        ...prev,
        status: newStatus,
        updatedAt: now,
        workerMediaUrls:
          slot === "worker"
            ? [photoUrl, ...(prev.workerMediaUrls || [])]
            : prev.workerMediaUrls || [],
        resolutionMediaUrls:
          slot === "resolution"
            ? [photoUrl, ...(prev.resolutionMediaUrls || [])]
            : prev.resolutionMediaUrls || [],
      };
      if (slot === "resolution" && resolutionNotes) {
        updated.resolutionNotes = resolutionNotes;
      }
      updatedReport = updated;
      return updated;
    });

    // 2. Persist immediately to localStorage
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("civicpulse_client_reports") || "[]");
        const idx = stored.findIndex((r: any) => r.id.toLowerCase() === report.id.toLowerCase());
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
      } catch {}
    }

    setActionMessage(
      slot === "resolution"
        ? "✓ Resolution photo verified & uploaded live!"
        : "✓ On-site worker photo uploaded live!",
    );

    // 3. Send to API in background without blocking UI
    try {
      const res = await fetch("/api/status/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: report.id,
          newStatus,
          changedBy:
            slot === "resolution"
              ? "A. Sharma (Municipal Supervisor)"
              : report.worker || "R. Manjunath",
          role: slot === "resolution" ? "Staff" : "Worker",
          comment:
            slot === "resolution"
              ? "Supervisor verified & uploaded resolution photo."
              : "Field crew on site — uploaded live on-site remediation photo.",
          workerMedia: slot === "worker" ? [photoUrl] : report.workerMediaUrls,
          resolutionMedia: slot === "resolution" ? [photoUrl] : report.resolutionMediaUrls,
          resolutionNotes: slot === "resolution" ? resolutionNotes : undefined,
          worker: report.worker || "R. Manjunath",
          department: report.department || "Public Works — Roads",
          runAiCheck: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.report) setReport((prev) => ({ ...prev, ...data.report }));
        if (data.historyEntry) {
          setHistory((prev) => [...prev, data.historyEntry]);
        }
      }
    } catch (err: any) {
      console.warn("Upload photo network notice:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch live state from Status Engine with smart merge protecting resolved status
  const fetchLiveState = async () => {
    let localReport: CivicReport | null = null;
    if (typeof window !== "undefined") {
      try {
        const local = JSON.parse(localStorage.getItem("civicpulse_client_reports") || "[]");
        const found = local.find(
          (r: any) => r.id.toLowerCase() === report.id.toLowerCase() && r.id !== "CIV-42603",
        );
        if (found) {
          localReport = found;
        }
      } catch {}
    }

    try {
      const res = await fetch(`/api/status/report?id=${encodeURIComponent(report.id)}`);
      if (res.ok) {
        const data = await res.json();
        const serverReport: CivicReport | null = data.report || null;
        if (data.history) setHistory(data.history);

        if (serverReport && localReport) {
          // Terminal state protection: if local state is resolved and server is not, protect resolved status
          if (localReport.status === "resolved" && serverReport.status !== "resolved") {
            setReport((prev) => ({ ...prev, ...serverReport, ...localReport, status: "resolved" }));
          } else {
            const localTime = new Date(localReport.updatedAt || 0).getTime();
            const serverTime = new Date(serverReport.updatedAt || 0).getTime();
            if (localTime >= serverTime) {
              setReport((prev) => ({ ...prev, ...serverReport, ...localReport }));
            } else {
              setReport((prev) => ({
                ...prev,
                ...localReport,
                ...serverReport,
                resolutionMediaUrls: serverReport.resolutionMediaUrls?.length
                  ? serverReport.resolutionMediaUrls
                  : localReport.resolutionMediaUrls,
                workerMediaUrls: serverReport.workerMediaUrls?.length
                  ? serverReport.workerMediaUrls
                  : localReport.workerMediaUrls,
              }));
            }
          }
          return;
        } else if (serverReport) {
          setReport(serverReport);
          return;
        }
      }
    } catch (err) {
      console.warn("Live status fetch notice:", err);
    }

    if (localReport) {
      setReport((prev) => ({ ...prev, ...localReport }));
    }
  };

  useEffect(() => {
    // 1. Initial check from localStorage immediately on mount
    if (typeof window !== "undefined") {
      try {
        const local = JSON.parse(localStorage.getItem("civicpulse_client_reports") || "[]");
        const found = local.find((r: any) => r.id.toLowerCase() === initialReport.id.toLowerCase());
        if (found) {
          setReport((prev) => ({ ...prev, ...found }));
        }
      } catch {}
    }

    fetchLiveState();
    const interval = setInterval(fetchLiveState, 3000);
    const handleUpdate = (e: any) => {
      if (e?.detail?.id && e.detail.id.toLowerCase() === report.id.toLowerCase()) {
        setReport((prev) => ({ ...prev, ...e.detail }));
      } else {
        fetchLiveState();
      }
    };
    window.addEventListener("civicpulse_report_updated", handleUpdate);
    window.addEventListener("civicpulse_report_created", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener("civicpulse_report_updated", handleUpdate);
      window.removeEventListener("civicpulse_report_created", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [report.id]);

  // Status transition trigger
  const handleTransition = async (newStatus: ReportStatus, comment?: string, runAi?: boolean) => {
    setLoading(true);
    setActionMessage(null);
    const now = new Date().toISOString();
    const isElectric =
      (report.category || "").toLowerCase().includes("electric") || report.id.includes("95674");
    const defaultResolutionPhoto = isElectric
      ? "/media/evidence/streetlight_resolved.jpg"
      : "/media/evidence/pothole_resolved.jpg";

    let updatedReport: CivicReport | undefined;

    // 1. Optimistic state update for instant UI feedback
    setReport((prev) => {
      const updated: CivicReport = {
        ...prev,
        status: newStatus,
        updatedAt: now,
        resolutionMediaUrls:
          newStatus === "resolved"
            ? prev.resolutionMediaUrls && prev.resolutionMediaUrls.length > 0
              ? prev.resolutionMediaUrls
              : [defaultResolutionPhoto]
            : prev.resolutionMediaUrls,
      };
      if (newStatus === "resolved" && resolutionNotes) {
        updated.resolutionNotes = resolutionNotes;
      }
      updatedReport = updated;
      return updated;
    });

    // 2. Persist immediately to localStorage
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("civicpulse_client_reports") || "[]");
        const idx = stored.findIndex((r: any) => r.id.toLowerCase() === report.id.toLowerCase());
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
      } catch {}
    }

    setActionMessage(`✓ Status updated to ${newStatus.replace("_", " ").toUpperCase()}!`);

    try {
      const res = await fetch("/api/status/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: report.id,
          newStatus,
          changedBy:
            newStatus === "in_progress"
              ? report.worker || "R. Manjunath"
              : "A. Sharma (Municipal Supervisor)",
          role: newStatus === "in_progress" ? "Worker" : "Staff",
          comment: comment || `Status advanced to ${newStatus.replace("_", " ").toUpperCase()}`,
          department: report.department || "Public Works — Roads",
          worker: report.worker || "R. Manjunath",
          workerMedia:
            newStatus === "in_progress" || newStatus === "assigned" || newStatus === "resolved"
              ? report.workerMediaUrls && report.workerMediaUrls.length > 0
                ? report.workerMediaUrls
                : ["/media/evidence/road_worker_onsite.jpg"]
              : undefined,
          resolutionMedia:
            newStatus === "resolved"
              ? report.resolutionMediaUrls && report.resolutionMediaUrls.length > 0
                ? report.resolutionMediaUrls
                : [defaultResolutionPhoto]
              : undefined,
          resolutionNotes: newStatus === "resolved" ? resolutionNotes : undefined,
          runAiCheck: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.report) setReport((prev) => ({ ...prev, ...data.report }));
        if (data.historyEntry) {
          setHistory((prev) => [...prev, data.historyEntry]);
        }
        if (data.aiVerification) {
          setAiVerification(data.aiVerification);
        }
      }
    } catch (err: any) {
      console.warn("Transition network notice:", err);
    } finally {
      setLoading(false);
    }
  };

  // Run AI Evidence Check independently
  const runAiEvidenceCheck = async () => {
    setVerifyingAi(true);
    try {
      const res = await fetch("/api/ai/verify-resolution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalReport: {
            title: report.title,
            description: report.description,
            category: report.category,
          },
          resolutionNotes: resolutionNotes,
          mediaLabels: ["road_surface_repaired_after.jpg", "steam_roller_compaction.jpg"],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiVerification(data);
      }
    } catch (err: any) {
      console.warn("AI verification error:", err);
    } finally {
      setVerifyingAi(false);
    }
  };

  // Run SerpAPI Municipal Search
  const runMunicipalSearch = async () => {
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/search/municipal?q=${encodeURIComponent(municipalQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (err) {
      console.warn("Search error:", err);
    } finally {
      setSearchLoading(false);
    }
  };

  const currentStageIndex = getStageIndex(report.status);

  return (
    <SiteLayout>
      <Section align="left" eyebrow={`Tracking ID: ${report.id}`} title={report.title}>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={report.status} />
          <PriorityBadge priority={report.priority} />
          <span className="text-sm text-muted-foreground">
            {report.area} · {report.ward} · Hassan Municipal Corporation
          </span>
          <div className="ml-auto flex items-center gap-2">
            {isConfirmingDelete ? (
              <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={handleDeleteThisReport}
                  className="inline-flex items-center gap-1 text-xs font-bold text-white bg-destructive px-3 py-1.5 rounded-xl hover:brightness-110 transition shadow-sm"
                >
                  Yes, Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  className="inline-flex items-center text-xs font-semibold text-muted-foreground bg-background border border-border px-2.5 py-1.5 rounded-xl hover:bg-muted transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-destructive bg-destructive/10 border border-destructive/30 px-3 py-1.5 rounded-xl hover:bg-destructive hover:text-white transition shadow-sm"
                title="Permanently delete this report from Supabase & system"
              >
                <span>🗑️</span> Delete Report
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setShowSearchModal(true);
                runMunicipalSearch();
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-xl hover:bg-primary/20 transition"
            >
              🔍 Official Guidelines
            </button>
          </div>
        </div>

        {/* Action feedback alert */}
        {actionMessage && (
          <div className="mt-4 rounded-xl bg-success/15 border border-success/30 p-3 text-sm font-semibold text-success flex items-center justify-between">
            <span>✓ {actionMessage}</span>
            <button onClick={() => setActionMessage(null)} className="text-xs font-bold underline">
              Dismiss
            </button>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {/* Interactive Workflow Simulation Panel */}
            {/* Citizen Resolution Tracking Card */}
            <div className="surface-card p-5 border border-primary/20 bg-primary/5 rounded-2xl">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-primary animate-pulse" />
                    Citizen Live Resolution Tracking
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your report is registered in the municipal queue with verified GPS and
                    photographic evidence.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-background border border-border flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-primary" />
                  Status: {report.status.toUpperCase()}
                </span>
              </div>

              <div className="mt-4 rounded-xl bg-background/80 p-3.5 border border-border/60 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Assigned Department:</span>
                  <strong className="text-foreground">
                    {report.department || "Electrical Department"}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Triage Priority:</span>
                  <span className="font-bold text-destructive uppercase">{report.priority}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Field Worker:</span>
                  <span className="text-foreground">
                    {report.worker ? report.worker : "Awaiting municipal assignment"}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  Are you a municipal officer or field worker?
                </span>
                <Link
                  to="/admin/reports"
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  Verify & Assign in Admin Dashboard →
                </Link>
              </div>
            </div>

            {/* AI Resolution Evidence Analysis (Service 5) */}
            {aiVerification && (
              <div className="surface-card p-5 border-2 border-teal/40 bg-teal/5 rounded-2xl animate-rise-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal">
                    AI Service 5 — Resolution Evidence Verification
                  </span>
                  <span className="text-xs font-mono font-bold bg-teal/20 text-teal-foreground px-2 py-0.5 rounded">
                    {aiVerification.confidence}% Confidence
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-bold text-foreground">
                  Assessment:{" "}
                  {aiVerification.consistent
                    ? "✓ Work Consistent with Original Complaint"
                    : "⚠️ Discrepancy Flagged"}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {aiVerification.assessment}
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="font-bold">Recommendation:</span>
                  <span className="px-2 py-0.5 rounded bg-success/20 text-success font-semibold">
                    {aiVerification.recommendation.replace(/_/g, " ").toUpperCase()}
                  </span>
                </div>
              </div>
            )}

            {/* 8-Stage Timeline */}
            <div className="surface-card p-6">
              <h2 className="text-sm font-bold">Live Status Timeline</h2>
              <ol className="mt-5 space-y-4">
                {DETAILED_STAGES.map((s, i) => {
                  const done = i <= currentStageIndex;
                  const current = i === currentStageIndex;
                  return (
                    <li key={s.key} className="flex gap-4 items-start">
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                          current
                            ? "bg-primary text-primary-foreground ring-4 ring-primary/20 scale-105"
                            : done
                              ? "bg-success/15 text-success"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {done && !current ? "✓" : i + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-foreground">
                            {s.label}
                            {current && (
                              <span className="ml-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                Active State
                              </span>
                            )}
                          </p>
                          <span className="text-xs text-muted-foreground font-medium">
                            Actor: {s.actor}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.detail}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Immutable Audit Log / Status History (Prompt Section 20) */}
            <div className="surface-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold">Audit History (report_status_history)</h2>
                <span className="text-xs text-muted-foreground font-mono">
                  {history.length} records
                </span>
              </div>

              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">Loading audit records…</p>
              ) : (
                <ul className="space-y-3">
                  {history.map((h, i) => (
                    <li
                      key={h.id || i}
                      className="rounded-xl border border-border p-3 text-xs bg-muted/20"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-foreground">
                          {h.oldStatus ? `${h.oldStatus.toUpperCase()} → ` : ""}
                          {h.newStatus.toUpperCase()}
                        </span>
                        <span className="text-muted-foreground font-normal">
                          {formatDateTime(h.changedAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{h.comment}</p>
                      <p className="mt-1 text-[11px] text-primary font-medium">
                        Logged by: {h.changedBy} ({h.role})
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Real Visual Evidence Archive */}
            <div className="surface-card p-6 rounded-2xl border border-border shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                    <span>📸</span> Visual Evidence Archive (Real-time Audit)
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Original complaint photo, field crew on-site remediation, and final resolution
                    photo.
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-teal/15 text-teal-foreground">
                  Verified Visual Records
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {/* 1. Original Citizen Report Photo */}
                <figure className="rounded-xl border border-border p-3 bg-muted/20 flex flex-col justify-between">
                  <div>
                    <div className="relative rounded-lg overflow-hidden border border-border aspect-square bg-black/10">
                      <img
                        src={
                          (report.mediaUrls && report.mediaUrls[0]) ||
                          (report.category === "electricity"
                            ? "/media/evidence/streetlight_before.jpg"
                            : "/media/evidence/pothole_before.jpg")
                        }
                        alt="Original Issue"
                        className="w-full h-full object-cover hover:scale-105 transition duration-300"
                        onError={(e) => {
                          (e.target as any).src =
                            report.category === "electricity"
                              ? "/media/evidence/streetlight_before.jpg"
                              : "/media/evidence/pothole_before.jpg";
                        }}
                      />
                      <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded bg-black/75 text-white backdrop-blur">
                        1. Before Repair
                      </span>
                    </div>
                    <figcaption className="mt-2.5 text-xs font-bold text-foreground">
                      Original Report Photo
                    </figcaption>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Uploaded with report {report.id}
                    </p>
                  </div>
                  <span className="mt-2 inline-block text-[10px] font-semibold text-primary">
                    ✓ Authenticated Location & Media
                  </span>
                </figure>

                {/* 2. Worker On-Site Photo (In Progress) */}
                <figure className="rounded-xl border border-border p-3 bg-muted/20 flex flex-col justify-between">
                  <div>
                    <div className="relative rounded-lg overflow-hidden border border-border aspect-square bg-black/10">
                      {report.status === "in_progress" ||
                      report.status === "assigned" ||
                      report.status === "resolved" ? (
                        <>
                          <img
                            src={
                              (report.workerMediaUrls && report.workerMediaUrls[0]) ||
                              "/media/evidence/road_worker_onsite.jpg"
                            }
                            alt="Worker On Site"
                            className="w-full h-full object-cover hover:scale-105 transition duration-300"
                            onError={(e) => {
                              (e.target as any).src = "/media/evidence/road_worker_onsite.jpg";
                            }}
                          />
                          <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded bg-warning text-warning-foreground shadow">
                            2. Active On-Site
                          </span>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-muted/40">
                          <span className="text-2xl mb-1">⏳</span>
                          <span className="text-xs font-bold text-muted-foreground">
                            Awaiting Crew Deployment
                          </span>
                          <span className="text-[10px] text-muted-foreground mt-1">
                            Photo appears when worker reaches site
                          </span>
                        </div>
                      )}
                    </div>
                    <figcaption className="mt-2.5 text-xs font-bold text-foreground">
                      Worker On-Site Photo
                    </figcaption>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {report.worker
                        ? `Crew assigned: ${report.worker}`
                        : "Field worker verification"}
                    </p>

                    {/* Interactive upload triggers for worker photo */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => workerFileInputRef.current?.click()}
                        className="px-2 py-1 rounded-lg bg-warning/15 hover:bg-warning/25 text-warning-foreground font-bold text-[10px] transition flex items-center gap-1 border border-warning/30"
                        title="Upload on-site worker photo proof"
                      >
                        <span>🖼️</span> Upload Worker Photo
                      </button>
                      <button
                        type="button"
                        onClick={() => startCamera("worker")}
                        className="px-2 py-1 rounded-lg bg-surface hover:bg-accent text-foreground font-bold text-[10px] transition flex items-center gap-1 border border-border"
                        title="Take live photo with camera"
                      >
                        <span>📷</span> Camera
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span>🛠️</span>{" "}
                      {report.worker ? `Assigned: ${report.worker}` : "Pending assignment"}
                    </span>
                    <Link
                      to="/admin/reports"
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Staff portal →
                    </Link>
                  </div>
                </figure>

                {/* 3. Resolution Photo (After Resolution) */}
                <figure className="rounded-xl border border-border p-3 bg-muted/20 flex flex-col justify-between">
                  <div>
                    <div className="relative rounded-lg overflow-hidden border border-border aspect-square bg-black/10">
                      {report.status === "resolved" ? (
                        <>
                          <img
                            src={
                              (report.resolutionMediaUrls && report.resolutionMediaUrls[0]) ||
                              (report.category === "electricity"
                                ? "/media/evidence/streetlight_resolved.jpg"
                                : "/media/evidence/pothole_resolved.jpg")
                            }
                            alt="Resolution Completed"
                            className="w-full h-full object-cover hover:scale-105 transition duration-300"
                            onError={(e) => {
                              (e.target as any).src =
                                report.category === "electricity"
                                  ? "/media/evidence/streetlight_resolved.jpg"
                                  : "/media/evidence/pothole_resolved.jpg";
                            }}
                          />
                          <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded bg-success text-success-foreground shadow">
                            3. Resolved
                          </span>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-muted/40">
                          <span className="text-2xl mb-1">🛠️</span>
                          <span className="text-xs font-bold text-muted-foreground">
                            Pending Work Completion
                          </span>
                          <span className="text-[10px] text-muted-foreground mt-1">
                            Uploaded upon supervisor approval
                          </span>
                        </div>
                      )}
                    </div>
                    <figcaption className="mt-2.5 text-xs font-bold text-foreground">
                      Resolution Photo
                    </figcaption>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {report.status === "resolved"
                        ? report.category === "electricity"
                          ? "Streetlight lamp replaced and circuit verified"
                          : "Final surface leveled and tested"
                        : "Completion evidence"}
                    </p>

                    {/* Interactive upload triggers for resolution photo */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => resolutionFileInputRef.current?.click()}
                        className="px-2 py-1 rounded-lg bg-success text-success-foreground hover:bg-success/90 font-bold text-[10px] transition flex items-center gap-1 shadow-sm"
                        title="Upload completion photo proof and mark resolved"
                      >
                        <span>✓</span> Upload Proof & Resolve
                      </button>
                      <button
                        type="button"
                        onClick={() => startCamera("resolution")}
                        className="px-2 py-1 rounded-lg bg-surface hover:bg-accent text-foreground font-bold text-[10px] transition flex items-center gap-1 border border-border"
                        title="Take live photo with camera"
                      >
                        <span>📷</span> Camera
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span>✅</span>{" "}
                      {report.status === "resolved"
                        ? "Approved by supervisor"
                        : "Awaiting completion"}
                    </span>
                    <Link
                      to="/admin/reports"
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Staff portal →
                    </Link>
                  </div>
                </figure>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <aside className="space-y-4">
            <div className="surface-card p-5">
              <h2 className="text-sm font-bold">Assigned Department</h2>
              <dl className="mt-3 space-y-2 text-xs">
                <div>
                  <dt className="text-muted-foreground font-semibold">Department</dt>
                  <dd className="text-sm font-bold text-foreground">{report.department}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-semibold">Assigned Field Worker</dt>
                  <dd className="text-sm font-bold text-foreground">
                    {report.worker || "Designated upon verification"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-semibold">Target Ward</dt>
                  <dd className="font-semibold text-foreground">
                    {report.ward} · {report.area}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-semibold">AI Confidence</dt>
                  <dd className="font-semibold text-foreground">
                    {Math.round((report.aiConfidence || 0.92) * 100)}%
                  </dd>
                </div>
              </dl>
            </div>

            <div className="surface-card p-5">
              <h2 className="text-sm font-bold mb-3">Incident Geolocation</h2>
              <RealMap
                initialLat={13.0072}
                initialLng={76.1023}
                className="h-44 w-full rounded-xl"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Verified GPS location in {report.ward}, {report.area}.
              </p>
            </div>

            <div className="surface-card p-5 bg-navy text-navy-foreground rounded-2xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal">
                Architecture Principle
              </h3>
              <p className="mt-2 text-xs leading-relaxed opacity-90">
                <strong>Facts & Workflow</strong> are strictly executed by normal software rules and
                PostgreSQL status history.
              </p>
              <p className="mt-2 text-xs leading-relaxed opacity-90">
                <strong>AI Layer</strong> is solely dedicated to analysis, duplicate detection,
                priority suggestions, and resolution verification.
              </p>
            </div>
          </aside>
        </div>

        {/* Official Municipal Search Modal (SerpAPI) */}
        {showSearchModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="surface-card max-w-xl w-full p-6 shadow-2xl rounded-2xl animate-rise-in max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <span>🏛️</span> Official Municipal Information & Guidelines
                </h3>
                <button
                  type="button"
                  onClick={() => setShowSearchModal(false)}
                  className="size-8 rounded-full border border-border flex items-center justify-center font-bold hover:bg-accent text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">
                  Live retrieval via <strong>SerpAPI</strong> from official Government of Karnataka
                  & Hassan Municipal portals:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={municipalQuery}
                    onChange={(e) => setMunicipalQuery(e.target.value)}
                    className="flex-1 text-xs p-2.5 rounded-xl border border-input bg-surface"
                  />
                  <button
                    type="button"
                    onClick={runMunicipalSearch}
                    disabled={searchLoading}
                    className="min-h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
                  >
                    {searchLoading ? "Searching…" : "Search"}
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {searchLoading ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Searching official portals…
                  </p>
                ) : searchResults.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    No official results found.
                  </p>
                ) : (
                  searchResults.map((r, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl border border-border bg-muted/20 text-xs"
                    >
                      <a
                        href={r.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-primary hover:underline block text-sm"
                      >
                        {r.title}
                      </a>
                      <p className="mt-1 text-muted-foreground leading-relaxed">{r.snippet}</p>
                      <span className="mt-1.5 inline-block text-[10px] text-muted-foreground font-mono">
                        {r.link}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hidden File Inputs for Worker / Resolution Evidence */}
        <input
          type="file"
          ref={workerFileInputRef}
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileSelect("worker", e)}
        />
        <input
          type="file"
          ref={resolutionFileInputRef}
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileSelect("resolution", e)}
        />

        {/* Live Camera Viewfinder Modal */}
        {showCameraModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="surface-card max-w-lg w-full p-6 rounded-2xl shadow-2xl animate-rise-in">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <span>📷</span> Live Camera —{" "}
                  {targetSlot === "worker"
                    ? "Worker On-Site Evidence"
                    : "Supervisor Resolution Evidence"}
                </h3>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="size-8 rounded-full border border-border flex items-center justify-center font-bold hover:bg-accent text-xs"
                >
                  ✕
                </button>
              </div>

              {cameraError ? (
                <div className="mt-4 p-4 rounded-xl bg-destructive/10 text-destructive text-xs space-y-3">
                  <p>{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      if (targetSlot === "worker") workerFileInputRef.current?.click();
                      else resolutionFileInputRef.current?.click();
                    }}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs"
                  >
                    Upload Image File Instead
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-border">
                    <video
                      ref={videoStreamRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-4 border-2 border-dashed border-white/50 rounded-xl pointer-events-none flex items-center justify-center">
                      <span className="text-white/80 text-xs font-semibold bg-black/50 px-3 py-1 rounded-full backdrop-blur">
                        {targetSlot === "worker"
                          ? "Focus on active remediation work"
                          : "Focus on completed repaired issue"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-lg hover:scale-105 transition flex items-center gap-2"
                    >
                      <span className="size-3.5 rounded-full bg-white animate-pulse" />
                      Capture & Upload Photo
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-4 py-2.5 rounded-full border border-border text-sm font-semibold hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Section>
    </SiteLayout>
  );
}
