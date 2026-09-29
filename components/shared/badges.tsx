import { BadgeCheck, CircleAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Confidence } from "@/lib/types";

const warnText = "text-[color-mix(in_oklch,var(--warning),var(--foreground)_35%)]";

/** Whether you have confirmed a guide's fix works. */
export function VerifiedBadge({ verified, className }: { verified: boolean; className?: string }) {
  return verified ? (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 text-xs font-medium text-success ring-1 ring-success/25 ring-inset", className)}>
      <BadgeCheck className="size-3.5" /> Verified
    </span>
  ) : (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-warning/12 px-2 text-xs font-medium ring-1 ring-warning/35 ring-inset", warnText, className)}>
      <CircleAlert className="size-3.5" /> Unverified
    </span>
  );
}

const confidenceStyle: Record<Confidence, string> = {
  High: "text-success ring-success/30 bg-success/10",
  Medium: `${warnText} ring-warning/35 bg-warning/12`,
  Low: "text-destructive ring-destructive/30 bg-destructive/10",
};

export function ConfidenceBadge({ level }: { level: Confidence }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium ring-1 ring-inset", confidenceStyle[level])}>
      <ShieldCheck className="size-3.5" /> {level} confidence
    </span>
  );
}

/** Marks an AutoCount menu path or claim not yet confirmed against official documentation. */
export function NeedsVerification({ className }: { className?: string }) {
  return (
    <span
      title="Not confirmed against official AutoCount documentation"
      className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-warning/12 px-2 text-[11px] font-medium ring-1 ring-warning/35 ring-inset", warnText, className)}
    >
      <CircleAlert className="size-3" /> Needs verification
    </span>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-5 items-center rounded bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">{children}</span>;
}

export function ProductLabel({ product }: { product: string }) {
  return <span className="text-xs text-muted-foreground">{product.replace("AutoCount ", "")}</span>;
}
