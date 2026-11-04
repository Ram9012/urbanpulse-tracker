import { useState, useEffect } from "react";
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

export function VerificationPanel({
  reportId,
  originalImageUrl,
  resolutionImageUrl,
  category,
  adminUsername,
  onDecisionComplete,
}: {
  reportId: string;
  originalImageUrl: string;
  resolutionImageUrl: string;
  category?: string;
  adminUsername?: string;
  onDecisionComplete?: () => void;
}) {
  const [verifications, setVerifications] = useState<VerificationRecordUI[]>([]);
  const [loading, setLoading] = useState(false);
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
        if (Array.isArray(data.verifications)) {
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
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Scene Consistency */}
            <div className="p-3 rounded-xl border border-border/70 bg-background">
              <div className="text-[11px] font-semibold text-muted-foreground">
                Scene Consistency
              </div>
              <div className="text-xl font-extrabold mt-1 text-foreground font-mono">
                {latest?.sceneConsistencyScore !== undefined &&
                latest?.sceneConsistencyScore !== null
                  ? `${Math.round(latest.sceneConsistencyScore * 100)}%`
                  : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                MobileNetV3 Shared Encoder
              </div>
            </div>

            {/* Siamese Perceptual Similarity */}
            <div className="p-3 rounded-xl border border-border/70 bg-background">
              <div className="text-[11px] font-semibold text-muted-foreground">
                Siamese Feature Match
              </div>
              <div className="text-xl font-extrabold mt-1 text-foreground font-mono">
                {latest?.siameseSimilarityScore !== undefined &&
                latest?.siameseSimilarityScore !== null
                  ? `${Math.round(latest.siameseSimilarityScore * 100)}%`
                  : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Cosine Similarity on L2 Embeddings
              </div>
            </div>

            {/* Bidirectional Correspondence */}
            <div className="p-3 rounded-xl border border-border/70 bg-background">
              <div className="text-[11px] font-semibold text-muted-foreground">
                Bidirectional Match
              </div>
              <div className="text-xl font-extrabold mt-1 text-foreground font-mono">
                {latest?.bidirectionalScore !== undefined && latest?.bidirectionalScore !== null
                  ? `${Math.round(latest.bidirectionalScore * 100)}%`
                  : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Forward & Backward ORB Keypoints
              </div>
            </div>

            {/* Semantic Segmentation Change */}
            <div className="p-3 rounded-xl border border-border/70 bg-background">
              <div className="text-[11px] font-semibold text-muted-foreground">
                Segmentation Structure
              </div>
              <div className="text-xl font-extrabold mt-1 text-foreground font-mono">
                {latest?.segmentationScore !== undefined && latest?.segmentationScore !== null
                  ? `${Math.round(latest.segmentationScore * 100)}%`
                  : "N/A (Skipped)"}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                DeepLabV3 MobileNetV3 Large
              </div>
            </div>

            {/* Quality & Resolution */}
            <div className="p-3 rounded-xl border border-border/70 bg-background">
              <div className="text-[11px] font-semibold text-muted-foreground">
                Evidence Clarity
              </div>
              <div className="text-xl font-extrabold mt-1 text-foreground font-mono">
                {latest?.qualityScore !== undefined && latest?.qualityScore !== null
                  ? `${Math.round(latest.qualityScore * 100)}%`
                  : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Laplacian Blur & Contrast
              </div>
            </div>

            {/* Final Composite Verdict */}
            <div className="p-3 rounded-xl border border-primary/30 bg-primary/5">
              <div className="text-[11px] font-bold text-primary">Final Verification Score</div>
              <div className="text-2xl font-black mt-1 text-primary font-mono">
                {latest?.finalVerificationScore !== undefined &&
                latest?.finalVerificationScore !== null
                  ? `${(latest.finalVerificationScore <= 1
                      ? latest.finalVerificationScore * 100
                      : latest.finalVerificationScore
                    ).toFixed(1)}%`
                  : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Average Score of Sub-Models
              </div>
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
                    {flag}
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
