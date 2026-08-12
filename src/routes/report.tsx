import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SiteLayout } from "@/components/site/site-layout";
import { Section } from "@/components/site/primitives";
import { BRAND, CATEGORIES, LANGUAGES, mockClassify } from "@/lib/civic-data";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Report a Civic Issue in Under a Minute — CivicPulse" },
      {
        name: "description",
        content:
          "Add a photo, confirm your location, describe the issue by text or voice, and submit. You receive a tracking ID and updates until resolution.",
      },
      { property: "og:title", content: "Report a Civic Issue in Under a Minute — CivicPulse" },
      { property: "og:description", content: "Four simple steps: media, location, description, review." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportPage,
});

const STEPS = ["Add media", "Confirm location", "Describe issue", "Review & submit"];

function ReportPage() {
  const [step, setStep] = useState(0);
  const [media, setMedia] = useState<string[]>([]);
  const [locationState, setLocationState] = useState<"idle" | "denied" | "found">("found");
  const [description, setDescription] = useState("");
  const [listening, setListening] = useState<"idle" | "listening" | "done">("idle");
  const [category, setCategory] = useState(CATEGORIES[0]!.name);
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const transcript = "There is a large pothole near the bus stop.";
  const text = listening === "done" ? transcript : description;
  const ai = mockClassify(text || "pothole near bus stop");

  function next() {
    setError(null);
    if (step === 0 && media.length === 0) {
      setError("Add at least one photo or video so staff can verify the issue.");
      return;
    }
    if (step === 1 && locationState !== "found") {
      setError("We need a location. Allow location access or pick the point on the map.");
      return;
    }
    if (step === 2 && text.trim().length < 12) {
      setError("Add a short description (at least 12 characters) or record a voice note.");
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function submit() {
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      setSubmittedId("CIV-10483");
    }, 900);
  }

  if (submittedId) {
    return (
      <SiteLayout>
        <Section align="center" title="Report submitted">
          <div className="surface-card mx-auto max-w-lg p-8 text-center">
            <span
              aria-hidden="true"
              className="mx-auto inline-flex size-16 items-center justify-center rounded-full bg-success/15 text-2xl text-success animate-rise-in"
            >
              ✓
            </span>
            <h2 className="mt-5 font-display text-2xl font-extrabold">Thank you — it is on its way</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your tracking ID is <strong className="text-foreground">{submittedId}</strong>. Keep it to follow progress.
            </p>
            <p className="mt-4 rounded-xl bg-mint p-3 text-sm text-mint-foreground">
              Next step: municipal staff verify the report and route it to {ai.department}.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/reports/$id"
                params={{ id: "CIV-10482" }}
                className="inline-flex min-h-12 items-center rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground"
              >
                Track report
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex min-h-12 items-center rounded-2xl border border-border px-6 text-sm font-bold hover:bg-accent"
              >
                Go to my dashboard
              </Link>
            </div>
            <fieldset className="mt-6 text-left">
              <legend className="text-sm font-bold">Notify me by</legend>
              {["In-app", "Email", "SMS"].map((p, i) => (
                <label key={p} className="mt-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" defaultChecked={i < 2} className="size-4" />
                  {p}
                </label>
              ))}
            </fieldset>
          </div>
        </Section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <Section align="left" eyebrow="New report" title="Report an issue">
        <ol className="mb-8 flex flex-wrap gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={i === step ? "step" : undefined}
              className={
                "flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold " +
                (i === step
                  ? "border-primary bg-primary/10 text-primary"
                  : i < step
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-border text-muted-foreground")
              }
            >
              <span aria-hidden="true">{i < step ? "✓" : i + 1}</span>
              {s}
            </li>
          ))}
        </ol>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="surface-card p-6">
            {step === 0 && (
              <div>
                <h2 className="text-lg font-bold">Add a photo or video</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Clear media helps staff verify and prioritise the issue faster.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {["Use camera", "Upload photo", "Upload video"].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setMedia((m) => [...m, label])}
                      className="min-h-24 rounded-xl border border-dashed border-input bg-background text-sm font-semibold hover:border-primary/50 hover:bg-accent"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {media.length > 0 && (
                  <ul className="mt-4 grid grid-cols-3 gap-3">
                    {media.map((m, i) => (
                      <li key={`${m}-${i}`} className="rounded-xl border border-border p-3 text-xs">
                        <span aria-hidden="true" className="block h-16 rounded-lg civic-grid-bg" />
                        <span className="mt-2 block font-semibold">{m}</span>
                        <button
                          type="button"
                          onClick={() => setMedia((list) => list.filter((_, idx) => idx !== i))}
                          className="mt-1 font-bold text-destructive"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {step === 1 && (
              <div>
                <h2 className="text-lg font-bold">Confirm the location</h2>
                <div aria-hidden="true" className="mt-4 h-56 rounded-2xl border border-border civic-grid-bg topo-texture" />
                {locationState === "denied" ? (
                  <p role="alert" className="mt-4 rounded-xl bg-warning/15 p-3 text-sm font-semibold text-warning-foreground">
                    Location permission denied. Enable location or drag the marker to the correct point.
                  </p>
                ) : (
                  <p className="mt-4 text-sm">
                    <strong>Bus Stand Road, Ward 12</strong> · {BRAND.city}
                    <span className="block text-xs text-muted-foreground">Accuracy ±8 m — drag the marker to fine-tune.</span>
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setLocationState("found")}
                    className="min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
                  >
                    Detect my location
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocationState("denied")}
                    className="min-h-11 rounded-xl border border-border px-4 text-sm font-bold hover:bg-accent"
                  >
                    Simulate permission denied
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-lg font-bold">Describe the issue</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold">Category</span>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold">Language</span>
                    <select className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                      {LANGUAGES.map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-sm font-semibold">Description</span>
                  <textarea
                    rows={4}
                    value={text}
                    onChange={(e) => {
                      setListening("idle");
                      setDescription(e.target.value);
                    }}
                    className="w-full rounded-xl border border-input bg-background p-3 text-sm"
                    placeholder="Tell us what needs attention and why."
                  />
                </label>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setListening((s) => (s === "listening" ? "done" : "listening"))}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-bold hover:bg-accent"
                  >
                    <span aria-hidden="true">🎙</span>
                    {listening === "listening" ? "Listening…" : "Record voice note"}
                  </button>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={anonymous}
                      onChange={(e) => setAnonymous(e.target.checked)}
                      className="size-4"
                    />
                    Report anonymously
                  </label>
                </div>
                <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
                  {listening === "listening"
                    ? "Listening… speak in English, Kannada or Hindi."
                    : listening === "done"
                      ? `Voice converted to text: “${transcript}”`
                      : ""}
                </p>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="text-lg font-bold">Review and submit</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  {[
                    ["Media", `${media.length} file(s) attached`],
                    ["Location", `Bus Stand Road, Ward 12 · ${BRAND.city}`],
                    ["Category", category],
                    ["Description", text || "—"],
                    ["Visibility", anonymous ? "Anonymous — your name is hidden" : "Name shown to staff only"],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-border p-3">
                      <dt className="text-xs font-bold text-muted-foreground uppercase">{k}</dt>
                      <dd className="mt-1 font-semibold">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-xs text-muted-foreground">
                  Your location is used only to route this report. Exact coordinates are never shown publicly.
                </p>
              </div>
            )}

            {error && (
              <p role="alert" className="mt-5 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="min-h-12 rounded-2xl border border-border px-5 text-sm font-bold hover:bg-accent"
                >
                  Back
                </button>
              )}
              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={next}
                  className="min-h-12 rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="min-h-12 rounded-2xl bg-warm px-6 text-sm font-bold text-warm-foreground disabled:opacity-70"
                >
                  {submitting ? "Submitting…" : "Submit report"}
                </button>
              )}
            </div>
          </div>

          <aside className="surface-card h-fit bg-navy p-6 text-navy-foreground">
            <p className="text-xs font-bold uppercase opacity-70">AI assistance — you stay in control</p>
            <h2 className="mt-2 text-base font-bold">
              {ai.categoryLabel} — {Math.round(ai.confidence * 100)}% confidence
            </h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="rounded-xl bg-navy-foreground/8 p-3">Suggested department: {ai.department}</li>
              <li className="rounded-xl bg-navy-foreground/8 p-3">Suggested priority: {ai.priority}</li>
              <li className="rounded-xl bg-navy-foreground/8 p-3">Possible duplicates: 2 within 50 m</li>
              <li className="rounded-xl bg-navy-foreground/8 p-3">{ai.reason}</li>
            </ul>
            <p className="mt-4 text-xs opacity-75">
              Suggestions are not decisions. Edit the category or description any time before submitting.
            </p>
            <p className="mt-4 rounded-xl bg-navy-foreground/8 p-3 text-xs">
              Offline? Your report is saved on this device and uploaded automatically when you reconnect.
            </p>
          </aside>
        </div>
      </Section>
    </SiteLayout>
  );
}
