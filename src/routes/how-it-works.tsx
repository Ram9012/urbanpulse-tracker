import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/site-layout";
import { Section, Reveal } from "@/components/site/primitives";
import { ROUTING_RULES, TIMELINE_STEPS } from "@/lib/civic-data";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How CivicPulse Works — From Report to Resolution" },
      {
        name: "description",
        content:
          "Understand how a civic report moves from capture to resolution: media, location, AI-assisted routing, department assignment and citizen updates.",
      },
      { property: "og:title", content: "How CivicPulse Works — From Report to Resolution" },
      {
        property: "og:description",
        content:
          "Capture, connect and resolve: the complete CivicPulse workflow for citizens and municipal departments.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HowItWorks,
});

function HowItWorks() {
  return (
    <SiteLayout>
      <Section
        eyebrow="How it works"
        title="From Report to Resolution"
        description="Reporting takes under a minute. Everything after that is designed to keep both citizens and departments informed."
      >
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              t: "Capture",
              d: "Take a photo or video. Your location is captured automatically and you can nudge the map marker if the detected point is slightly off.",
              points: [
                "Camera or gallery upload",
                "GPS location with accuracy reading",
                "Works offline and syncs later",
              ],
            },
            {
              t: "Connect",
              d: "Add a short text or voice description. The classifier suggests a category, priority and department — you can edit all of it.",
              points: [
                "Voice to text in English, Kannada, Hindi",
                "AI category suggestion with confidence",
                "Duplicate check before submission",
              ],
            },
            {
              t: "Resolve",
              d: "Your report gets a tracking ID. Every status change is logged and you are notified until the work is closed.",
              points: [
                "Unique tracking ID",
                "Status timeline",
                "Before-and-after resolution media",
              ],
            },
          ].map((s, i) => (
            <Reveal key={s.t} delay={i * 100}>
              <article className="surface-card h-full p-6">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary font-display font-extrabold text-primary-foreground">
                  {i + 1}
                </span>
                <h2 className="mt-4 text-xl font-bold">{s.t}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {s.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span aria-hidden="true" className="text-teal">
                        ✓
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section
        className="bg-surface border-y border-border"
        eyebrow="Status stages"
        title="Seven Stages, No Guesswork"
        align="left"
      >
        <ol className="grid gap-3 md:grid-cols-2">
          {TIMELINE_STEPS.map((s, i) => (
            <li
              key={s.key}
              className="flex gap-4 rounded-2xl border border-border bg-background p-4"
            >
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-mint text-xs font-bold text-mint-foreground">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-bold">{s.label}</p>
                <p className="text-sm text-muted-foreground">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        eyebrow="Routing rules"
        title="Where Your Report Goes"
        description="Administrators can edit this routing table, so reports always reach the department that owns the work."
        align="left"
      >
        <div className="surface-card overflow-hidden">
          <table className="w-full text-sm">
            <caption className="sr-only">Default issue-to-department routing rules</caption>
            <thead className="bg-muted text-left">
              <tr>
                <th scope="col" className="px-5 py-3 font-bold">
                  Issue type
                </th>
                <th scope="col" className="px-5 py-3 font-bold">
                  Responsible department
                </th>
              </tr>
            </thead>
            <tbody>
              {ROUTING_RULES.map((r) => (
                <tr key={r.issue} className="border-t border-border">
                  <td className="px-5 py-3 font-semibold">{r.issue}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.department}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          AI recommendations are always reviewed by a person before any task is assigned. Staff can
          approve, edit or reject every suggestion.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/report"
            className="inline-flex min-h-12 items-center rounded-2xl bg-warm px-6 text-sm font-bold text-warm-foreground"
          >
            Report an Issue
          </Link>
          <Link
            to="/explore"
            className="inline-flex min-h-12 items-center rounded-2xl border border-border bg-surface px-6 text-sm font-bold hover:bg-accent"
          >
            Explore reports near me
          </Link>
        </div>
      </Section>
    </SiteLayout>
  );
}
