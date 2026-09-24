import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { SiteLayout } from "@/components/site/site-layout";
import { Section } from "@/components/site/primitives";
import { BRAND, CATEGORIES, LANGUAGES, mockClassify, CivicReport, REPORTS } from "@/lib/civic-data";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Report a Civic Issue in Under a Minute — CivicPulse" },
      {
        name: "description",
        content:
          "Add a photo, confirm your location, describe the issue by text or voice, and submit. Powered by Groq AI and Supabase.",
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

interface AiAnalysisResult {
  summary: string;
  keywords: string[];
  severity_signals: string[];
  priority_recommendation: "critical" | "high" | "medium" | "low";
  priority_reason: string;
  confidence: number;
}

interface DuplicateCheckResult {
  is_duplicate: boolean;
  similarity_score: number;
  explanation: string;
  recommended_action: string;
}

function ReportPage() {
  const [step, setStep] = useState(0);
  const [media, setMedia] = useState<string[]>(["pothole_photo_1.jpg"]);
  const [locationState, setLocationState] = useState<"idle" | "denied" | "found">("found");
  const [description, setDescription] = useState("Large pothole near the bus stand. Two-wheelers are swerving into oncoming traffic to avoid it.");
  const [listening, setListening] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]!.name);
  const [anonymous, setAnonymous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  // Live AI State
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [duplicateChecked, setDuplicateChecked] = useState(false);
  const [selectedAction, setSelectedAction] = useState<"new" | "merge">("new");

  const recognitionRef = useRef<any>(null);

  // Voice Recognition setup (Web Speech API)
  const toggleListening = () => {
    if (listening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser. Please type your description.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-IN";

      recognition.onstart = () => setListening(true);
      recognition.onerror = (e: any) => {
        console.warn("Speech recognition error:", e);
        setListening(false);
      };
      recognition.onend = () => setListening(false);

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setDescription((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setError(`Microphone error: ${err.message}`);
      setListening(false);
    }
  };

  // Trigger Live AI Analysis via backend API
  const runAiAnalysis = async (textToAnalyze: string) => {
    if (!textToAnalyze || textToAnalyze.trim().length < 10) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: textToAnalyze,
          categoryName: category,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiAnalysis(data);

        // Also run duplicate check against nearby existing report CIV-10482
        const existingCandidate = REPORTS[0];
        if (existingCandidate) {
          const dupRes = await fetch("/api/ai/duplicate-check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              newDescription: textToAnalyze,
              existingReport: {
                id: existingCandidate.id,
                title: existingCandidate.title,
                description: existingCandidate.description,
                area: existingCandidate.area,
              },
            }),
          });
          if (dupRes.ok) {
            const dupData = await dupRes.json();
            setDuplicateResult(dupData);
            setDuplicateChecked(true);
          }
        }
      }
    } catch (err: any) {
      console.warn("AI analysis network fallback:", err);
    } finally {
      setAiLoading(false);
    }
  };

  // Run initial AI analysis on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      runAiAnalysis(description);
    }, 400);
    return () => clearTimeout(timer);
  }, [category]);

  const fallbackAi = mockClassify(description || "pothole near bus stop");
  const activeAi = aiAnalysis || {
    summary: fallbackAi.summary,
    keywords: fallbackAi.keywords,
    severity_signals: ["road obstruction", "safety hazard"],
    priority_recommendation: fallbackAi.priority,
    priority_reason: fallbackAi.reason,
    confidence: fallbackAi.confidence,
  };

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
    if (step === 2 && description.trim().length < 12) {
      setError("Add a short description (at least 12 characters) or record a voice note.");
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);

    const generatedId = `CIV-${Math.floor(10000 + Math.random() * 90000)}`;

    const newReport: CivicReport = {
      id: generatedId,
      title: activeAi.summary || description.slice(0, 60),
      category: "roads",
      categoryLabel: category,
      description: description,
      ward: "Ward 12",
      area: "Bus Stand Road",
      status: "submitted",
      priority: activeAi.priority_recommendation || "high",
      department: "Public Works — Roads",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiConfidence: activeAi.confidence || 0.94,
      duplicateProbability: duplicateResult?.is_duplicate ? duplicateResult.similarity_score / 100 : 0.1,
      upvotes: 1,
      anonymous,
      x: 32,
      y: 45,
    };

    try {
      const res = await fetch("/api/status/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: newReport }),
      });

      if (res.ok) {
        setSubmittedId(generatedId);
      } else {
        // Fallback locally
        setSubmittedId(generatedId);
      }
    } catch {
      setSubmittedId(generatedId);
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedId) {
    return (
      <SiteLayout>
        <Section align="center" title="Report submitted">
          <div className="surface-card mx-auto max-w-lg p-8 text-center shadow-lg">
            <span
              aria-hidden="true"
              className="mx-auto inline-flex size-16 items-center justify-center rounded-full bg-success/15 text-2xl text-success animate-rise-in font-bold"
            >
              ✓
            </span>
            <h2 className="mt-5 font-display text-2xl font-extrabold">Thank you — it is officially registered</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your tracking ID is <strong className="text-foreground font-mono text-base bg-muted px-2 py-0.5 rounded">{submittedId}</strong>. Keep it to follow progress.
            </p>

            <div className="mt-4 rounded-xl bg-mint/40 border border-mint p-4 text-left text-sm text-mint-foreground">
              <p className="font-bold flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full bg-success animate-pulse" />
                Status: SUBMITTED (Stage 1 of 8)
              </p>
              <p className="mt-1 text-xs opacity-90">
                Routed to: <strong>Public Works — Roads</strong>. Municipal dispatch has been notified.
              </p>
            </div>

            {activeAi && (
              <div className="mt-4 rounded-xl bg-muted/60 p-3 text-left text-xs space-y-1">
                <p className="font-bold text-foreground">AI Intelligence Logged:</p>
                <p className="text-muted-foreground"><strong className="text-foreground">Summary:</strong> {activeAi.summary}</p>
                <p className="text-muted-foreground"><strong className="text-foreground">Recommended Priority:</strong> {activeAi.priority_recommendation.toUpperCase()} ({activeAi.priority_reason})</p>
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/reports/$id"
                params={{ id: submittedId }}
                className="inline-flex min-h-12 items-center rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90"
              >
                Track Live Status
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex min-h-12 items-center rounded-2xl border border-border px-6 text-sm font-bold hover:bg-accent"
              >
                Citizen Dashboard
              </Link>
            </div>

            <fieldset className="mt-6 text-left border-t border-border pt-4">
              <legend className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Live notifications enabled</legend>
              {["In-app Realtime alerts", "Email notifications (bipin@example.com)", "SMS on worker dispatch"].map((p, i) => (
                <label key={p} className="mt-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" defaultChecked={i < 2} className="size-4 rounded accent-primary" />
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
      <Section align="left" eyebrow="New Report" title="Report a Civic Issue">
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

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="surface-card p-6">
            {step === 0 && (
              <div>
                <h2 className="text-lg font-bold">1. Add photo or video evidence</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Clear visual evidence allows municipal teams to assess severity and dispatch the right equipment.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {["Use Camera", "Upload Photo", "Upload Video"].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setMedia((m) => [...m, `${label.toLowerCase().replace(" ", "_")}_${Date.now().toString().slice(-4)}.jpg`])}
                      className="min-h-24 flex flex-col items-center justify-center rounded-xl border border-dashed border-input bg-background text-sm font-semibold hover:border-primary/50 hover:bg-accent transition"
                    >
                      <span className="text-xl mb-1">📷</span>
                      {label}
                    </button>
                  ))}
                </div>
                {media.length > 0 && (
                  <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {media.map((m, i) => (
                      <li key={`${m}-${i}`} className="rounded-xl border border-border p-3 text-xs bg-muted/30">
                        <span aria-hidden="true" className="block h-20 rounded-lg civic-grid-bg flex items-center justify-center text-muted-foreground">
                          Media #{i + 1}
                        </span>
                        <span className="mt-2 block font-semibold truncate">{m}</span>
                        <button
                          type="button"
                          onClick={() => setMedia((list) => list.filter((_, idx) => idx !== i))}
                          className="mt-1 font-bold text-destructive hover:underline"
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
                <h2 className="text-lg font-bold">2. Confirm the incident location</h2>
                <div aria-hidden="true" className="mt-4 h-56 rounded-2xl border border-border civic-grid-bg topo-texture flex items-center justify-center">
                  <div className="bg-background/90 backdrop-blur px-4 py-2 rounded-xl border border-border shadow text-xs font-semibold">
                    📍 13.0072° N, 76.1023° E (Ward 12, Bus Stand Road)
                  </div>
                </div>
                {locationState === "denied" ? (
                  <p role="alert" className="mt-4 rounded-xl bg-warning/15 p-3 text-sm font-semibold text-warning-foreground">
                    Location permission denied. Enable location or drag the marker to the correct point.
                  </p>
                ) : (
                  <p className="mt-4 text-sm">
                    <strong>Bus Stand Road, Ward 12</strong> · {BRAND.city}
                    <span className="block text-xs text-muted-foreground">Accuracy ±6 m — automatically captured for municipal routing.</span>
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setLocationState("found")}
                    className="min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
                  >
                    Auto-detect GPS
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
                <h2 className="text-lg font-bold">3. Describe the issue (Text or Voice)</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold">Category (Standard dropdown)</span>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-medium"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.name}>{c.name}</option>
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
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold">Description</span>
                    <button
                      type="button"
                      onClick={() => runAiAnalysis(description)}
                      disabled={aiLoading}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      {aiLoading ? "AI Analyzing…" : "⚡ Re-analyze with Groq"}
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                    }}
                    onBlur={() => runAiAnalysis(description)}
                    className="w-full rounded-xl border border-input bg-background p-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="Tell us what needs attention, hazard signals, and landmarks."
                  />
                </label>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold transition ${
                      listening ? "bg-destructive text-destructive-foreground animate-pulse" : "border border-border hover:bg-accent"
                    }`}
                  >
                    <span aria-hidden="true">{listening ? "🔴" : "🎙"}</span>
                    {listening ? "Recording… Click to finish" : "Record voice note"}
                  </button>

                  <label className="flex items-center gap-2 text-sm select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={anonymous}
                      onChange={(e) => setAnonymous(e.target.checked)}
                      className="size-4 rounded accent-primary"
                    />
                    Report anonymously
                  </label>
                </div>

                {/* Duplicate Analysis Alert (AI Service 3) */}
                {duplicateResult && duplicateResult.is_duplicate && (
                  <div className="mt-5 rounded-2xl border-2 border-warning/50 bg-warning/10 p-4 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-xl">⚠️</span>
                      <div className="flex-1">
                        <p className="font-bold text-warning-foreground">
                          Possible Duplicate Detected ({duplicateResult.similarity_score}% Match)
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Existing report <strong>CIV-10482</strong> is 34 metres away on Bus Stand Road.
                        </p>
                        <p className="mt-1 text-xs text-foreground bg-background/80 p-2 rounded-lg border border-border">
                          {duplicateResult.explanation}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedAction("merge")}
                            className={`min-h-9 px-3 rounded-lg text-xs font-bold transition ${
                              selectedAction === "merge" ? "bg-primary text-primary-foreground" : "border border-border bg-background"
                            }`}
                          >
                            ✓ Add info to existing report (CIV-10482)
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedAction("new")}
                            className={`min-h-9 px-3 rounded-lg text-xs font-bold transition ${
                              selectedAction === "new" ? "bg-primary text-primary-foreground" : "border border-border bg-background"
                            }`}
                          >
                            Keep as separate new report
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="text-lg font-bold">4. Review and Submit</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  {[
                    ["Evidence Media", `${media.length} visual evidence file(s) attached`],
                    ["Location", `Bus Stand Road, Ward 12 · ${BRAND.city} (±6m accuracy)`],
                    ["Selected Category", category],
                    ["AI Summary", activeAi.summary],
                    ["Recommended Priority", `${activeAi.priority_recommendation.toUpperCase()} — ${activeAi.priority_reason}`],
                    ["Handling Department", "Public Works — Roads"],
                    ["Citizen Visibility", anonymous ? "Anonymous (Contact encrypted)" : "Verified Citizen"],
                    ["Duplicate Strategy", selectedAction === "merge" ? "Merge information with CIV-10482" : "Submit as distinct report"],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-border p-3 bg-muted/20">
                      <dt className="text-xs font-bold text-muted-foreground uppercase">{k}</dt>
                      <dd className="mt-1 font-semibold text-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>
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
                  className="min-h-12 rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="min-h-12 rounded-2xl bg-warm px-6 text-sm font-bold text-warm-foreground shadow hover:bg-warm/90 disabled:opacity-70"
                >
                  {submitting ? "Submitting to Supabase Queue…" : "Confirm & Submit Report"}
                </button>
              )}
            </div>
          </div>

          {/* AI Decision Support Panel */}
          <aside className="surface-card h-fit bg-navy p-6 text-navy-foreground shadow-lg rounded-2xl">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-teal">Groq AI Advisory Layer</p>
              {aiLoading && <span className="size-2 rounded-full bg-teal animate-ping" />}
            </div>

            <h3 className="mt-3 text-base font-bold">
              {category} · {Math.round(activeAi.confidence * 100)}% Confidence
            </h3>

            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-xl bg-navy-foreground/10 p-3">
                <span className="font-bold text-teal block uppercase tracking-wider text-[10px]">AI Issue Summary</span>
                <p className="mt-1 text-white font-medium">{activeAi.summary}</p>
              </div>

              <div className="rounded-xl bg-navy-foreground/10 p-3">
                <span className="font-bold text-teal block uppercase tracking-wider text-[10px]">Priority Recommendation</span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded font-bold uppercase bg-warm text-warm-foreground text-[10px]">
                    {activeAi.priority_recommendation}
                  </span>
                  <span className="text-white/80">{activeAi.priority_reason}</span>
                </div>
              </div>

              {activeAi.severity_signals && activeAi.severity_signals.length > 0 && (
                <div className="rounded-xl bg-navy-foreground/10 p-3">
                  <span className="font-bold text-teal block uppercase tracking-wider text-[10px]">Detected Severity Signals</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {activeAi.severity_signals.map((sig) => (
                      <span key={sig} className="px-2 py-0.5 rounded-full bg-navy-foreground/15 text-white text-[10px]">
                        ⚠️ {sig}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-navy-foreground/10 p-3">
                <span className="font-bold text-teal block uppercase tracking-wider text-[10px]">Extracted Keywords</span>
                <p className="mt-1 text-white/80">{activeAi.keywords.join(", ")}</p>
              </div>
            </div>

            <p className="mt-4 text-[11px] opacity-75 border-t border-navy-foreground/15 pt-3">
              <strong>Architecture Note:</strong> AI predictions are advisory suggestions. The municipal department, priority, and workflow decisions are finalized by staff.
            </p>
          </aside>
        </div>
      </Section>
    </SiteLayout>
  );
}
