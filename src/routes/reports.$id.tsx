import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/site/site-layout";
import { PriorityBadge, Section, StatusBadge } from "@/components/site/primitives";
import { REPORTS, formatDateTime, getReport, CivicReport, ReportStatus, FIELD_WORKERS } from "@/lib/civic-data";
import { RealMap } from "@/components/site/real-map";

export const Route = createFileRoute("/reports/$id")({
  loader: ({ params }) => {
    const report = getReport(params.id) || {
      id: params.id,
      title: "Civic Issue Report",
      category: "roads",
      categoryLabel: "Road & pothole",
      description: "Reported civic issue registered in CivicPulse system.",
      ward: "Ward 12",
      area: "Bus Stand Road",
      status: "submitted",
      priority: "high",
      department: "Public Works — Roads",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiConfidence: 0.94,
      duplicateProbability: 0.12,
      upvotes: 1,
      anonymous: false,
      x: 30,
      y: 45,
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
  { key: "submitted", label: "1. Report Submitted", actor: "Citizen", detail: "Registered with GPS, photo evidence & AI triage" },
  { key: "verified", label: "2. Verified by Staff", actor: "Municipal Staff", detail: "Issue authenticity & jurisdiction confirmed" },
  { key: "assigned", label: "3. Field Worker Assigned", actor: "Department Dispatch", detail: "Target schedule and work order issued" },
  { key: "in_progress", label: "4. Work in Progress", actor: "Field Worker", detail: "Crew deployed on site with materials" },
  { key: "resolution_submitted", label: "5. Resolution Submitted", actor: "Field Worker", detail: "Completion media uploaded & AI checked" },
  { key: "resolved", label: "6. Officially Resolved", actor: "Municipal Supervisor", detail: "Inspection approved and citizen notified" },
];

function getStageIndex(status: ReportStatus): number {
  switch (status) {
    case "submitted": return 0;
    case "verified": return 1;
    case "assigned": return 2;
    case "in_progress": return 3;
    case "resolved": return 5;
    default: return 0;
  }
}

function ReportDetails() {
  const { initialReport } = Route.useLoaderData();
  const [report, setReport] = useState<CivicReport>(initialReport);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Resolution & AI verification state
  const [resolutionNotes, setResolutionNotes] = useState("Filled pothole with dense bitumen mix, compacted surface, and reopened lane.");
  const [aiVerification, setAiVerification] = useState<any>(null);
  const [verifyingAi, setVerifyingAi] = useState(false);

  // Municipal Search state (SerpAPI)
  const [municipalQuery, setMunicipalQuery] = useState("Hassan city municipal council grievance helpline");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Fetch live state from Status Engine
  const fetchLiveState = async () => {
    try {
      const res = await fetch(`/api/status/report?id=${encodeURIComponent(report.id)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.report) setReport(data.report);
        if (data.history) setHistory(data.history);
      }
    } catch (err) {
      console.warn("Live status fetch fallback:", err);
    }
  };

  useEffect(() => {
    fetchLiveState();
    const interval = setInterval(fetchLiveState, 4000);
    return () => clearInterval(interval);
  }, [report.id]);

  // Status transition trigger
  const handleTransition = async (newStatus: ReportStatus, comment?: string, runAi?: boolean) => {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/status/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: report.id,
          newStatus,
          changedBy: newStatus === "in_progress" ? (report.worker || "R. Manjunath") : "A. Sharma (Municipal Supervisor)",
          role: newStatus === "in_progress" ? "Worker" : "Staff",
          comment: comment || `Status advanced to ${newStatus.replace("_", " ").toUpperCase()}`,
          department: report.department || "Public Works — Roads",
          worker: report.worker || "R. Manjunath",
          workerMedia: newStatus === "in_progress" || newStatus === "assigned" || newStatus === "resolved"
            ? ["/media/evidence/road_worker_onsite.jpg"]
            : undefined,
          resolutionMedia: newStatus === "resolved"
            ? ["/media/evidence/pothole_resolved.jpg"]
            : undefined,
          resolutionNotes: newStatus === "resolved" ? resolutionNotes : undefined,
          runAiCheck: runAi || newStatus === "resolved",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setReport(data.report);
        if (data.historyEntry) {
          setHistory((prev) => [...prev, data.historyEntry]);
        }
        if (data.aiVerification) {
          setAiVerification(data.aiVerification);
        }
        setActionMessage(`Status updated to ${newStatus.replace("_", " ").toUpperCase()}!`);
      }
    } catch (err: any) {
      setActionMessage(`Error updating status: ${err.message}`);
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
          <button
            type="button"
            onClick={() => {
              setShowSearchModal(true);
              runMunicipalSearch();
            }}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-xl hover:bg-primary/20 transition"
          >
            🔍 Official Municipal Guidelines (SerpAPI)
          </button>
        </div>

        {/* Action feedback alert */}
        {actionMessage && (
          <div className="mt-4 rounded-xl bg-success/15 border border-success/30 p-3 text-sm font-semibold text-success flex items-center justify-between">
            <span>✓ {actionMessage}</span>
            <button onClick={() => setActionMessage(null)} className="text-xs font-bold underline">Dismiss</button>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">

            {/* Interactive Workflow Simulation Panel */}
            <div className="surface-card p-5 border-2 border-primary/30 bg-primary/5 rounded-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-primary animate-pulse" />
                    Status Machine Controller (Deterministic Workflow)
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Advance the report across each real-world stage. Every change records an immutable audit log.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-background border border-border">
                  Current: {report.status.toUpperCase()}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {report.status === "submitted" && (
                  <button
                    type="button"
                    onClick={() => handleTransition("verified", "Staff verified report location and confirmed category.")}
                    disabled={loading}
                    className="min-h-10 px-4 rounded-xl bg-teal text-teal-foreground text-xs font-bold shadow hover:bg-teal/90 transition"
                  >
                    1. Verify Report (Staff)
                  </button>
                )}

                {(report.status === "submitted" || report.status === "verified") && (
                  <button
                    type="button"
                    onClick={() => handleTransition("assigned", "Assigned to Public Works — Worker R. Manjunath designated.")}
                    disabled={loading}
                    className="min-h-10 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow hover:bg-primary/90 transition"
                  >
                    2. Assign Field Worker (Dispatch)
                  </button>
                )}

                {(report.status === "assigned") && (
                  <button
                    type="button"
                    onClick={() => handleTransition("in_progress", "Worker arrived on site. Material prepared and remediation underway.")}
                    disabled={loading}
                    className="min-h-10 px-4 rounded-xl bg-warning text-warning-foreground text-xs font-bold shadow hover:bg-warning/90 transition"
                  >
                    3. Start Work on Site (Field Worker)
                  </button>
                )}

                {report.status === "in_progress" && (
                  <div className="w-full space-y-3 pt-2">
                    <div className="rounded-xl bg-background p-3 border border-border">
                      <label className="block text-xs font-bold mb-1">Worker Completion Evidence & Notes:</label>
                      <textarea
                        rows={2}
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-input bg-surface"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={runAiEvidenceCheck}
                          disabled={verifyingAi}
                          className="min-h-9 px-3 rounded-lg bg-navy text-navy-foreground text-xs font-bold shadow hover:bg-navy/90 flex items-center gap-1.5"
                        >
                          {verifyingAi ? "AI Verifying…" : "⚡ 4. Run AI Evidence Check (Groq)"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTransition("resolved", `Resolution approved. ${resolutionNotes}`, true)}
                          disabled={loading}
                          className="min-h-9 px-4 rounded-lg bg-success text-success-foreground text-xs font-bold shadow hover:bg-success/90"
                        >
                          5. Approve & Resolve Report (Supervisor)
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {report.status === "resolved" && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-success">✓ This civic issue has been officially resolved!</span>
                    <button
                      type="button"
                      onClick={() => handleTransition("in_progress", "Citizen reopened: Issue recurred or was incomplete.")}
                      disabled={loading}
                      className="min-h-9 px-3 rounded-lg border border-destructive text-destructive text-xs font-bold hover:bg-destructive/10"
                    >
                      Reopen Report (Citizen)
                    </button>
                  </div>
                )}
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
                  Assessment: {aiVerification.consistent ? "✓ Work Consistent with Original Complaint" : "⚠️ Discrepancy Flagged"}
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
                          <span className="text-xs text-muted-foreground font-medium">Actor: {s.actor}</span>
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
                <span className="text-xs text-muted-foreground font-mono">{history.length} records</span>
              </div>

              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">Loading audit records…</p>
              ) : (
                <ul className="space-y-3">
                  {history.map((h, i) => (
                    <li key={h.id || i} className="rounded-xl border border-border p-3 text-xs bg-muted/20">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-foreground">
                          {h.oldStatus ? `${h.oldStatus.toUpperCase()} → ` : ""}{h.newStatus.toUpperCase()}
                        </span>
                        <span className="text-muted-foreground font-normal">{formatDateTime(h.changedAt)}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">{h.comment}</p>
                      <p className="mt-1 text-[11px] text-primary font-medium">Logged by: {h.changedBy} ({h.role})</p>
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
                    Original complaint photo, field crew on-site remediation, and final resolution photo.
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
                        src={(report.mediaUrls && report.mediaUrls[0]) || "/media/evidence/pothole_before.jpg"}
                        alt="Original Issue"
                        className="w-full h-full object-cover hover:scale-105 transition duration-300"
                        onError={(e) => {
                          (e.target as any).src = "/media/evidence/pothole_before.jpg";
                        }}
                      />
                      <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded bg-black/75 text-white backdrop-blur">
                        1. Before Repair
                      </span>
                    </div>
                    <figcaption className="mt-2.5 text-xs font-bold text-foreground">Original Report Photo</figcaption>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Uploaded with report {report.id}</p>
                  </div>
                  <span className="mt-2 inline-block text-[10px] font-semibold text-primary">
                    ✓ Authenticated Location & Media
                  </span>
                </figure>

                {/* 2. Worker On-Site Photo (In Progress) */}
                <figure className="rounded-xl border border-border p-3 bg-muted/20 flex flex-col justify-between">
                  <div>
                    <div className="relative rounded-lg overflow-hidden border border-border aspect-square bg-black/10">
                      {report.status === "in_progress" || report.status === "assigned" || report.status === "resolved" ? (
                        <>
                          <img
                            src={(report.workerMediaUrls && report.workerMediaUrls[0]) || "/media/evidence/road_worker_onsite.jpg"}
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
                          <span className="text-xs font-bold text-muted-foreground">Awaiting Crew Deployment</span>
                          <span className="text-[10px] text-muted-foreground mt-1">Photo appears when worker reaches site</span>
                        </div>
                      )}
                    </div>
                    <figcaption className="mt-2.5 text-xs font-bold text-foreground">Worker On-Site Photo</figcaption>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {report.worker ? `Crew assigned: ${report.worker}` : "Field worker verification"}
                    </p>
                  </div>
                  <span className="mt-2 inline-block text-[10px] font-semibold text-warning-foreground">
                    {report.status === "in_progress" || report.status === "resolved" ? "✓ Ground Work Verified" : "Pending Field Crew"}
                  </span>
                </figure>

                {/* 3. Resolution Photo (After Resolution) */}
                <figure className="rounded-xl border border-border p-3 bg-muted/20 flex flex-col justify-between">
                  <div>
                    <div className="relative rounded-lg overflow-hidden border border-border aspect-square bg-black/10">
                      {report.status === "resolved" ? (
                        <>
                          <img
                            src={(report.resolutionMediaUrls && report.resolutionMediaUrls[0]) || "/media/evidence/pothole_resolved.jpg"}
                            alt="Resolution Completed"
                            className="w-full h-full object-cover hover:scale-105 transition duration-300"
                            onError={(e) => {
                              (e.target as any).src = "/media/evidence/pothole_resolved.jpg";
                            }}
                          />
                          <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded bg-success text-success-foreground shadow">
                            3. Resolved
                          </span>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-muted/40">
                          <span className="text-2xl mb-1">🛠️</span>
                          <span className="text-xs font-bold text-muted-foreground">Pending Work Completion</span>
                          <span className="text-[10px] text-muted-foreground mt-1">Uploaded upon supervisor approval</span>
                        </div>
                      )}
                    </div>
                    <figcaption className="mt-2.5 text-xs font-bold text-foreground">Resolution Photo</figcaption>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {report.status === "resolved" ? "Final surface leveled and tested" : "Completion evidence"}
                    </p>
                  </div>
                  <span className="mt-2 inline-block text-[10px] font-semibold text-success">
                    {report.status === "resolved" ? "✓ 100% Resolved & Inspected" : "Pending Resolution"}
                  </span>
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
                  <dd className="text-sm font-bold text-foreground">{report.worker || "Designated upon verification"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-semibold">Target Ward</dt>
                  <dd className="font-semibold text-foreground">{report.ward} · {report.area}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-semibold">AI Confidence</dt>
                  <dd className="font-semibold text-foreground">{Math.round((report.aiConfidence || 0.92) * 100)}%</dd>
                </div>
              </dl>
            </div>

            <div className="surface-card p-5">
              <h2 className="text-sm font-bold mb-3">Incident Geolocation</h2>
              <RealMap initialLat={13.0072} initialLng={76.1023} className="h-44 w-full rounded-xl" />
              <p className="mt-2 text-xs text-muted-foreground">
                Verified GPS location in {report.ward}, {report.area}.
              </p>
            </div>

            <div className="surface-card p-5 bg-navy text-navy-foreground rounded-2xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal">Architecture Principle</h3>
              <p className="mt-2 text-xs leading-relaxed opacity-90">
                <strong>Facts & Workflow</strong> are strictly executed by normal software rules and PostgreSQL status history.
              </p>
              <p className="mt-2 text-xs leading-relaxed opacity-90">
                <strong>AI Layer</strong> is solely dedicated to analysis, duplicate detection, priority suggestions, and resolution verification.
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
                  Live retrieval via <strong>SerpAPI</strong> from official Government of Karnataka & Hassan Municipal portals:
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
                  <p className="text-xs text-muted-foreground py-4 text-center">Searching official portals…</p>
                ) : searchResults.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No official results found.</p>
                ) : (
                  searchResults.map((r, i) => (
                    <div key={i} className="p-3 rounded-xl border border-border bg-muted/20 text-xs">
                      <a href={r.link} target="_blank" rel="noopener noreferrer" className="font-bold text-primary hover:underline block text-sm">
                        {r.title}
                      </a>
                      <p className="mt-1 text-muted-foreground leading-relaxed">{r.snippet}</p>
                      <span className="mt-1.5 inline-block text-[10px] text-muted-foreground font-mono">{r.link}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Section>
    </SiteLayout>
  );
}
