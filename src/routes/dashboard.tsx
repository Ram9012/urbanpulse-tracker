import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/site/site-layout";
import { DemoDataNote, PriorityBadge, Section, Stat, StatusBadge } from "@/components/site/primitives";
import { ActivityMap } from "@/components/site/civic-map";
import { NOTIFICATIONS, REPORTS, formatDate, CivicReport } from "@/lib/civic-data";

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
      { property: "og:description", content: "Live citizen tracking and verified report status updates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [reports, setReports] = useState<CivicReport[]>(REPORTS);
  const [notifications, setNotifications] = useState<any[]>(NOTIFICATIONS);
  const [view, setView] = useState<"list" | "map">("list");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [lastSynced, setLastSynced] = useState<string>("Just now");

  // Fetch real-time live reports from backend
  const fetchLiveReports = async () => {
    try {
      const res = await fetch("/api/status/reports");
      if (res.ok) {
        const data = await res.json();
        if (data.reports && data.reports.length > 0) {
          setReports(data.reports);
          setLastSynced(new Date().toLocaleTimeString());
        }
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

  useEffect(() => {
    fetchLiveReports();
    // Live polling every 2.5 seconds for instant real-time sync with admin changes
    const interval = setInterval(fetchLiveReports, 2500);
    return () => clearInterval(interval);
  }, []);

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
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-xl bg-teal/10 border border-teal/20 px-3 py-1 text-xs font-semibold text-teal-foreground">
            <span className="inline-block size-2 rounded-full bg-teal animate-ping" />
            <span>Live Realtime Sync Active</span>
            <span className="text-[10px] text-muted-foreground ml-1">({lastSynced})</span>
          </div>
          <DemoDataNote />
          <Link
            to="/report"
            className="ml-auto inline-flex min-h-11 items-center rounded-xl bg-warm px-5 text-sm font-bold text-warm-foreground shadow hover:bg-warm/90 transition"
          >
            + Report New Issue
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total Reports" value={reports.length} hint="Submitted & tracked" />
          <Stat label="Active Reports" value={activeCount} hint="Being verified or repaired" />
          <Stat label="Resolved Issues" value={resolvedCount} hint="Closed with verified photo" />
          <Stat label="Municipal Ward" value={"Ward 12"} hint="Hassan Central" />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div>
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <label className="min-w-48 flex-1">
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Search my reports</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Report ID (CIV-...), issue, or street"
                  className="h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Filter by Status</span>
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
              <div role="group" aria-label="View mode" className="flex gap-1 rounded-xl bg-muted p-1">
                {(["list", "map"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    aria-pressed={view === v}
                    className={
                      "min-h-9 rounded-lg px-3 text-sm font-bold transition-colors " +
                      (view === v ? "bg-surface shadow-soft" : "text-muted-foreground")
                    }
                  >
                    {v === "list" ? "List" : "Map"}
                  </button>
                ))}
              </div>
            </div>

            {view === "map" ? (
              <ActivityMap compact />
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
                  const hasRealMedia = r.mediaUrls && r.mediaUrls.length > 0;
                  const thumb = hasRealMedia ? r.mediaUrls![0] : "/media/evidence/pothole_before.jpg";

                  return (
                    <li key={r.id} className="surface-card p-5 rounded-2xl transition-all hover:shadow-lift flex flex-col justify-between border border-border">
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
                              (e.target as any).src = "/media/evidence/pothole_before.jpg";
                            }}
                          />
                          <span className="absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded bg-black/70 text-white backdrop-blur">
                            📷 Visual Evidence
                          </span>
                        </div>

                        <h3 className="mt-3 text-sm font-bold leading-snug text-foreground">{r.title}</h3>

                        <dl className="mt-2.5 space-y-1 text-xs text-muted-foreground">
                          <div className="flex gap-1.5"><dt className="font-semibold text-foreground">Category:</dt><dd>{r.categoryLabel}</dd></div>
                          <div className="flex gap-1.5"><dt className="font-semibold text-foreground">Location:</dt><dd>{r.area}, {r.ward}</dd></div>
                          <div className="flex gap-1.5"><dt className="font-semibold text-foreground">Department:</dt><dd className="font-medium text-primary">{r.department}</dd></div>
                          {r.worker && (
                            <div className="flex gap-1.5"><dt className="font-semibold text-foreground">Assigned Worker:</dt><dd className="font-semibold text-foreground">{r.worker}</dd></div>
                          )}
                          <div className="flex gap-1.5"><dt className="font-semibold text-foreground">Last update:</dt><dd>{formatDate(r.updatedAt)}</dd></div>
                        </dl>
                      </div>

                      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
                        <PriorityBadge priority={r.priority} />
                        <Link
                          to="/reports/$id"
                          params={{ id: r.id }}
                          className="inline-flex min-h-9 px-4 items-center justify-center rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground text-xs font-bold transition"
                        >
                          Live Status & Timeline →
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <aside className="space-y-4">
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
                  <li key={n.id} className="flex gap-2.5 text-xs p-2.5 rounded-xl border border-border bg-muted/20">
                    <span aria-hidden="true" className={n.unread ? "text-primary mt-0.5 text-sm" : "text-muted-foreground mt-0.5"}>●</span>
                    <div className="flex-1">
                      <p className="font-semibold leading-snug text-foreground">{n.message || n.text}</p>
                      <span className="text-[10px] text-muted-foreground mt-1 block">{n.time || "Recent"}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="surface-card p-5 rounded-2xl shadow-sm">
              <h2 className="text-sm font-bold">Saved Geofences</h2>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-1.5"><span>🏠</span> Home · Suramangalam</li>
                <li className="flex items-center gap-1.5"><span>💼</span> Work · Racecourse Road</li>
                <li className="flex items-center gap-1.5"><span>🏫</span> School route · Ward 12</li>
              </ul>
            </div>

            <div className="surface-card p-5 bg-navy text-navy-foreground rounded-2xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal">Realtime Status Guarantee</h3>
              <p className="mt-2 text-xs leading-relaxed opacity-90">
                Any status advancement made in the municipal staff panel (Verify, Worker Assignment, Field Work, Resolution) synchronizes automatically to this dashboard without refreshing.
              </p>
            </div>
          </aside>
        </div>
      </Section>
    </SiteLayout>
  );
}
