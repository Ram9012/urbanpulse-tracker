import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STATUS_META, type Priority, type ReportStatus } from "@/lib/civic-data";

/* ---------------- Brand ---------------- */

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-navy text-navy-foreground",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" strokeLinejoin="round" />
        <path
          d="M8.5 10.2h2l1.2-2.4 1.4 4 1-1.6h1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/* ---------------- Section shell ---------------- */

export function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  className,
  align = "center",
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  align?: "center" | "left";
}) {
  return (
    <section id={id} className={cn("py-16 md:py-24", className)}>
      <div className="container-page">
        {(eyebrow || title || description) && (
          <header
            className={cn("mb-10 max-w-2xl md:mb-14", align === "center" && "mx-auto text-center")}
          >
            {eyebrow && (
              <p className="mb-3 text-xs font-bold tracking-[0.16em] text-primary uppercase">
                {eyebrow}
              </p>
            )}
            {title && <h2 className="text-3xl font-extrabold text-balance md:text-4xl">{title}</h2>}
            {description && (
              <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
                {description}
              </p>
            )}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}

/* ---------------- Scroll reveal ---------------- */

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "-40px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ---------------- Animated counter ---------------- */

export function Counter({
  to,
  suffix = "",
  decimals = 0,
  duration = 1400,
}: {
  to: number;
  suffix?: string;
  decimals?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setValue(to);
      return;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setValue(to * eased);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    io.observe(node);
    return () => io.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref}>
      {value.toLocaleString("en-IN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/* ---------------- Status + priority badges ---------------- */

const STATUS_CLASS: Record<string, string> = {
  primary: "bg-primary/10 text-primary ring-primary/20",
  teal: "bg-teal/10 text-teal ring-teal/25",
  warning: "bg-warning/15 text-warning-foreground ring-warning/30",
  success: "bg-success/12 text-success ring-success/25",
  muted: "bg-muted text-muted-foreground ring-border",
};

const STATUS_ICON: Record<string, string> = {
  primary: "○",
  teal: "◐",
  warning: "◔",
  success: "✓",
  muted: "⊘",
};

export function StatusBadge({ status, className }: { status: ReportStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        STATUS_CLASS[meta.tone],
        className,
      )}
    >
      <span aria-hidden="true">{STATUS_ICON[meta.tone]}</span>
      {meta.label}
    </span>
  );
}

const PRIORITY_CLASS: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground ring-border",
  medium: "bg-primary/10 text-primary ring-primary/20",
  high: "bg-warning/15 text-warning-foreground ring-warning/30",
  critical: "bg-destructive/10 text-destructive ring-destructive/25",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        PRIORITY_CLASS[priority],
      )}
    >
      <span aria-hidden="true">{priority === "critical" || priority === "high" ? "▲" : "■"}</span>
      {priority.charAt(0).toUpperCase() + priority.slice(1)} priority
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="surface-card p-5">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 font-display text-3xl font-extrabold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
