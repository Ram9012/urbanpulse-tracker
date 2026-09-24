import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DemoDataNote, PriorityBadge, StatusBadge } from "@/components/site/primitives";
import { CATEGORIES, DEPARTMENTS, FIELD_WORKERS, REPORTS, formatDate, CivicReport, ReportStatus } from "@/lib/civic-data";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [
      { title: "Live Report Management & AI Triage — CivicPulse Staff" },
      {
        name: "description",
        content:
          "Filter, classify, assign and resolve civic reports with Groq AI decision support and deterministic audit logging.",
      },
      { property: "og:title", content: "Live Report Management — CivicPulse Staff" },
      { property: "og:description", content: "Centralised civic report queue for municipal staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsTable,
});

function ReportsTable() {
  const [reports, setReports] = useState<CivicReport[]>(REPORTS);
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

  // Fetch reports from status engine API
  const fetchReports = async () => {
    try {
      const res = await fetch("/api/status/reports");
      if (res.ok) {
        const data = await res.json();
        if (data.reports) {
          setReports(data.reports);
        }
      }
    } catch (err) {
      console.warn("Could not fetch reports from API:", err);
    }
  };

  useEffect(() => {
    fetchReports();
    const timer = setInterval(fetchReports, 5000);
    return () => clearInterval(timer);
  }, []);

  // Status transition handler
  const transitionReport = async (reportId: string, newStatus: ReportStatus, comment?: string, workerName?: string, deptName?: string) => {
    setActionNotice(null);
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
        }),
      });

      if (res.ok) {
        setActionNotice(`Report ${reportId} successfully updated to ${newStatus.toUpperCase()}`);
        fetchReports();
      }
    } catch (err: any) {
      setActionNotice(`Error updating report: ${err.message}`);
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
    (r) => (category === "all" || r.category === category) && (status === "all" || r.status === status),
  );

  return (
    <div>
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Live Civic Reports Queue</h1>
          <p className="text-sm text-muted-foreground">
            Manage reports across all stages with deterministic status rules and Groq AI decision support.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={fetchAiWorkloadInsights}
            className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-xs font-bold text-navy-foreground shadow hover:bg-navy/90 transition"
          >
            <span>🤖</span> AI Operations Advisor (Groq)
          </button>
          <DemoDataNote />
        </div>
      </header>

      {actionNotice && (
        <div className="mt-4 rounded-xl bg-success/15 border border-success/30 p-3 text-xs font-bold text-success flex items-center justify-between">
          <span>✓ {actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="underline">Dismiss</button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label>
          <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 rounded-xl border border-input bg-surface px-3 text-sm">
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-xl border border-input bg-surface px-3 text-sm">
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
          <p className="mt-2 text-sm text-muted-foreground">Widen the filters to see more reports.</p>
        </div>
      ) : (
        <div className="surface-card mt-6 overflow-x-auto rounded-2xl shadow-sm">
          <table className="w-full min-w-[960px] text-sm">
            <caption className="sr-only">Civic report queue</caption>
            <thead className="bg-muted text-left">
              <tr>
                {["Report", "Category", "Location", "Priority", "Department", "Worker", "Status", "AI Signals", "Workflow Actions"].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-bold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-middle hover:bg-muted/10 transition">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className="size-9 shrink-0 rounded-lg border border-border civic-grid-bg" />
                      <span>
                        <span className="block font-bold">{r.id}</span>
                        <span className="block text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{r.categoryLabel}</td>
                  <td className="px-4 py-3">{r.area}<span className="block text-xs text-muted-foreground">{r.ward}</span></td>
                  <td className="px-4 py-3"><PriorityBadge priority={r.priority} /></td>
                  <td className="px-4 py-3">{r.department}</td>
                  <td className="px-4 py-3 font-medium">
                    {r.worker ? (
                      <span className="text-foreground">{r.worker}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-xs">
                    <span className="font-semibold">{Math.round((r.aiConfidence || 0.94) * 100)}% conf</span>
                    {r.duplicateProbability > 0.2 && (
                      <span className="block text-[11px] text-warning font-semibold">
                        ⚠️ Dup {Math.round(r.duplicateProbability * 100)}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to="/reports/$id" params={{ id: r.id }} className="text-xs font-bold text-primary hover:underline">
                        Timeline
                      </Link>

                      {r.status === "submitted" && (
                        <button
                          type="button"
                          onClick={() => transitionReport(r.id, "verified", "Verified by triage officer.")}
                          className="px-2.5 py-1 rounded-lg bg-teal text-teal-foreground text-xs font-bold hover:bg-teal/90"
                        >
                          Verify
                        </button>
                      )}

                      {(r.status === "submitted" || r.status === "verified") && (
                        <button
                          type="button"
                          onClick={() => setAssignFor(r.id)}
                          className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90"
                        >
                          Assign
                        </button>
                      )}

                      {r.status === "assigned" && (
                        <button
                          type="button"
                          onClick={() => transitionReport(r.id, "in_progress", "Worker arrived on site.")}
                          className="px-2.5 py-1 rounded-lg bg-warning text-warning-foreground text-xs font-bold hover:bg-warning/90"
                        >
                          Start Work
                        </button>
                      )}

                      {r.status === "in_progress" && (
                        <button
                          type="button"
                          onClick={() => transitionReport(r.id, "resolved", "Field remediation completed.")}
                          className="px-2.5 py-1 rounded-lg bg-success text-success-foreground text-xs font-bold hover:bg-success/90"
                        >
                          Resolve
                        </button>
                      )}
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
          <div role="dialog" aria-modal="true" aria-label={`Assign ${assignFor}`} className="surface-card w-full max-w-lg p-6 rounded-2xl shadow-2xl animate-rise-in">
            <h2 className="font-display text-lg font-extrabold">Assign Field Worker: {assignFor}</h2>
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
                  {DEPARTMENTS.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
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
                  transitionReport(assignFor, "assigned", `Assigned to ${selectedDept} -> Worker: ${selectedWorker}`, selectedWorker, selectedDept);
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
                Groq AI is analyzing department queues, SLA metrics, and bottleneck wards…
              </p>
            ) : aiInsights ? (
              <div className="mt-4 space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <span className="font-bold text-primary block uppercase tracking-wider text-[10px]">Operational Overview</span>
                  <p className="mt-1 text-foreground leading-relaxed">{aiInsights.overview}</p>
                </div>

                <div className="p-3 rounded-xl bg-warning/10 border border-warning/20">
                  <span className="font-bold text-warning-foreground block uppercase tracking-wider text-[10px]">Identified Bottlenecks</span>
                  <ul className="mt-1 list-disc list-inside space-y-1 text-foreground">
                    {aiInsights.key_bottlenecks?.map((b: string, i: number) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 rounded-xl bg-success/10 border border-success/20">
                  <span className="font-bold text-success block uppercase tracking-wider text-[10px]">Staffing Recommendations</span>
                  <ul className="mt-1 list-disc list-inside space-y-1 text-foreground">
                    {aiInsights.recommended_actions?.map((a: string, i: number) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">Click re-analyze to fetch insights.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
