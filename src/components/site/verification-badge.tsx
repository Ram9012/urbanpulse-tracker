import { Badge } from "@/components/ui/badge";

export type VerificationOutcome =
  "VERIFIED" | "NEEDS_REVIEW" | "INSUFFICIENT_EVIDENCE" | "PENDING" | "PROCESSING" | "UNAVAILABLE";

export function VerificationBadge({
  status,
  score,
  compact = false,
}: {
  status: string | undefined | null;
  score?: number | null | undefined;
  compact?: boolean;
}) {
  const normalized = (status || "PENDING").toUpperCase() as VerificationOutcome;

  let bg = "bg-muted text-muted-foreground border-border";
  let label = "Pending AI Check";
  let icon = "⏳";

  switch (normalized) {
    case "VERIFIED":
      bg = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
      label = "AI Verified Match";
      icon = "✓";
      break;
    case "NEEDS_REVIEW":
      bg = "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
      label = "Needs Review";
      icon = "⚠️";
      break;
    case "INSUFFICIENT_EVIDENCE":
      bg = "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
      label = "Insufficient Evidence";
      icon = "✕";
      break;
    case "PROCESSING":
      bg = "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
      label = "Processing Vision";
      icon = "⚙️";
      break;
    case "UNAVAILABLE":
      bg = "bg-muted text-muted-foreground border-border";
      label = "Manual Review";
      icon = "📋";
      break;
  }

  const formatScore = (val: number) => {
    const pct = val <= 1 ? val * 100 : val;
    return `${pct.toFixed(1)}%`;
  };

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${bg}`}
      >
        <span>{icon}</span>
        <span>{label}</span>
        {typeof score === "number" && <span className="opacity-80">({formatScore(score)})</span>}
      </span>
    );
  }

  return (
    <Badge variant="outline" className={`gap-1.5 font-bold ${bg}`}>
      <span>{icon}</span>
      <span>{label}</span>
      {typeof score === "number" && (
        <span className="font-mono text-xs opacity-85">({formatScore(score)})</span>
      )}
    </Badge>
  );
}
