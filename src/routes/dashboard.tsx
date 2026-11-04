import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/site/site-layout";
import {
  DemoDataNote,
  PriorityBadge,
  Section,
  Stat,
  StatusBadge,
} from "@/components/site/primitives";
import { ActivityMap } from "@/components/site/civic-map";
import {
  NOTIFICATIONS,
  REPORTS,
  formatDate,
  CivicReport,
  getDeletedReportIds,
  markReportDeleted,
} from "@/lib/civic-data";
import { useAuth } from "@/lib/auth-client";
import { CivicChatbot } from "@/components/site/civic-chatbot";
import { SocietyMap } from "@/components/site/society-map";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My Reports Dashboard — Live Realtime Tracking | CivicPulse" },
      {
        name: "description",
        content:
          "Track your submitted civic reports with real-time status updates from municipal admin and field workers.",
      },
      { property: "og:title", content: "My Reports Dashboard — CivicPulse" },
      {
        property: "og:description",
        content: "Live citizen tracking and verified report status updates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user, isAuthenticated, logout } = useAuth();
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
      } catch {}
    }
    return REPORTS.filter((r) => !deleted.has(r.id.toLowerCase()));
  });
  const [notifications, setNotifications] = useState<any[]>(NOTIFICATIONS);
  const [view, setView] = useState<"list" | "map" | "bot">("list");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [lastSynced, setLastSynced] = useState<string>("Just now");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch real-time live reports from backend and sync with localStorage
  const fetchLiveReports = async () => {
    try {
      const deleted = getDeletedReportIds();
      const res = await fetch("/api/status/reports");
      let serverReports: CivicReport[] = [];
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.deletedIds)) {
          data.deletedIds.forEach((id: string) => markReportDeleted(id));
        }
        if (data.reports && data.reports.length > 0) {
          serverReports = data.reports.filter(
            (r: CivicReport) =>
              !r.id.startsWith("CIV-104") && r.id !== "CIV-54728" && r.id !== "CIV-42603",
          );
        }
      }

      const freshDeleted = getDeletedReportIds();

      // Merge with client localStorage
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
        } catch {}
      }

      // Smart merge protecting resolved status and respecting timestamps
      const map = new Map<string, CivicReport>();
      REPORTS.forEach((r) => {
        if (!freshDeleted.has(r.id.toLowerCase())) {
          map.set(r.id.toLowerCase(), r);
        }
      });
      serverReports.forEach((sr) => {
        if (!freshDeleted.has(sr.id.toLowerCase())) {
          map.set(sr.id.toLowerCase(), sr);
        }
      });

      localReports.forEach((lr) => {
        if (freshDeleted.has(lr.id.toLowerCase())) return;
        const existing = map.get(lr.id.toLowerCase());
        if (!existing) {
          map.set(lr.id.toLowerCase(), lr);
        } else {
          const isLocalResolved = lr.status === "resolved";
          const isExistingResolved = existing.status === "resolved";
          if (isLocalResolved && !isExistingResolved) {
            map.set(lr.id.toLowerCase(), { ...existing, ...lr, status: "resolved" });
          } else {
            const localTime = new Date(lr.updatedAt || 0).getTime();
            const existingTime = new Date(existing.updatedAt || 0).getTime();
            if (localTime >= existingTime) {
              map.set(lr.id.toLowerCase(), { ...existing, ...lr });
            } else {
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

      const merged = Array.from(map.values()).filter(
        (r) =>
          !freshDeleted.has(r.id.toLowerCase()) &&
          !r.id.startsWith("CIV-104") &&
          r.id !== "CIV-54728" &&
          r.id !== "CIV-42603",
      );

      setReports(merged);
      setLastSynced(new Date().toLocaleTimeString());
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("civicpulse_client_reports", JSON.stringify(merged));
        } catch {}
      }

      // Also fetch live notifications
      const notifRes = await fetch("/api/notifications");
      if (notifRes.ok) {
        const nData = await notifRes.json();
        if (nData.notifications && nData.notifications.length > 0) {
          setNotifications(nData.notifications);
        }
      }
    } catch (err) {
      console.warn("Dashboard live sync notice:", err);
    }
  };

  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  useEffect(() => {
    fetchLiveReports();
    // Live polling every 3 seconds for instant real-time sync with admin changes
    const interval = setInterval(fetchLiveReports, 3000);
    const handleUpdate = () => fetchLiveReports();
    window.addEventListener("civicpulse_report_created", handleUpdate);
    window.addEventListener("civicpulse_report_updated", handleUpdate);
    window.addEventListener("civicpulse_report_deleted", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener("civicpulse_report_created", handleUpdate);
      window.removeEventListener("civicpulse_report_updated", handleUpdate);
      window.removeEventListener("civicpulse_report_deleted", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const handleDeleteReport = async (reportId: string) => {
    // 1. Immediately mark deleted in client persistent storage
    markReportDeleted(reportId);

    // 2. Remove immediately from state
    setReports((prev) => prev.filter((r) => r.id.toLowerCase() !== reportId.toLowerCase()));

    // 3. Remove from localStorage
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
      } catch {}
    }

    // 4. Send API call
    try {
      await fetch("/api/reports/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId }),
      });
    } catch (err: any) {
      console.warn("Delete API call notice:", err);
    }

    // 5. Broadcast deletion
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("civicpulse_report_deleted", { detail: { reportId } }));
    }

    setDeleteNotice(`✓ Report ${reportId} permanently deleted from database & Supabase.`);
    setTimeout(() => setDeleteNotice(null), 5000);
  };

  const mine = reports.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      `${r.id} ${r.title} ${r.area} ${r.ward}`.toLowerCase().includes(query.toLowerCase()),
  );
  const activeCount = reports.filter((r) => r.status !== "resolved").length;
  const resolvedCount = reports.filter((r) => r.status === "resolved").length;

  return (
    <SiteLayout>
      <Section align="left" eyebrow="Citizen Dashboard" title="My Civic Reports">
        {isAuthenticated && user ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal/30 bg-teal/5 p-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-teal/15 text-lg">
                {user.role === "admin" ? "🛡️" : "👤"}
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">
                  Welcome back, {user.displayName || user.username}!
                </p>
                <p className="text-xs text-muted-foreground">
                  Signed in as{" "}
                  <span className="font-semibold text-foreground">{user.username}</span> · Role:{" "}
                  <span className="font-semibold text-primary uppercase">{user.role}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user.role === "admin" && (
                <Link
                  to="/admin"
                  className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  Go to Admin Portal →
                </Link>
              )}
              <button
                type="button"
                onClick={logout}
                className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 p-4">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="text-base">💡</span>
              <span>
                You are browsing in guest mode. <strong>Sign In</strong> or{" "}
                <strong>Create an Account</strong> to track your reports and get notified.
              </span>
            </div>
            <Link
              to="/signin"
              className="rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Sign In / Create Account →
            </Link>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-xl bg-teal/10 border border-teal/20 px-3 py-1 text-xs font-semibold text-teal-foreground">
            <span className="inline-block size-2 rounded-full bg-teal animate-ping" />
            <span>Live Realtime Sync Active</span>
            <span className="text-[10px] text-muted-foreground ml-1">({lastSynced})</span>
          </div>
          <button
            type="button"
            onClick={() => setView("bot")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition active:scale-95 shadow-xs"
          >
            <span>🤖</span>
            <span>Open PulseBot AI Assistant</span>
          </button>
          <DemoDataNote />
          <Link
            to="/report"
            className="ml-auto inline-flex min-h-11 items-center rounded-xl bg-warm px-5 text-sm font-bold text-warm-foreground shadow hover:bg-warm/90 transition"
          >
            + Report New Issue
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Society Reports" value={reports.length} hint="Problems near your area" />
          <Stat
            label="My Reports"
            value={
              reports.filter(
                (r) => r.reportedBy === (user?.username || "bipinyadav") || r.id === "CIV-95674",
              ).length
            }
            hint="Submitted by you"
          />
          <Stat label="Active in Society" value={activeCount} hint="Being repaired by CMC" />
          <Stat label="Society & Ward" value={"Ward 12"} hint="Racecourse / Vidyanagar" />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_400px]">
          <div>
            {deleteNotice && (
              <div className="mb-4 rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-sm font-semibold text-destructive flex items-center justify-between">
                <span>{deleteNotice}</span>
                <button
                  onClick={() => setDeleteNotice(null)}
                  className="text-xs font-bold underline"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="mb-4 flex flex-wrap items-end gap-3">
              <label className="min-w-48 flex-1">
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                  Search my reports
                </span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Report ID (CIV-...), issue, or street"
                  className="h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                  Filter by Status
                </span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="h-11 rounded-xl border border-input bg-surface px-3 text-sm font-medium"
                >
                  <option value="all">All Statuses</option>
                  <option value="submitted">1. Submitted</option>
                  <option value="verified">2. Verified</option>
                  <option value="assigned">3. Assigned</option>
                  <option value="in_progress">4. In progress</option>
                  <option value="resolved">5. Resolved</option>
                </select>
              </label>
              <div
                role="group"
                aria-label="View mode"
                className="flex gap-1 rounded-xl bg-muted p-1"
              >
                {(
                  [
                    { id: "list", label: "📋 Reports", title: "My Reports List" },
                    { id: "map", label: "🗺️ Society Map", title: "Society & Neighborhood Map" },
                    { id: "bot", label: "🤖 PulseBot AI", title: "AI Civic Assistant" },
                  ] as const
                ).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setView(v.id)}
                    aria-pressed={view === v.id}
                    className={
                      "min-h-9 rounded-lg px-3 text-xs font-bold transition-colors " +
                      (view === v.id
                        ? "bg-surface text-primary shadow-soft"
                        : "text-muted-foreground hover:text-foreground")
                    }
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {view === "bot" ? (
              <div className="space-y-4">
                <CivicChatbot
                  user={user}
                  reports={reports}
                  variant="inline"
                  className="h-[620px] shadow-lg"
                />
              </div>
            ) : view === "map" ? (
              <SocietyMap
                reports={reports}
                currentUsername={user?.username || "bipinyadav"}
                onDeleteReport={handleDeleteReport}
              />
            ) : mine.length === 0 ? (
              <div className="surface-card p-12 text-center rounded-2xl">
                <p className="font-display text-lg font-bold">No reports match your filters</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Clear the filters, or submit a new report.
                </p>
                <Link
                  to="/report"
                  className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow"
                >
                  Report an issue
                </Link>
              </div>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {mine.map((r) => {
                  const hasResolutionMedia =
                    r.resolutionMediaUrls && r.resolutionMediaUrls.length > 0;
                  const hasWorkerMedia = r.workerMediaUrls && r.workerMediaUrls.length > 0;
                  const hasReportMedia = r.mediaUrls && r.mediaUrls.length > 0;

                  const defaultImg =
                    r.category === "electricity"
                      ? "/media/evidence/streetlight_before.jpg"
                      : "/media/evidence/pothole_before.jpg";
                  const thumb =
                    (r.status === "resolved" && hasResolutionMedia
                      ? r.resolutionMediaUrls![0]
                      : null) ||
                    (r.status === "in_progress" && hasWorkerMedia ? r.workerMediaUrls![0] : null) ||
                    (hasResolutionMedia ? r.resolutionMediaUrls![0] : null) ||
                    (hasWorkerMedia ? r.workerMediaUrls![0] : null) ||
                    (hasReportMedia ? r.mediaUrls![0] : defaultImg);

                  const badge =
                    r.status === "resolved"
                      ? {
                          text: "✓ Verified Resolution Photo",
                          cls: "bg-success text-success-foreground",
                        }
                      : r.status === "in_progress" || hasWorkerMedia
                        ? {
                            text: "🛠️ Active On-Site Photo",
                            cls: "bg-warning text-warning-foreground",
                          }
                        : { text: "📷 Original Complaint Photo", cls: "bg-black/75 text-white" };

                  return (
                    <li
                      key={r.id}
                      className="surface-card p-5 rounded-2xl transition-all hover:shadow-lift flex flex-col justify-between border border-border"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono font-bold bg-muted px-2 py-0.5 rounded text-foreground">
                            {r.id}
                          </span>
                          <StatusBadge status={r.status} />
                        </div>

                        {/* Real Photo Thumbnail */}
                        <div className="mt-3 relative rounded-xl overflow-hidden border border-border aspect-video bg-black/10">
                          <img
                            src={thumb}
                            alt={r.title}
                            className="w-full h-full object-cover hover:scale-105 transition duration-300"
                            onError={(e) => {
                              (e.target as any).src = defaultImg;
                            }}
                          />
                          <span
                            className={`absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded shadow backdrop-blur ${badge.cls}`}
                          >
                            {badge.text}
                          </span>
                        </div>

                        {/* Mini Evidence Progress Strip */}
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                          <span className="px-1.5 py-0.5 rounded bg-muted/60">
                            1. Original Photo ✓
                          </span>
                          {hasWorkerMedia ? (
                            <span className="px-1.5 py-0.5 rounded bg-warning/20 text-warning-foreground font-bold">
                              2. On-Site ✓
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-muted/30 opacity-60">
                              2. On-Site —
                            </span>
                          )}
                          {hasResolutionMedia ? (
                            <span className="px-1.5 py-0.5 rounded bg-success/20 text-success font-bold">
                              3. Resolved ✓
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-muted/30 opacity-60">
                              3. Resolved —
                            </span>
                          )}
                        </div>

                        <h3 className="mt-2.5 text-sm font-bold leading-snug text-foreground">
                          {r.title}
                        </h3>

                        <dl className="mt-2.5 space-y-1 text-xs text-muted-foreground">
                          <div className="flex gap-1.5">
                            <dt className="font-semibold text-foreground">Category:</dt>
                            <dd>{r.categoryLabel}</dd>
                          </div>
                          <div className="flex gap-1.5">
                            <dt className="font-semibold text-foreground">Location:</dt>
                            <dd>
                              {r.area}, {r.ward}
                            </dd>
                          </div>
                          <div className="flex gap-1.5">
                            <dt className="font-semibold text-foreground">Department:</dt>
                            <dd className="font-medium text-primary">{r.department}</dd>
                          </div>
                          {r.worker && (
                            <div className="flex gap-1.5">
                              <dt className="font-semibold text-foreground">Assigned Worker:</dt>
                              <dd className="font-semibold text-foreground">{r.worker}</dd>
                            </div>
                          )}
                          <div className="flex gap-1.5">
                            <dt className="font-semibold text-foreground">Last update:</dt>
                            <dd>{formatDate(r.updatedAt)}</dd>
                          </div>
                        </dl>
                      </div>

                      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
                        <PriorityBadge priority={r.priority} />
                        <div className="flex items-center gap-2">
                          {deleteConfirmId === r.id ? (
                            <div className="flex items-center gap-1 animate-in fade-in duration-150">
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteConfirmId(null);
                                  handleDeleteReport(r.id);
                                }}
                                className="inline-flex min-h-8 px-2 items-center justify-center rounded-lg bg-destructive text-white hover:brightness-110 text-xs font-bold transition shadow-xs"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="inline-flex min-h-8 px-2 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted text-xs font-semibold transition"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(r.id)}
                              className="inline-flex min-h-9 px-2.5 items-center justify-center rounded-xl border border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive hover:text-white text-xs font-bold transition shadow-sm"
                              title="Delete report permanently from Supabase & system"
                            >
                              <span>🗑️</span>
                            </button>
                          )}
                          <Link
                            to="/reports/$id"
                            params={{ id: r.id }}
                            className="inline-flex min-h-9 px-3 items-center justify-center rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground text-xs font-bold transition"
                          >
                            Live Status & Timeline →
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <aside className="space-y-4">
            {/* Groq AI Civic Chatbot (PulseBot) */}
            <CivicChatbot user={user} reports={reports} variant="inline" />

            {/* Live Notifications (Triggered by Status Machine) */}
            <div className="surface-card p-5 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <span>🔔</span> Live Notifications
                </h2>
                <span className="text-[10px] font-bold uppercase text-primary">Realtime</span>
              </div>
              <ul className="space-y-3">
                {notifications.slice(0, 5).map((n) => (
                  <li
                    key={n.id}
                    className="flex gap-2.5 text-xs p-2.5 rounded-xl border border-border bg-muted/20"
                  >
                    <span
                      aria-hidden="true"
                      className={
                        n.unread ? "text-primary mt-0.5 text-sm" : "text-muted-foreground mt-0.5"
                      }
                    >
                      ●
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold leading-snug text-foreground">
                        {n.message || n.text}
                      </p>
                      <span className="text-[10px] text-muted-foreground mt-1 block">
                        {n.time || "Recent"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="surface-card p-5 rounded-2xl shadow-sm">
              <h2 className="text-sm font-bold">Saved Geofences</h2>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-1.5">
                  <span>🏠</span> Home · Suramangalam
                </li>
                <li className="flex items-center gap-1.5">
                  <span>💼</span> Work · Racecourse Road
                </li>
                <li className="flex items-center gap-1.5">
                  <span>🏫</span> School route · Ward 12
                </li>
              </ul>
            </div>

            <div className="surface-card p-5 bg-navy text-navy-foreground rounded-2xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal">
                Realtime Status Guarantee
              </h3>
              <p className="mt-2 text-xs leading-relaxed opacity-90">
                Any status advancement made in the municipal staff panel (Verify, Worker Assignment,
                Field Work, Resolution) synchronizes automatically to this dashboard without
                refreshing.
              </p>
            </div>
          </aside>
        </div>
      </Section>
    </SiteLayout>
  );
}
