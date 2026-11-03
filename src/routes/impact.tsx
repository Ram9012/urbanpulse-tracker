import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/site-layout";
import { Counter, DemoDataNote, Section, Stat } from "@/components/site/primitives";
import { DEPARTMENTS, WEEKLY_VOLUME, RESOLUTION_TREND } from "@/lib/civic-data";

export const Route = createFileRoute("/impact")({
  head: () => ({
    meta: [
      { title: "Community Impact — CivicPulse Resolution Data" },
      {
        name: "description",
        content:
          "Track how many civic reports were submitted and resolved, department workload and average response times across the city.",
      },
      { property: "og:title", content: "Community Impact — CivicPulse Resolution Data" },
      {
        property: "og:description",
        content:
          "Transparent civic performance: resolution counts, department workload and response-time trends.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Impact,
});

function Bars() {
  const max = Math.max(...WEEKLY_VOLUME.map((w) => w.submitted));
  return (
    <div className="surface-card p-6">
      <h3 className="text-base font-bold">Weekly report volume</h3>
      <p className="text-xs text-muted-foreground">
        Submitted versus resolved, last six weeks (sample)
      </p>
      <ul className="mt-6 flex h-48 items-end gap-4">
        {WEEKLY_VOLUME.map((w) => (
          <li key={w.week} className="flex flex-1 flex-col items-center gap-2">
            <span className="flex h-full w-full items-end justify-center gap-1">
              <span
                className="w-1/3 rounded-t-md bg-primary transition-all duration-700"
                style={{ height: `${(w.submitted / max) * 100}%` }}
                title={`${w.submitted} submitted`}
              />
              <span
                className="w-1/3 rounded-t-md bg-teal transition-all duration-700"
                style={{ height: `${(w.resolved / max) * 100}%` }}
                title={`${w.resolved} resolved`}
              />
            </span>
            <span className="text-xs font-semibold text-muted-foreground">{w.week}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex gap-4 text-xs font-semibold text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded bg-primary" />
          Submitted
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded bg-teal" />
          Resolved
        </span>
      </p>
    </div>
  );
}

function Trend() {
  const max = Math.max(...RESOLUTION_TREND.map((r) => r.days));
  const points = RESOLUTION_TREND.map(
    (r, i) => `${(i / (RESOLUTION_TREND.length - 1)) * 100},${100 - (r.days / max) * 90}`,
  ).join(" ");
  return (
    <div className="surface-card p-6">
      <h3 className="text-base font-bold">Average resolution time</h3>
      <p className="text-xs text-muted-foreground">Days from submission to closure (sample)</p>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="mt-6 h-48 w-full"
        role="img"
        aria-label="Average resolution time trending down from 5.8 to 3.4 days"
      >
        <polyline
          points={points}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <p className="mt-4 text-sm font-semibold">5.8 → 3.4 days over six weeks</p>
    </div>
  );
}

function Impact() {
  return (
    <SiteLayout>
      <Section
        eyebrow="Impact"
        title="Transparent Numbers, Not Marketing Claims"
        description="These counters fill from live municipal records once departments are connected. Until then, everything below is clearly marked sample data."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { l: "reports submitted", v: 0 },
            { l: "issues resolved", v: 0 },
            { l: "departments connected", v: 0 },
            { l: "average response time (days)", v: 0 },
          ].map((m) => (
            <div key={m.l} className="surface-card p-6 text-center">
              <p className="font-display text-4xl font-extrabold">
                <Counter to={m.v} />
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{m.l}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-center">
          <DemoDataNote />
        </div>
      </Section>

      <Section
        className="bg-surface border-y border-border"
        align="left"
        title="Performance overview"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Bars />
          <Trend />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Stat label="Sample resolution rate" value="86%" hint="Resolved within target window" />
          <Stat
            label="Sample reopened reports"
            value="4.1%"
            hint="Citizens reopened after closure"
          />
          <Stat label="Sample duplicate rate" value="12%" hint="Detected before task creation" />
        </div>
      </Section>

      <Section
        align="left"
        title="Department workload"
        description="Open load, monthly resolutions and average turnaround per department (sample)."
      >
        <div className="surface-card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Department workload and performance</caption>
            <thead className="bg-muted text-left">
              <tr>
                <th scope="col" className="px-5 py-3 font-bold">
                  Department
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Open
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Resolved this month
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Avg days
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Field workers
                </th>
              </tr>
            </thead>
            <tbody>
              {DEPARTMENTS.map((d) => (
                <tr key={d.name} className="border-t border-border">
                  <td className="px-5 py-3 font-semibold">{d.name}</td>
                  <td className="px-5 py-3">{d.open}</td>
                  <td className="px-5 py-3">{d.resolvedMonth}</td>
                  <td className="px-5 py-3">{d.avgDays}</td>
                  <td className="px-5 py-3">{d.workers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-8">
          <Link
            to="/report"
            className="inline-flex min-h-12 items-center rounded-2xl bg-warm px-6 text-sm font-bold text-warm-foreground"
          >
            Add your report to the count
          </Link>
        </div>
      </Section>
    </SiteLayout>
  );
}
