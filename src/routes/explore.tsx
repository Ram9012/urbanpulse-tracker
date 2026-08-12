import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteLayout } from "@/components/site/site-layout";
import { DemoDataNote, Section, StatusBadge, PriorityBadge } from "@/components/site/primitives";
import { ActivityMap } from "@/components/site/civic-map";
import { CATEGORIES, REPORTS, formatDate } from "@/lib/civic-data";

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
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");

  const list = REPORTS.filter(
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
                <div className="mt-4 flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setConfirmed((c) => ({ ...c, [r.id]: !c[r.id] }))}
                    aria-pressed={!!confirmed[r.id]}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-bold transition-colors hover:bg-accent"
                  >
                    <span aria-hidden="true">▲</span>
                    {confirmed[r.id] ? "Confirmed" : "Confirm"} ({r.upvotes + (confirmed[r.id] ? 1 : 0)})
                  </button>
                  <Link
                    to="/reports/$id"
                    params={{ id: r.id }}
                    className="ml-auto text-sm font-bold text-primary hover:underline"
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
