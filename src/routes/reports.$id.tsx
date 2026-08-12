import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/site-layout";
import { PriorityBadge, Section, StatusBadge } from "@/components/site/primitives";
import { REPORTS, TIMELINE_STEPS, formatDateTime, getReport } from "@/lib/civic-data";

export const Route = createFileRoute("/reports/$id")({
  loader: ({ params }) => {
    const report = getReport(params.id);
    if (!report) throw notFound();
    return { report };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Report unavailable — CivicPulse" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { report } = loaderData;
    const description = `${report.categoryLabel} in ${report.area}, ${report.ward}. Current status: ${report.status.replace("_", " ")}. Handled by ${report.department}.`;
    return {
      meta: [
        { title: `${report.id} — ${report.title} | CivicPulse` },
        { name: "description", content: description },
        { property: "og:title", content: `${report.id} — ${report.title}` },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  notFoundComponent: ReportNotFound,
  errorComponent: ReportError,
  component: ReportDetails,
});

function ReportNotFound() {
  return (
    <SiteLayout>
      <Section align="center" title="We could not find that report">
        <p className="text-center text-muted-foreground">
          Check the tracking ID — it looks like CIV-10482.
        </p>
        <div className="mt-6 text-center">
          <Link to="/explore" className="inline-flex min-h-12 items-center rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground">
            Browse public reports
          </Link>
        </div>
      </Section>
    </SiteLayout>
  );
}

function ReportError() {
  return (
    <SiteLayout>
      <Section align="center" title="This report did not load">
        <p className="text-center text-muted-foreground">
          Something went wrong on our side. Please refresh, or try again in a moment.
        </p>
      </Section>
    </SiteLayout>
  );
}

function ReportDetails() {
  const { report } = Route.useLoaderData();
  const stageIndex = { submitted: 0, verified: 1, assigned: 3, in_progress: 4, resolved: 6, duplicate: 1 }[
    report.status
  ];
  const related = REPORTS.filter((r) => r.id !== report.id && r.category === report.category).slice(0, 2);

  return (
    <SiteLayout>
      <Section align="left" eyebrow={report.id} title={report.title}>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={report.status} />
          <PriorityBadge priority={report.priority} />
          <span className="text-sm text-muted-foreground">
            {report.area} · {report.ward} · approximate location only
          </span>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <div className="surface-card p-5">
              <h2 className="text-sm font-bold">Media</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {["Reported photo", "Progress photo", "After resolution"].map((label) => (
                  <figure key={label}>
                    <span aria-hidden="true" className="block h-28 rounded-xl border border-border civic-grid-bg topo-texture" />
                    <figcaption className="mt-2 text-xs text-muted-foreground">{label} (sample placeholder)</figcaption>
                  </figure>
                ))}
              </div>
            </div>

            <div className="surface-card p-5">
              <h2 className="text-sm font-bold">Description</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{report.description}</p>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
                <div><dt className="text-xs font-bold text-muted-foreground uppercase">Category</dt><dd className="font-semibold">{report.categoryLabel}</dd></div>
                <div><dt className="text-xs font-bold text-muted-foreground uppercase">Department</dt><dd className="font-semibold">{report.department}</dd></div>
                <div><dt className="text-xs font-bold text-muted-foreground uppercase">Assigned worker</dt><dd className="font-semibold">{report.worker ?? "Not assigned yet"}</dd></div>
                <div><dt className="text-xs font-bold text-muted-foreground uppercase">Last update</dt><dd className="font-semibold">{formatDateTime(report.updatedAt)}</dd></div>
              </dl>
            </div>

            <div className="surface-card p-5">
              <h2 className="text-sm font-bold">Status timeline</h2>
              <ol className="mt-4 space-y-3">
                {TIMELINE_STEPS.map((s, i) => {
                  const done = i <= stageIndex;
                  return (
                    <li key={s.key} className="flex gap-3">
                      <span
                        aria-hidden="true"
                        className={
                          "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold " +
                          (done ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")
                        }
                      >
                        {done ? "✓" : i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-bold">
                          {s.label}
                          <span className="ml-2 text-xs font-semibold text-muted-foreground">
                            {done ? "Completed" : "Pending"}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">{s.detail}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="surface-card p-5">
              <h2 className="text-sm font-bold">Staff updates</h2>
              <ul className="mt-3 space-y-3 text-sm">
                <li className="rounded-xl border border-border p-3">
                  <p className="font-semibold">{report.department}</p>
                  <p className="text-muted-foreground">
                    Site inspected and material requested. Work scheduled with the field team.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(report.updatedAt)}</p>
                </li>
              </ul>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="surface-card p-5">
              <h2 className="text-sm font-bold">Location</h2>
              <div aria-hidden="true" className="mt-3 h-40 rounded-xl border border-border civic-grid-bg topo-texture" />
              <p className="mt-2 text-xs text-muted-foreground">
                Shown to the nearest street for privacy. Exact coordinates are visible only to assigned staff.
              </p>
            </div>
            <div className="surface-card p-5">
              <h2 className="text-sm font-bold">Notifications</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {["In-app", "Email", "SMS"].map((c, i) => (
                  <li key={c} className="flex items-center justify-between">
                    <span>{c} updates</span>
                    <input type="checkbox" defaultChecked={i < 2} className="size-4" aria-label={`${c} updates`} />
                  </li>
                ))}
              </ul>
            </div>
            <div className="surface-card p-5">
              <h2 className="text-sm font-bold">Something wrong?</h2>
              <button type="button" className="mt-3 min-h-11 w-full rounded-xl border border-border text-sm font-bold hover:bg-accent">
                Report duplicate
              </button>
              <button type="button" className="mt-2 min-h-11 w-full rounded-xl border border-destructive/40 text-sm font-bold text-destructive hover:bg-destructive/10">
                Flag unsafe content
              </button>
            </div>
            {related.length > 0 && (
              <div className="surface-card p-5">
                <h2 className="text-sm font-bold">Nearby similar reports</h2>
                <ul className="mt-3 space-y-2">
                  {related.map((r) => (
                    <li key={r.id}>
                      <Link to="/reports/$id" params={{ id: r.id }} className="text-sm font-semibold text-primary hover:underline">
                        {r.id} — {r.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </Section>
    </SiteLayout>
  );
}
