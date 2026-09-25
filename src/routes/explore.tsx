import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/site/site-layout";
import { DemoDataNote, Section, StatusBadge, PriorityBadge } from "@/components/site/primitives";
import { ActivityMap } from "@/components/site/civic-map";
import { CATEGORIES, REPORTS, formatDate, CivicReport } from "@/lib/civic-data";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore Civic Reports Near You — CivicPulse" },
      {
        name: "description",
        content:
          "Browse public civic reports on a map, filter by category, status and date, and confirm an existing issue instead of filing a duplicate.",
      },
      { property: "og:title", content: "Explore Civic Reports Near You — CivicPulse" },
      {
        property: "og:description",
        content:
          "A public view of non-sensitive civic reports with map, filters and community confirmations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Explore,
});

function Explore() {
  const [reportsList, setReportsList] = useState<CivicReport[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("civicpulse_client_reports") || "[]");
        if (Array.isArray(stored) && stored.length > 0) {
          const map = new Map<string, CivicReport>();
          stored.forEach((r: CivicReport) => map.set(r.id, r));
          REPORTS.forEach((r: CivicReport) => {
            if (!map.has(r.id)) map.set(r.id, r);
          });
          return Array.from(map.values());
        }
      } catch {}
    }
    return REPORTS;
  });

  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  // Sync with live backend reports and client storage safely
  const fetchReports = async () => {
    let serverReports: CivicReport[] = [];
    try {
      const res = await fetch("/api/status/reports");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.reports)) {
          serverReports = data.reports;
        }
      }
    } catch {}

    let localReports: CivicReport[] = [];
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem("civicpulse_client_reports") || "[]");
        if (Array.isArray(stored)) {
          localReports = stored;
        }
      } catch {}
    }

    const map = new Map<string, CivicReport>();
    REPORTS.forEach((r) => map.set(r.id.toLowerCase(), r));
    serverReports.forEach((sr) => map.set(sr.id.toLowerCase(), sr));

    localReports.forEach((lr) => {
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
              resolutionMediaUrls: existing.resolutionMediaUrls?.length ? existing.resolutionMediaUrls : lr.resolutionMediaUrls,
              workerMediaUrls: existing.workerMediaUrls?.length ? existing.workerMediaUrls : lr.workerMediaUrls,
            });
          }
        }
      }
    });

    const merged = Array.from(map.values()).filter(
      (r) => !r.id.startsWith("CIV-104") && r.id !== "CIV-54728" && r.id !== "CIV-42603",
    );
    if (merged.length > 0) {
      setReportsList(merged);
    }
  };

  useEffect(() => {
    fetchReports();
    const handleUpdate = () => fetchReports();
    window.addEventListener("civicpulse_report_created", handleUpdate);
    window.addEventListener("civicpulse_report_updated", handleUpdate);
    window.addEventListener("civicpulse_report_deleted", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("civicpulse_report_created", handleUpdate);
      window.removeEventListener("civicpulse_report_updated", handleUpdate);
      window.removeEventListener("civicpulse_report_deleted", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const handleDeleteReport = async (reportId: string) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete report ${reportId} from the database and Supabase?`
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch("/api/reports/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId }),
      });

      // Remove from state immediately
      setReportsList((prev) => prev.filter((r) => r.id !== reportId));

      // Remove from localStorage
      if (typeof window !== "undefined") {
        try {
          const stored = JSON.parse(localStorage.getItem("civicpulse_client_reports") || "[]");
          const filtered = stored.filter((r: any) => r.id !== reportId);
          localStorage.setItem("civicpulse_client_reports", JSON.stringify(filtered));

          const queue = JSON.parse(localStorage.getItem("civic_reports_queue") || "[]");
          const filteredQueue = queue.filter((r: any) => r.id !== reportId);
          localStorage.setItem("civic_reports_queue", JSON.stringify(filteredQueue));

          window.dispatchEvent(new Event("civicpulse_report_deleted"));
        } catch {}
      }

      setDeleteNotice(`✓ Report ${reportId} permanently deleted from Supabase & system records.`);
      setTimeout(() => setDeleteNotice(null), 5000);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const list = reportsList.filter(
    (r) =>
      (category === "all" || r.category === category) &&
      (status === "all" || r.status === status) &&
      `${r.title} ${r.area} ${r.ward}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <SiteLayout>
      <Section
        eyebrow="Public explorer"
        title="Explore Reports in Your Area"
        description="Only non-sensitive reports appear here. Phone numbers, email addresses, exact home addresses, private media and internal staff notes are never published."
      >
        <ActivityMap />
      </Section>

      <Section className="bg-surface border-y border-border" align="left" title="Report list">
        {deleteNotice && (
          <div className="mb-4 rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-sm font-semibold text-destructive flex items-center justify-between">
            <span>{deleteNotice}</span>
            <button onClick={() => setDeleteNotice(null)} className="text-xs font-bold underline">✕</button>
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-end gap-3">
          <label className="min-w-56 flex-1">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Search</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by area, ward or issue"
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="all">All</option>
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
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="all">All</option>
              <option value="submitted">Submitted</option>
              <option value="verified">Verified</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
          <DemoDataNote className="ml-auto" />
        </div>

        {list.length === 0 ? (
          <div className="surface-card p-12 text-center">
            <p className="font-display text-lg font-bold">No results for these filters</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try a different area or clear the category and status filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setCategory("all");
                setStatus("all");
                setQuery("");
              }}
              className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((r) => (
              <li key={r.id} className="surface-card flex flex-col p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-muted-foreground">{r.id}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div
                  aria-hidden="true"
                  className="mt-3 h-32 rounded-xl border border-border civic-grid-bg topo-texture"
                />
                <h3 className="mt-4 text-base font-bold leading-snug">{r.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{r.description}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {r.area} · {r.ward} · reported {formatDate(r.createdAt)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PriorityBadge priority={r.priority} />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setConfirmed((c) => ({ ...c, [r.id]: !c[r.id] }))}
                    aria-pressed={!!confirmed[r.id]}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-bold transition-colors hover:bg-accent"
                  >
                    <span aria-hidden="true">▲</span>
                    {confirmed[r.id] ? "Confirmed" : "Confirm"} ({r.upvotes + (confirmed[r.id] ? 1 : 0)})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteReport(r.id)}
                    className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-destructive/40 bg-destructive/5 px-2.5 text-xs font-bold text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors shadow-sm"
                    title="Permanently delete this report from database & Supabase"
                  >
                    <span aria-hidden="true">🗑️</span> Delete
                  </button>
                  <Link
                    to="/reports/$id"
                    params={{ id: r.id }}
                    className="ml-auto text-xs font-bold text-primary hover:underline"
                  >
                    View details →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </SiteLayout>
  );
}
