import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  BRAND,
  CATEGORIES,
  TESTIMONIALS,
  TIMELINE_STEPS,
  LANGUAGES,
  mockClassify,
} from "@/lib/civic-data";
import { SiteLayout } from "@/components/site/site-layout";
import { Counter, DemoDataNote, Reveal, Section, StatusBadge } from "@/components/site/primitives";
import { ActivityMap, MapCanvas } from "@/components/site/civic-map";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CivicPulse — Report Civic Issues and Track Resolutions" },
      {
        name: "description",
        content:
          "Report potholes, garbage, streetlight failures, drainage problems and other civic issues. Track your report and stay informed until it is resolved.",
      },
      { property: "og:title", content: "CivicPulse — Report Civic Issues and Track Resolutions" },
      {
        property: "og:description",
        content:
          "See a problem. Report it. Track the solution. CivicPulse routes citizen reports to the right municipal department and keeps you updated.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "GovernmentService",
          name: "CivicPulse civic issue reporting",
          serviceType: "Municipal issue reporting and resolution tracking",
          areaServed: BRAND.city,
          provider: { "@type": "Organization", name: BRAND.name, email: BRAND.email },
        }),
      },
    ],
  }),
  component: Home,
});

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-surface">
      <div aria-hidden="true" className="absolute inset-0 civic-grid-bg opacity-60" />
      <div
        aria-hidden="true"
        className="absolute -top-32 -left-24 size-[26rem] rounded-full bg-primary/15 blur-3xl animate-orb-drift"
      />
      <div
        aria-hidden="true"
        className="absolute -right-24 top-24 size-[22rem] rounded-full bg-teal/15 blur-3xl animate-orb-drift"
        style={{ animationDelay: "-6s" }}
      />
      <div className="container-page relative grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1.5 text-xs font-bold text-mint-foreground">
            <span aria-hidden="true">◆</span> {BRAND.tagline}
          </p>
          <h1 className="mt-5 text-4xl leading-[1.05] font-extrabold text-balance md:text-6xl">
            Make Your City Better,{" "}
            <span className="text-gradient-civic">One Report at a Time.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Report potholes, broken streetlights, overflowing waste, drainage problems and other
            civic issues. Our intelligent platform connects your report to the right municipal team
            and keeps you informed until it is resolved.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/report"
              className="inline-flex min-h-12 items-center rounded-2xl bg-warm px-6 text-sm font-bold text-warm-foreground shadow-glow transition-transform hover:-translate-y-0.5"
            >
              Report an Issue
            </Link>
            <Link
              to="/how-it-works"
              className="inline-flex min-h-12 items-center rounded-2xl border border-border bg-surface px-6 text-sm font-bold transition-colors hover:bg-accent"
            >
              Explore How It Works
            </Link>
          </div>
          <p className="mt-5 max-w-md text-sm text-muted-foreground">
            No complicated forms. No unanswered complaints. Just clear updates from report to
            resolution.
          </p>
        </div>

        <div className="relative">
          <MapCanvas className="h-[380px] shadow-lift md:h-[460px]">
            <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" aria-hidden="true">
              <path
                d="M28 44 C42 40 52 30 72 26"
                className="animate-dash-flow"
                stroke="var(--color-primary)"
                strokeWidth="0.6"
                fill="none"
              />
              <path
                d="M28 44 C34 58 46 66 68 70"
                className="animate-dash-flow"
                stroke="var(--color-teal)"
                strokeWidth="0.6"
                fill="none"
              />
            </svg>
            {[
              { x: 28, y: 44, tone: "bg-primary" },
              { x: 72, y: 26, tone: "bg-teal" },
              { x: 68, y: 70, tone: "bg-warning" },
              { x: 46, y: 20, tone: "bg-success" },
              { x: 18, y: 74, tone: "bg-destructive" },
            ].map((p) => (
              <span
                key={`${p.x}-${p.y}`}
                aria-hidden="true"
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
              >
                <span className="relative flex size-3.5 items-center justify-center">
                  <span
                    className={`absolute size-3.5 rounded-full animate-civic-pulse ${p.tone}`}
                  />
                  <span className={`size-3 rounded-full ring-2 ring-surface ${p.tone}`} />
                </span>
              </span>
            ))}

            <div className="absolute bottom-4 left-4 right-4 surface-card p-4 md:right-auto md:w-72">
              <p className="text-xs font-semibold text-muted-foreground">Live sample report</p>
              <h2 className="mt-1 text-sm font-bold">Issue: Road damage</h2>
              <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
                <div className="flex gap-1">
                  <dt className="font-semibold">Location:</dt>
                  <dd>{BRAND.city}</dd>
                </div>
                <div className="flex gap-1">
                  <dt className="font-semibold">Status:</dt>
                  <dd>Assigned to Roads Department</dd>
                </div>
                <div className="flex gap-1">
                  <dt className="font-semibold">Priority:</dt>
                  <dd>Medium</dd>
                </div>
              </dl>
            </div>
          </MapCanvas>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "issues resolved", value: 1248 },
              { label: "citizen satisfaction", value: 92, suffix: "%" },
              { label: "active departments", value: 18 },
            ].map((m) => (
              <div key={m.label} className="surface-card p-3 text-center">
                <p className="font-display text-xl font-extrabold">
                  <Counter to={m.value} suffix={m.suffix ?? ""} />
                </p>
                <p className="text-[11px] leading-tight text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-center">
            <DemoDataNote />
          </div>
        </div>
      </div>
    </section>
  );
}

function ReportingPreview() {
  const [listening, setListening] = useState<"idle" | "listening" | "done">("idle");
  const [text, setText] = useState("");
  const transcript = "There is a large pothole near the bus stop.";
  const ai = mockClassify(listening === "done" ? transcript : text || transcript);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="surface-card p-6">
        <h3 className="text-lg font-bold">Report an issue</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a photo, confirm your location, and tell us what needs attention.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {["Use camera", "Upload photo", "Upload video"].map((l) => (
            <button
              key={l}
              type="button"
              className="min-h-11 rounded-xl border border-dashed border-input bg-background px-3 text-sm font-semibold transition-colors hover:border-primary/50 hover:bg-accent"
            >
              {l}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-border bg-background p-4">
          <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            Location
          </p>
          <p className="mt-1 text-sm font-semibold">Bus Stand Road, Ward 12 · {BRAND.city}</p>
          <p className="text-xs text-muted-foreground">
            Detected automatically · accuracy ±8 m · adjust the marker if needed
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold">Issue category</span>
            <select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
              {CATEGORIES.map((c) => (
                <option key={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold">Language</span>
            <select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-semibold">Short description</span>
          <textarea
            rows={3}
            value={listening === "done" ? transcript : text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe what you see and why it needs attention."
            className="w-full rounded-xl border border-input bg-background p-3 text-sm"
          />
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() =>
              setListening((s) => {
                if (s === "listening") return "done";
                return "listening";
              })
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:brightness-110"
            aria-live="polite"
          >
            <span aria-hidden="true">🎙</span>
            {listening === "listening" ? "Listening…" : "Record voice description"}
          </button>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 rounded border-input" />
            Report anonymously
          </label>
        </div>

        {listening !== "idle" && (
          <p className="mt-3 rounded-xl bg-mint p-3 text-sm text-mint-foreground">
            {listening === "listening"
              ? "Listening… speak in English, Kannada or Hindi."
              : `Voice converted to text: “${transcript}”`}
          </p>
        )}

        <Link
          to="/report"
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-warm text-sm font-bold text-warm-foreground"
        >
          Submit report
        </Link>
      </div>

      <div className="surface-card bg-navy p-6 text-navy-foreground">
        <p className="text-xs font-bold tracking-[0.16em] uppercase opacity-70">
          AI assistance (review required)
        </p>
        <h3 className="mt-2 text-lg font-bold">
          AI suggestion: {ai.categoryLabel} — {Math.round(ai.confidence * 100)}% confidence
        </h3>
        <dl className="mt-5 space-y-4 text-sm">
          {[
            ["Suggested department", ai.department],
            ["Suggested priority", ai.priority],
            ["Extracted keywords", ai.keywords.join(", ")],
            ["Possible duplicates", "2 reports within 50 metres"],
            ["Suggested summary", ai.summary],
            ["Why this recommendation", ai.reason],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-navy-foreground/8 p-3">
              <dt className="text-xs font-semibold opacity-70">{k}</dt>
              <dd className="mt-1 font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 text-xs leading-relaxed opacity-75">
          AI predictions are suggestions, not decisions. You can always edit the category and
          description before submitting, and municipal staff review every recommendation before any
          work is assigned.
        </p>
      </div>
    </div>
  );
}

function Home() {
  return (
    <SiteLayout>
      <Hero />

      <Section
        id="activity"
        eyebrow="Live activity"
        title="See Your Community Taking Action"
        description="Browse civic reports around you, filter by category and status, and confirm an existing issue instead of creating a duplicate."
      >
        <Reveal>
          <ActivityMap />
        </Reveal>
      </Section>

      <Section
        className="bg-surface border-y border-border"
        eyebrow="Categories"
        title="Report What Needs Attention"
        description="Pick the category that fits best — our classifier will confirm it and route the report to the responsible department."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c, i) => (
            <Reveal key={c.id} delay={i * 60}>
              <Link
                to="/report"
                className="group block h-full rounded-2xl border border-border bg-background p-6 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift"
              >
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-mint text-mint-foreground transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-3">
                  <svg
                    viewBox="0 0 24 24"
                    className="size-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path
                      d="M4 18h16M6 14l4-6 4 4 4-6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <h3 className="mt-4 text-base font-bold">{c.name}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {c.description}
                </p>
                <p className="mt-4 text-xs font-semibold text-muted-foreground">
                  {c.active} active reports (sample) · {c.department}
                </p>
                <span className="mt-3 inline-flex text-sm font-bold text-primary">
                  Report now →
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Workflow"
        title="From Report to Resolution"
        description="Three steps for citizens, one connected pipeline for municipal teams."
      >
        <ol className="relative grid gap-6 md:grid-cols-3">
          <span
            aria-hidden="true"
            className="absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r from-primary/20 via-primary/60 to-teal/40 md:block"
          />
          {[
            {
              t: "Capture",
              d: "Take a photo or video and let the platform capture your location automatically.",
            },
            {
              t: "Connect",
              d: "Add a short text or voice description. AI helps identify the issue and route it to the correct department.",
            },
            {
              t: "Resolve",
              d: "Track progress, receive updates, and see the final resolution.",
            },
          ].map((s, i) => (
            <Reveal key={s.t} delay={i * 120}>
              <li className="surface-card relative h-full p-6">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary font-display text-sm font-extrabold text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-bold">
                  Step {i + 1}: {s.t}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </Section>

      <Section
        className="bg-surface border-y border-border"
        eyebrow="Product preview"
        title="A Report Takes Less Than a Minute"
        description="This is the actual reporting experience — media, location, description, voice input and AI assistance you stay in control of."
      >
        <Reveal>
          <ReportingPreview />
        </Reveal>
      </Section>

      <Section
        eyebrow="Trust & transparency"
        title="Every Report Deserves a Clear Response"
        description="You always know which stage your report is in and who is responsible for it."
      >
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <ol className="space-y-3">
            {TIMELINE_STEPS.map((s, i) => (
              <Reveal key={s.key} delay={i * 60}>
                <li className="flex gap-4 rounded-2xl border border-border bg-surface p-4">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-mint text-xs font-bold text-mint-foreground">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold">{s.label}</p>
                    <p className="text-sm text-muted-foreground">{s.detail}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
          <div className="surface-card h-fit p-6">
            <h3 className="text-lg font-bold">Your privacy</h3>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {[
                "Location is used only to process and route your report.",
                "Personal information is never shown on public pages.",
                "You control whether your name appears on a report.",
                "Uploaded media is stored securely with restricted access.",
                "Staff access is role-based and every action is logged.",
                "Sensitive reports are excluded from the public explorer.",
              ].map((p) => (
                <li key={p} className="flex gap-2">
                  <span aria-hidden="true" className="text-success">
                    ✓
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section
        className="bg-surface border-y border-border"
        eyebrow="Impact"
        title="Measured, Not Claimed"
        description="Counters start at zero and fill from real municipal data once a city connects its departments."
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
        <Reveal className="mt-10">
          <BeforeAfter />
        </Reveal>
      </Section>

      <Section eyebrow="Citizen voices" title="What Residents Say">
        <div className="grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 80}>
              <figure className="surface-card h-full p-6">
                <p aria-label={`${t.rating} out of 5`} className="text-sm text-warning-foreground">
                  {"★".repeat(t.rating)}
                  <span className="text-muted-foreground">{"★".repeat(5 - t.rating)}</span>
                </p>
                <blockquote className="mt-3 text-sm leading-relaxed">“{t.quote}”</blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-10 items-center justify-center rounded-full bg-mint font-bold text-mint-foreground"
                  >
                    {t.name.charAt(0)}
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{t.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t.area}
                      {t.verified ? " · Verified citizen" : ""}
                    </span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Placeholder quotes shown for demonstration. No official endorsements are implied.
        </p>
      </Section>

      <section className="relative overflow-hidden border-b border-border bg-surface py-20">
        <div aria-hidden="true" className="absolute inset-0 civic-grid-bg opacity-70" />
        <div aria-hidden="true" className="absolute inset-0 topo-texture" />
        <div className="container-page relative text-center">
          <h2 className="text-3xl font-extrabold text-balance md:text-5xl">
            Your Report Can Start the Change.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Help your local team understand what is happening in your neighbourhood.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/report"
              className="inline-flex min-h-12 items-center rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-glow transition-transform hover:-translate-y-0.5"
            >
              Report an Issue
            </Link>
            <Link
              to="/signin"
              className="inline-flex min-h-12 items-center rounded-2xl border border-border bg-background px-6 text-sm font-bold transition-colors hover:bg-accent"
            >
              Sign In to Track Reports
            </Link>
          </div>
          <div className="mt-8 flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <StatusBadge status="resolved" />
            <span>Average sample resolution time: 3.4 days</span>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

function BeforeAfter() {
  const [pos, setPos] = useState(50);
  return (
    <div className="mx-auto max-w-3xl">
      <div className="relative h-64 overflow-hidden rounded-3xl border border-border md:h-80">
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <span className="text-sm font-bold text-muted-foreground">
            After — road resurfaced and marked
          </span>
        </div>
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-center bg-navy text-navy-foreground"
          style={{ width: `${pos}%` }}
        >
          <span className="px-4 text-sm font-bold">Before — damaged road surface</span>
        </div>
        <span
          aria-hidden="true"
          className="absolute inset-y-0 w-0.5 bg-surface"
          style={{ left: `${pos}%` }}
        />
      </div>
      <label className="mt-4 block">
        <span className="mb-2 block text-xs font-semibold text-muted-foreground">
          Drag to compare before and after resolution (sample placeholders until real media is
          uploaded)
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className="w-full accent-[var(--color-primary)]"
        />
      </label>
    </div>
  );
}
