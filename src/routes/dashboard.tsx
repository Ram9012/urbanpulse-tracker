import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteLayout } from "@/components/site/site-layout";
import { DemoDataNote, PriorityBadge, Section, Stat, StatusBadge } from "@/components/site/primitives";
import { ActivityMap } from "@/components/site/civic-map";
import { NOTIFICATIONS, REPORTS, formatDate } from "@/lib/civic-data";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My Reports Dashboard — CivicPulse" },
      {
        name: "description",
        content:
          "Track your submitted civic reports, see active and resolved issues, saved locations and the latest municipal updates.",
      },
      { property: "og:title", content: "My Reports Dashboard — CivicPulse" },
      { property: "og:description", content: "Your civic reports, statuses and notifications in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [view, setView] = useState<"list" | "map">("list");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const mine = REPORTS.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      `${r.id} ${r.title} ${r.area}`.toLowerCase().includes(query.toLowerCase()),
  );
  const active = REPORTS.filter((r) => r.status !== "resolved").length;
  const resolved = REPORTS.filter((r) => r.status === "resolved").length;

  return (
    <SiteLayout>
      <Section align="left" eyebrow="Citizen dashboard" title="Welcome back, Anitha">
        <div className="flex flex-wrap items-center gap-3">
          <DemoDataNote />
          <Link
            to="/report"
            className="ml-auto inline-flex min-h-11 items-center rounded-xl bg-warm px-5 text-sm font-bold text-warm-foreground"
          >
            Quick report
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Reports submitted" value={REPORTS.length} hint="Since you joined" />
          <Stat label="Active reports" value={active} hint="Being verified or worked on" />
          <Stat label="Resolved" value={resolved} hint="Closed with resolution media" />
          <Stat label="Saved locations" value={3} hint="Home, work, school route" />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <label className="min-w-48 flex-1">
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Search my reports</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Report ID, issue or area"
                  className="h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="h-11 rounded-xl border border-input bg-surface px-3 text-sm"
                >
                  <option value="all">All</option>
                  <option value="submitted">Submitted</option>
                  <option value="verified">Verified</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In progress</option>
                  <option value="resolved">Resolved</option>
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
              <div className="surface-card p-12 text-center">
                <p className="font-display text-lg font-bold">No reports match your filters</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Clear the filters, or submit your first report for this area.
                </p>
                <Link
                  to="/report"
                  className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground"
                >
                  Report an issue
                </Link>
              </div>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {mine.map((r) => (
                  <li key={r.id} className="surface-card p-5 transition-shadow hover:shadow-lift">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-muted-foreground">{r.id}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div aria-hidden="true" className="mt-3 h-24 rounded-xl border border-border civic-grid-bg topo-texture" />
                    <h3 className="mt-3 text-sm font-bold leading-snug">{r.title}</h3>
                    <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <div className="flex gap-1"><dt className="font-semibold">Category:</dt><dd>{r.categoryLabel}</dd></div>
                      <div className="flex gap-1"><dt className="font-semibold">Location:</dt><dd>{r.area}, {r.ward}</dd></div>
                      <div className="flex gap-1"><dt className="font-semibold">Submitted:</dt><dd>{formatDate(r.createdAt)}</dd></div>
                      <div className="flex gap-1"><dt className="font-semibold">Department:</dt><dd>{r.department}</dd></div>
                      <div className="flex gap-1"><dt className="font-semibold">Last update:</dt><dd>{formatDate(r.updatedAt)}</dd></div>
                    </dl>
                    <div className="mt-3"><PriorityBadge priority={r.priority} /></div>
                    <Link
                      to="/reports/$id"
                      params={{ id: r.id }}
                      className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border text-sm font-bold hover:bg-accent"
                    >
                      View details
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <aside className="space-y-4">
            <div className="surface-card p-5">
              <h2 className="text-sm font-bold">Recent notifications</h2>
              <ul className="mt-3 space-y-3">
                {NOTIFICATIONS.map((n) => (
                  <li key={n.id} className="flex gap-2 text-sm">
                    <span aria-hidden="true" className={n.unread ? "text-primary" : "text-muted-foreground"}>●</span>
                    <span>
                      <span className="block leading-snug">{n.text}</span>
                      <span className="text-xs text-muted-foreground">{n.time}{n.unread ? " · unread" : ""}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="surface-card p-5">
              <h2 className="text-sm font-bold">Saved locations</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Home · Vidyanagar 3rd Cross</li>
                <li>Work · Old Market Road</li>
                <li>School route · Ward 12</li>
              </ul>
            </div>
            <div className="surface-card p-5">
              <h2 className="text-sm font-bold">Notification preferences</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {["In-app updates", "Email updates", "SMS updates"].map((p, i) => (
                  <li key={p} className="flex items-center justify-between gap-2">
                    <span>{p}</span>
                    <input type="checkbox" defaultChecked={i < 2} className="size-4" aria-label={p} />
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </Section>
    </SiteLayout>
  );
}
