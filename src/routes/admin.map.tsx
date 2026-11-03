import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MapCanvas, MapLegend, ReportMarker } from "@/components/site/civic-map";
import { DemoDataNote, PriorityBadge, StatusBadge } from "@/components/site/primitives";
import { REPORTS, formatDateTime, getDeletedReportIds } from "@/lib/civic-data";

export const Route = createFileRoute("/admin/map")({
  head: () => ({
    meta: [
      { title: "Municipal Map View — CivicPulse Staff" },
      {
        name: "description",
        content:
          "Clustered civic report markers, hotspots and ward layers with a side panel for classification and assignment.",
      },
      { property: "og:title", content: "Municipal Map View — CivicPulse Staff" },
      { property: "og:description", content: "Geographic view of civic reports for municipal teams." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminMap,
});

function AdminMap() {
  const deleted = getDeletedReportIds();
  const availableReports = REPORTS.filter((r) => !deleted.has(r.id.toLowerCase()));
  const [selected, setSelected] = useState(availableReports[0]?.id || REPORTS[0]?.id || "");
  const active = availableReports.find((r) => r.id === selected) || availableReports[0] || REPORTS[0]!;

  return (
    <div>
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Map view</h1>
          <p className="text-sm text-muted-foreground">
            Select a marker to review the report, its AI classification and assignment options.
          </p>
        </div>
        <DemoDataNote className="ml-auto" />
      </header>

      <div className="mt-5 flex flex-wrap gap-2">
        {["Clusters", "Heatmap", "Ward boundaries", "Department zones", "Satellite"].map((l, i) => (
          <label key={l} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-semibold">
            <input type="checkbox" defaultChecked={i < 2} className="size-4" />
            {l}
          </label>
        ))}
        <button type="button" className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-accent">
          Export map data
        </button>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_380px]">
        <div>
          <MapCanvas className="h-[420px] xl:h-[620px]">
            {availableReports.map((r) => (
              <ReportMarker key={r.id} report={r} active={r.id === selected} onSelect={() => setSelected(r.id)} />
            ))}
          </MapCanvas>
          <div className="mt-3"><MapLegend /></div>
        </div>

        <aside className="surface-card h-fit p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-muted-foreground">{active.id}</span>
            <StatusBadge status={active.status} />
          </div>
          <div aria-hidden="true" className="mt-3 h-32 rounded-xl border border-border civic-grid-bg topo-texture" />
          <h2 className="mt-3 text-base font-bold">{active.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {active.area} · {active.ward} · updated {formatDateTime(active.updatedAt)}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">{active.description}</p>
          <div className="mt-3"><PriorityBadge priority={active.priority} /></div>

          <div className="mt-4 rounded-xl bg-mint p-3 text-sm text-mint-foreground">
            <p className="font-bold">AI classification (review required)</p>
            <ul className="mt-2 space-y-1">
              <li>Predicted category: {active.categoryLabel}</li>
              <li>Confidence: {Math.round(active.aiConfidence * 100)}%</li>
              <li>Suggested department: {active.department}</li>
              <li>Duplicate probability: {Math.round(active.duplicateProbability * 100)}%</li>
            </ul>
          </div>

          <div className="mt-4 grid gap-2">
            <button type="button" className="min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">
              Approve and assign
            </button>
            <button type="button" className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-accent">
              Edit classification
            </button>
            <button type="button" className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-accent">
              Mark as duplicate
            </button>
            <Link to="/reports/$id" params={{ id: active.id }} className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold leading-[2.75rem] text-center hover:bg-accent">
              Open full report
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
