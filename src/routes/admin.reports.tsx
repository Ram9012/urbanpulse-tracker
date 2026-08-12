import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { DemoDataNote, PriorityBadge, StatusBadge } from "@/components/site/primitives";
import { CATEGORIES, DEPARTMENTS, FIELD_WORKERS, REPORTS, formatDate } from "@/lib/civic-data";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [
      { title: "Live Report Management — CivicPulse Staff" },
      {
        name: "description",
        content:
          "Filter, classify, assign and escalate civic reports with AI assistance and duplicate detection.",
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
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [assignFor, setAssignFor] = useState<string | null>(null);

  const rows = REPORTS.filter(
    (r) => (category === "all" || r.category === category) && (status === "all" || r.status === status),
  );

  return (
    <div>
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Live reports</h1>
          <p className="text-sm text-muted-foreground">
            Every AI recommendation can be approved, edited or rejected before work is assigned.
          </p>
        </div>
        <DemoDataNote className="ml-auto" />
      </header>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label>
          <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 rounded-xl border border-input bg-surface px-3 text-sm">
            <option value="all">All</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-xl border border-input bg-surface px-3 text-sm">
            <option value="all">All</option>
            <option value="submitted">Submitted</option>
            <option value="verified">Verified</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
        <button type="button" className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-accent">
          Export data
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="surface-card mt-6 p-12 text-center">
          <p className="font-display text-lg font-bold">No reports in this queue</p>
          <p className="mt-2 text-sm text-muted-foreground">Widen the filters to see more reports.</p>
        </div>
      ) : (
        <div className="surface-card mt-6 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <caption className="sr-only">Civic report queue</caption>
            <thead className="bg-muted text-left">
              <tr>
                {["Report", "Category", "Location", "Priority", "Department", "Worker", "Status", "AI confidence", "Actions"].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-bold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className="size-9 shrink-0 rounded-lg border border-border civic-grid-bg" />
                      <span>
                        <span className="block font-bold">{r.id}</span>
                        <span className="block text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3">{r.categoryLabel}</td>
                  <td className="px-4 py-3">{r.area}<span className="block text-xs text-muted-foreground">{r.ward}</span></td>
                  <td className="px-4 py-3"><PriorityBadge priority={r.priority} /></td>
                  <td className="px-4 py-3">{r.department}</td>
                  <td className="px-4 py-3">{r.worker ?? <span className="text-muted-foreground">Unassigned</span>}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3">
                    {Math.round(r.aiConfidence * 100)}%
                    <span className="block text-xs text-muted-foreground">
                      duplicate {Math.round(r.duplicateProbability * 100)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-2">
                      <Link to="/reports/$id" params={{ id: r.id }} className="font-bold text-primary hover:underline">View</Link>
                      <button type="button" onClick={() => setAssignFor(r.id)} className="font-bold text-primary hover:underline">Assign</button>
                      <button type="button" className="font-bold text-muted-foreground hover:underline">Escalate</button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {assignFor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 p-4 sm:items-center">
          <div role="dialog" aria-modal="true" aria-label={`Assign ${assignFor}`} className="surface-card w-full max-w-lg p-6 animate-rise-in">
            <h2 className="font-display text-lg font-extrabold">Assign {assignFor}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold">Department</span>
                <select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                  {DEPARTMENTS.map((d) => <option key={d.name}>{d.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold">Field worker</span>
                <select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                  {FIELD_WORKERS.map((w) => (
                    <option key={w.name}>{w.name} — {w.openTasks}/{w.capacity} tasks ({w.status})</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold">Priority</span>
                <select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                  <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold">Target completion</span>
                <input type="date" className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" />
              </label>
            </div>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-semibold">Internal instructions</span>
              <textarea rows={2} className="w-full rounded-xl border border-input bg-background p-3 text-sm" />
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-semibold">Citizen-visible note</span>
              <textarea rows={2} className="w-full rounded-xl border border-input bg-background p-3 text-sm" />
            </label>
            <div className="mt-3 space-y-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="size-4" />Notify field worker</label>
              <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="size-4" />Notify citizen</label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setAssignFor(null)} className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-accent">Cancel</button>
              <button type="button" onClick={() => setAssignFor(null)} className="min-h-11 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">Confirm assignment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
