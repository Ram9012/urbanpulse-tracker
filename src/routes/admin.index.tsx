import { createFileRoute } from "@tanstack/react-router";
import { Counter, Stat, StatusBadge } from "@/components/site/primitives";
import {
  DEPARTMENTS,
  FIELD_WORKERS,
  REPORTS,
  WEEKLY_VOLUME,
  formatDateTime,
} from "@/lib/civic-data";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Staff Overview — CivicPulse Municipal Dashboard" },
      {
        name: "description",
        content:
          "Today's civic report intake, verification queue, high-priority issues, department workload and resolution trends.",
      },
      { property: "og:title", content: "Staff Overview — CivicPulse Municipal Dashboard" },
      {
        property: "og:description",
        content: "Daily municipal operations overview for civic reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});

function Overview() {
  const max = Math.max(...WEEKLY_VOLUME.map((w) => w.submitted));
  return (
    <div>
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Review incoming reports, assign responsibility, and keep citizens informed.
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="New reports today" value={<Counter to={38} />} hint="Across all wards" />
        <Stat
          label="Awaiting verification"
          value={<Counter to={12} />}
          hint="Older than 4 hours: 3"
        />
        <Stat label="High priority open" value={<Counter to={9} />} hint="2 marked critical" />
        <Stat label="In progress" value={<Counter to={64} />} hint="Field work underway" />
        <Stat
          label="Resolved this month"
          value={<Counter to={912} />}
          hint="Across 7 departments"
        />
        <Stat
          label="Avg resolution time"
          value={
            <>
              <Counter to={3.4} decimals={1} /> days
            </>
          }
          hint="Down from 5.8"
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <section className="surface-card p-5">
          <h2 className="text-sm font-bold">Weekly report volume</h2>
          <ul className="mt-5 flex h-40 items-end gap-3">
            {WEEKLY_VOLUME.map((w) => (
              <li key={w.week} className="flex flex-1 flex-col items-center gap-2">
                <span className="flex h-full w-full items-end justify-center gap-1">
                  <span
                    className="w-1/3 rounded-t bg-primary"
                    style={{ height: `${(w.submitted / max) * 100}%` }}
                    title={`${w.submitted} submitted`}
                  />
                  <span
                    className="w-1/3 rounded-t bg-teal"
                    style={{ height: `${(w.resolved / max) * 100}%` }}
                    title={`${w.resolved} resolved`}
                  />
                </span>
                <span className="text-xs text-muted-foreground">{w.week}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-card p-5">
          <h2 className="text-sm font-bold">Department workload</h2>
          <ul className="mt-4 space-y-3">
            {DEPARTMENTS.map((d) => (
              <li key={d.name}>
                <p className="flex justify-between text-sm font-semibold">
                  <span>{d.name}</span>
                  <span className="text-muted-foreground">{d.open} open</span>
                </p>
                <span aria-hidden="true" className="mt-1 block h-2 rounded-full bg-muted">
                  <span
                    className="block h-2 rounded-full bg-primary"
                    style={{ width: `${Math.min(100, (d.open / 200) * 100)}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-card p-5">
          <h2 className="text-sm font-bold">Geographic hotspots</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {[
              ["Ward 12 · Bus Stand Road", "24 reports · roads"],
              ["Ward 7 · Old Market Road", "19 reports · waste"],
              ["Ward 9 · Katihalli Junction", "16 reports · drainage"],
            ].map(([a, b]) => (
              <li
                key={a}
                className="flex items-center justify-between rounded-xl border border-border p-3"
              >
                <span className="font-semibold">{a}</span>
                <span className="text-muted-foreground">{b}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-card p-5">
          <h2 className="text-sm font-bold">Field worker availability</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {FIELD_WORKERS.map((w) => (
              <li
                key={w.name}
                className="flex items-center justify-between rounded-xl border border-border p-3"
              >
                <span>
                  <span className="block font-semibold">{w.name}</span>
                  <span className="text-xs text-muted-foreground">{w.department}</span>
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {w.openTasks}/{w.capacity} tasks · {w.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="surface-card mt-6 p-5">
        <h2 className="text-sm font-bold">Recent activity</h2>
        <ul className="mt-3 space-y-2">
          {REPORTS.slice(0, 5).map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3 text-sm"
            >
              <span className="font-bold">{r.id}</span>
              <span className="min-w-0 flex-1 truncate">{r.title}</span>
              <StatusBadge status={r.status} />
              <span className="text-xs text-muted-foreground">{formatDateTime(r.updatedAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
