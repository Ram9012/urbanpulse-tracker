import { useState, useEffect } from "react";
import { CircleAlert } from "lucide-react";
import { VerificationBadge } from "./verification-badge";

export type VerificationRecordUI = {
  id: string;
  reportId: string;
  originalImageUrl: string;
  resolutionImageUrl: string;
  jobStatus: string;
  verificationStatus: string;
  sceneConsistencyScore?: number;
  siameseSimilarityScore?: number;
  bidirectionalScore?: number;
  segmentationScore?: number;
  qualityScore?: number;
  finalVerificationScore?: number;
  resolutionScore?: number;
  locationMatchScore?: number;
  surroundingsScore?: number;
  viewpointScore?: number;
  defectVisibleScore?: number;
  repairQualityScore?: number;
  geometricError?: string;
  vlmVerdict?: string;
  vlmModel?: string;
  visionError?: string;
  evidenceExplanation?: string;
  flags?: string[];
  modelVersion?: string;
  processingDurationMs?: number;
  isSuspectedDuplicate?: boolean;
  adminDecision?: "approved" | "rejected" | "manual_review";
  adminDecisionBy?: string;
  adminDecisionAt?: string;
  adminDecisionNote?: string;
  createdAt: string;
};

function ScoreTile({
  label,
  hint,
  value,
  accent = false,
  emptyText = "—",
}: {
  label: string;
  hint: string;
  value: number | null;
  accent?: boolean;
  emptyText?: string;
}) {
  return (
    <div
      className={
        "p-3 rounded-xl border " +
        (accent ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/70 bg-background")
      }
    >
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className="text-xl font-extrabold mt-1 text-foreground font-mono">
        {value === null ? emptyText : `${value}%`}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>
    </div>
  );
}

const pct = (v?: number | null) =>
  typeof v === "number" ? Math.round((v <= 1 ? v : v / 100) * 100) : null;

export function VerificationPanel({
  reportId,
  originalImageUrl,
  resolutionImageUrl,
  category,
  description,
  adminUsername,
  onDecisionComplete,
}: {
  reportId: string;
  originalImageUrl: string;
  resolutionImageUrl: string;
  category?: string;
  description?: string;
  adminUsername?: string;
  onDecisionComplete?: () => void;
}) {
  const [verifications, setVerifications] = useState<VerificationRecordUI[]>([]);
  const [running, setRunning] = useState(false);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionNote, setDecisionNote] = useState("");
  const [activeTab, setActiveTab] = useState<"side-by-side" | "scores" | "pipeline">(
    "side-by-side",
  );

  const fetchVerifications = async () => {
    try {
      const res = await fetch(`/api/vision/report/${reportId}`);
      if (res.ok) {
        const data = await res.json();
        // Never let a transient empty response wipe out results we already
        // have — that is what made the panel flicker back to "Awaiting".
        if (Array.isArray(data.verifications) && data.verifications.length > 0) {
          setVerifications(data.verifications);
        }
      }
    } catch (err) {
      console.warn("Could not fetch verification data:", err);
    }
  };

  useEffect(() => {
    fetchVerifications();
    const interval = setInterval(fetchVerifications, 4000);
    return () => clearInterval(interval);
  }, [reportId]);

  const latest = verifications[0];
  const inProgress =
    running || latest?.jobStatus === "pending" || latest?.jobStatus === "processing";

  const handleRunAnalysis = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/vision/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId,
          originalImageUrl,
          resolutionImageUrl,
          category,
          description,
          requestedBy: adminUsername,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.verification) setVerifications((prev) => [data.verification, ...prev]);
      }
    } catch (err) {
      console.warn("Failed to start AI verification:", err);
    } finally {
      setRunning(false);
      fetchVerifications();
    }
  };

  const handleAdminDecision = async (decision: "approved" | "rejected" | "manual_review") => {
    if (!latest?.id) return;
    setSubmittingDecision(true);
    try {
      const res = await fetch("/api/vision/admin-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationId: latest.id,
          decision,
          adminUsername: adminUsername || "admin",
          note: decisionNote || `Resolution ${decision} by Municipal Administrator.`,
        }),
      });
      if (res.ok) {
        await fetchVerifications();
        if (onDecisionComplete) onDecisionComplete();
      }
    } catch (err) {
      console.warn("Failed to submit admin decision:", err);
    } finally {
      setSubmittingDecision(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm text-card-foreground">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">🔬</span>
            <h3 className="font-display font-extrabold text-sm sm:text-base">
              AI Resolution Verification Analysis
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Siamese Perceptual Similarity & Bidirectional Visual Correspondence
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunAnalysis}
            disabled={inProgress}
            className="h-8 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm transition hover:opacity-90 disabled:opacity-50"
          >
            {inProgress ? "Analyzing…" : latest ? "Re-run AI Analysis" : "Run AI Analysis"}
          </button>
          {latest ? (
            <VerificationBadge
              status={latest.verificationStatus}
              score={latest.finalVerificationScore}
            />
          ) : (
            <span className="text-xs font-semibold text-muted-foreground">
              Awaiting Verification
            </span>
          )}
        </div>
      </div>

      {latest?.visionError && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-3 rounded-2xl bg-warning/12 p-4 text-sm ring-1 ring-warning/30 ring-inset"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
          <div>
            <p className="font-bold text-warning-foreground">Image analysis could not run</p>
            <p className="mt-0.5 text-foreground/80">
              Your photos were not the problem: {latest.visionError}. Any scores shown come from the
              other checks only, and a supervisor should review the photos manually.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/50 py-2.5 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab("side-by-side")}
          className={`px-3 py-1.5 rounded-lg transition ${
            activeTab === "side-by-side"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          🖼️ Side-by-Side Visual Proof
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("scores")}
          className={`px-3 py-1.5 rounded-lg transition ${
            activeTab === "scores"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          📊 Multi-Model Metric Scores
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("pipeline")}
          className={`px-3 py-1.5 rounded-lg transition ${
            activeTab === "pipeline"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          🔍 Audit & Evidence Explanation
        </button>
      </div>

      {/* Tab 1: Side by Side Images */}
      {activeTab === "side-by-side" && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Before (Original Citizen) */}
            <div className="rounded-xl border border-border/80 overflow-hidden bg-muted/20">
              <div className="bg-muted px-3 py-1.5 text-xs font-bold flex items-center justify-between">
                <span>1. Original Citizen Issue</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-background text-muted-foreground">
                  Before
                </span>
              </div>
              <div className="aspect-video relative bg-black/40 flex items-center justify-center overflow-hidden">
                <img
                  src={originalImageUrl || "/media/evidence/pothole_before.jpg"}
                  alt="Original Citizen Report Evidence"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/media/evidence/pothole_before.jpg";
                  }}
                />
              </div>
            </div>

            {/* After (Field Worker Resolution) */}
            <div className="rounded-xl border border-emerald-500/30 overflow-hidden bg-emerald-500/5">
              <div className="bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                <span>2. Field Worker Resolution Photo</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                  After
                </span>
              </div>
              <div className="aspect-video relative bg-black/40 flex items-center justify-center overflow-hidden">
                <img
                  src={resolutionImageUrl || "/media/evidence/pothole_resolved.jpg"}
                  alt="Field Worker Resolution Evidence"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/media/evidence/pothole_resolved.jpg";
                  }}
                />
              </div>
            </div>
          </div>

          {/* AI Explanation Banner */}
          {latest?.evidenceExplanation && (
            <div className="rounded-xl bg-muted/40 p-3.5 border border-border/60 text-xs">
              <div className="flex items-center gap-1.5 font-bold mb-1 text-foreground">
                <span>🤖</span>
                <span>Automated Vision Inspection Assessment:</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">{latest.evidenceExplanation}</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Scores */}
      {activeTab === "scores" && (
        <div className="mt-4 space-y-4">
          <div>
            <div className="mb-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
              Vision AI assessment
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <ScoreTile
                accent
                label="Defect Resolved"
                hint={
                  latest?.vlmVerdict
                    ? latest.vlmVerdict.replace(/_/g, " ").toLowerCase()
                    : "Is the reported problem fixed?"
                }
                value={pct(latest?.resolutionScore)}
              />
              <ScoreTile
                label="Same Location"
                hint="Both photos show the same spot"
                value={pct(latest?.locationMatchScore)}
              />
              <ScoreTile
                label="Surroundings Match"
                hint="Background, buildings, landmarks"
                value={pct(latest?.surroundingsScore)}
              />
              <ScoreTile
                label="Comparable Viewpoint"
                hint="Similar angle and distance"
                value={pct(latest?.viewpointScore)}
              />
              <ScoreTile
                label="Defect Visible Before"
                hint="Original photo shows the issue"
                value={pct(latest?.defectVisibleScore)}
              />
              <ScoreTile
                label="Repair Quality"
                hint="How complete and neat the fix is"
                value={pct(latest?.repairQualityScore)}
              />
              <ScoreTile
                label="Photo Clarity"
                hint="Sharp, well lit, usable evidence"
                value={pct(latest?.qualityScore)}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
              Computer-vision checks (optional)
            </div>
            {[
              latest?.sceneConsistencyScore,
              latest?.siameseSimilarityScore,
              latest?.bidirectionalScore,
              latest?.segmentationScore,
            ].some((v) => typeof v === "number") ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ScoreTile
                  label="Scene Consistency"
                  hint="MobileNetV3 shared encoder"
                  value={pct(latest?.sceneConsistencyScore)}
                />
                <ScoreTile
                  label="Siamese Match"
                  hint="Cosine similarity of embeddings"
                  value={pct(latest?.siameseSimilarityScore)}
                />
                <ScoreTile
                  label="Keypoint Match"
                  hint="Forward and backward ORB"
                  value={pct(latest?.bidirectionalScore)}
                />
                <ScoreTile
                  label="Segmentation"
                  hint="DeepLabV3 structure change"
                  value={pct(latest?.segmentationScore)}
                  emptyText="Not needed"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground leading-relaxed">
                Siamese, keypoint and segmentation checks are optional extras that run in a separate
                Python AI service.{" "}
                {latest?.geometricError
                  ? `They did not run: ${latest.geometricError}.`
                  : "They are not available for this report."}{" "}
                The verdict above does not depend on them.
              </div>
            )}
          </div>

          {/* Final Composite Verdict */}
          <div className="p-3 rounded-xl border border-primary/30 bg-primary/5">
            <div className="text-[11px] font-bold text-primary">Final Verification Score</div>
            <div className="text-2xl font-black mt-1 text-primary font-mono">
              {pct(latest?.finalVerificationScore) !== null
                ? `${(typeof latest?.finalVerificationScore === "number"
                    ? latest.finalVerificationScore <= 1
                      ? latest.finalVerificationScore * 100
                      : latest.finalVerificationScore
                    : 0
                  ).toFixed(1)}%`
                : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              35% same place · 65% defect fixed
            </div>
          </div>

          {latest?.flags && latest.flags.length > 0 && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs">
              <div className="font-bold text-amber-700 dark:text-amber-400 mb-1">
                ⚠️ Verification Signals & Flags:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {latest.flags.map((flag) => (
                  <span
                    key={flag}
                    className="px-2 py-0.5 rounded bg-background border border-amber-500/20 font-mono text-[10px] text-amber-600 dark:text-amber-300"
                  >
                    {flag.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Pipeline & Audit */}
      {activeTab === "pipeline" && (
        <div className="mt-4 space-y-3 text-xs">
          <div className="rounded-xl border border-border p-3.5 space-y-2 bg-background/50">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Model Architecture:</span>
              <span className="font-mono font-bold text-foreground">
                {latest?.modelVersion || "MobileNetV3-Small (Shared Weights)"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Inference Execution:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                CPU-First (Low Power / Zero Cloud Expense)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Processing Time:</span>
              <span className="font-mono text-foreground">
                {latest?.processingDurationMs
                  ? `${Math.round(latest.processingDurationMs)} ms`
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Perceptual Duplicate Check:</span>
              <span className="font-mono text-foreground">
                {latest?.isSuspectedDuplicate ? "⚠️ Reused Image Detected" : "✓ Unique New Photo"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Admin Decision Bar */}
      <div className="mt-5 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={decisionNote}
            onChange={(e) => setDecisionNote(e.target.value)}
            placeholder="Optional supervisor decision note..."
            className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleAdminDecision("approved")}
            disabled={submittingDecision}
            className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>✓</span> Approve Resolution
          </button>
          <button
            type="button"
            onClick={() => handleAdminDecision("manual_review")}
            disabled={submittingDecision}
            className="h-9 px-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>🔍</span> Request Re-Inspection
          </button>
          <button
            type="button"
            onClick={() => handleAdminDecision("rejected")}
            disabled={submittingDecision}
            className="h-9 px-3.5 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>✕</span> Reject Resolution
          </button>
        </div>
      </div>

      {latest?.adminDecision && (
        <div className="mt-3 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <span>🛡️</span>
          <span>
            Previous supervisor decision:{" "}
            <strong className="text-foreground uppercase">{latest.adminDecision}</strong> by{" "}
            {latest.adminDecisionBy || "admin"} on{" "}
            {latest.adminDecisionAt
              ? new Date(latest.adminDecisionAt).toLocaleString("en-IN")
              : "recent"}
            .
          </span>
        </div>
      )}
    </div>
  );
}
