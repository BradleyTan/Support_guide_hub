import { BadgeCheck, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

/** Whether the user has checked an article. */
export function ReviewedBadge({ reviewed, className }: { reviewed: boolean; className?: string }) {
  return reviewed ? (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 text-xs font-medium text-success ring-1 ring-success/25 ring-inset", className)}>
      <BadgeCheck className="size-3.5" /> Reviewed
    </span>
  ) : (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground ring-1 ring-border ring-inset", className)}>
      <CircleDashed className="size-3.5" /> Not reviewed yet
    </span>
  );
}
