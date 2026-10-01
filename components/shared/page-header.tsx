"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  description,
  actions,
  howItWorks,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Short dismissible note explaining how this screen works. */
  howItWorks?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {howItWorks && <HowThisWorks>{howItWorks}</HowThisWorks>}
    </div>
  );
}

export function HowThisWorks({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <Info className="size-3.5" /> How this works
      </button>
    );
  }
  return (
    <aside aria-label="How this works" className="relative flex gap-3 rounded-lg border border-info/25 bg-info/[0.06] p-3 pr-10 text-sm">
      <Info className="mt-0.5 size-4 shrink-0 text-info" />
      <div className="space-y-1">
        <p className="font-medium">How this works</p>
        <div className="max-w-[80ch] text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground">{children}</div>
      </div>
      <Button variant="ghost" size="icon-xs" className="absolute top-2 right-2" aria-label="Hide note" onClick={() => setOpen(false)}>
        <X />
      </Button>
    </aside>
  );
}
