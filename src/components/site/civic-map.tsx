import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { CATEGORIES, REPORTS, STATUS_META, type CivicReport } from "@/lib/civic-data";
import { StatusBadge } from "./primitives";

const CATEGORY_DOT: Record<string, string> = {
  roads: "bg-primary",
  electricity: "bg-warning",
  waste: "bg-teal",
  water: "bg-primary",
  safety: "bg-destructive",
  parks: "bg-success",
};

/** Illustrated street-grid stand-in for the live map provider. */
export function MapCanvas({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border bg-surface",
        className,
      )}
    >
      <div className="absolute inset-0 civic-grid-bg" aria-hidden="true" />
      <div className="absolute inset-0 topo-texture" aria-hidden="true" />
      <svg
        className="absolute inset-0 size-full text-primary/25"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0 34 H100" stroke="currentColor" strokeWidth="1.4" />
        <path d="M0 71 H100" stroke="currentColor" strokeWidth="1.1" />
        <path d="M22 0 V100" stroke="currentColor" strokeWidth="1.2" />
        <path d="M68 0 V100" stroke="currentColor" strokeWidth="1.4" />
        <path d="M0 8 C26 20 40 52 100 46" stroke="currentColor" strokeWidth="0.7" fill="none" />
        <path d="M0 92 C34 84 52 62 100 88" stroke="currentColor" strokeWidth="0.7" fill="none" />
      </svg>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-teal/20 to-transparent animate-civic-scan"
      />
      {children}
    </div>
  );
}

export function ReportMarker({
  report,
  active,
  onSelect,
}: {
  report: CivicReport;
  active?: boolean;
  onSelect: () => void;
}) {
  const isNew = report.status === "submitted";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${report.categoryLabel} at ${report.area} — ${STATUS_META[report.status].label}`}
      aria-pressed={active}
      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-2 transition-transform duration-200 hover:scale-110"
      style={{ left: `${report.x}%`, top: `${report.y}%` }}
    >
      <span className="relative flex size-4 items-center justify-center">
        {isNew && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute size-4 rounded-full animate-civic-pulse",
              CATEGORY_DOT[report.category],
            )}
          />
        )}
        <span
          aria-hidden="true"
          className={cn(
            "size-3.5 rounded-full ring-2 ring-surface",
            CATEGORY_DOT[report.category],
            active && "ring-4 ring-primary/40",
          )}
        />
      </span>
    </button>
  );
}

export function MapLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2">
      {CATEGORIES.map((c) => (
        <li key={c.id} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span aria-hidden="true" className={cn("size-2.5 rounded-full", CATEGORY_DOT[c.id])} />
          {c.name}
        </li>
      ))}
    </ul>
  );
}

export function MarkerPreviewCard({ report }: { report: CivicReport }) {
  return (
    <div className="surface-card w-full max-w-sm p-4 animate-rise-in">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{report.id}</p>
          <h3 className="mt-1 text-sm font-bold leading-snug">{report.title}</h3>
        </div>
        <StatusBadge status={report.status} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {report.area} · {report.ward} · {report.department}
      </p>
      <Link
        to="/reports/$id"
        params={{ id: report.id }}
        className="mt-3 inline-flex text-xs font-bold text-primary hover:underline"
      >
        View report details →
      </Link>
    </div>
  );
}

/** Filterable community activity map used on the homepage and explorer. */
export function ActivityMap({ compact = false }: { compact?: boolean }) {
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>("CIV-10482");

  const visible = REPORTS.filter(
    (r) =>
      (category === "all" || r.category === category) &&
      (status === "all" || r.status === status) &&
      (query.trim() === "" ||
        `${r.area} ${r.ward} ${r.title}`.toLowerCase().includes(query.toLowerCase())),
  );
  const active = visible.find((r) => r.id === selected) ?? visible[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              Search by area
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Ward 12 or Market Road"
              className="h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All statuses</option>
              {Object.entries(STATUS_META).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <MapCanvas className={compact ? "h-[320px]" : "h-[420px] md:h-[500px]"}>
          {visible.map((r) => (
            <ReportMarker
              key={r.id}
              report={r}
              active={active?.id === r.id}
              onSelect={() => setSelected(r.id)}
            />
          ))}
          {visible.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm font-semibold text-muted-foreground">
              No reports match these filters. Try a wider area or clear the category filter.
            </p>
          )}
        </MapCanvas>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <MapLegend />
          <p className="text-xs text-muted-foreground">
            Approximate locations only — exact addresses are never shown publicly.
          </p>
        </div>
      </div>

      <aside className="space-y-3">
        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          {visible.length} report{visible.length === 1 ? "" : "s"} in view
        </p>
        {active ? <MarkerPreviewCard report={active} /> : null}
        <ul className="space-y-2">
          {visible.slice(0, 5).map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelected(r.id)}
                className={cn(
                  "w-full rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/60",
                  active?.id === r.id && "border-primary/50 bg-accent/60",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold">{r.id}</span>
                  <StatusBadge status={r.status} />
                </span>
                <span className="mt-1 block text-sm font-semibold leading-snug">{r.title}</span>
                <span className="text-xs text-muted-foreground">{r.area}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
