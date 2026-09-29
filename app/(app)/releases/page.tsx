"use client";

import Link from "next/link";
import { History, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/shared/states";
import { useDemoState } from "@/components/shell/demo-state";
import { releaseNotes } from "@/lib/mock/library";
import { shortProduct } from "@/lib/guide-utils";
import type { ReleaseNote } from "@/lib/types";

const typeStyle: Record<ReleaseNote["type"], string> = {
  "Known issue": "bg-destructive/10 text-destructive ring-destructive/25",
  Fix: "bg-success/10 text-success ring-success/25",
  Note: "bg-info/10 text-info ring-info/25",
};

export default function ReleasesPage() {
  const { state } = useDemoState();
  const groups = Object.entries(
    releaseNotes.reduce<Record<string, ReleaseNote[]>>((acc, r) => {
      const k = `${r.product} ${r.version}`;
      (acc[k] ??= []).push(r);
      return acc;
    }, {}),
  );

  return (
    <>
      <PageHeader
        title="Versions & releases"
        description="Known issues and fixes you’ve noted per AutoCount version, linked to your guides."
        actions={
          <Button size="sm" onClick={() => toast("Add note form is mocked")}>
            <Plus /> Add note
          </Button>
        }
        howItWorks={
          <>
            Notes are your own. When you search, notes for the version in the query are shown alongside matching guides. Official release notes appear under <strong>Official sources</strong> in Search.
          </>
        }
      />
      {state === "loading" ? (
        <ListSkeleton rows={3} />
      ) : state === "error" ? (
        <ErrorState title="Couldn’t load release notes">Try again in a moment.</ErrorState>
      ) : state === "empty" ? (
        <EmptyState icon={History} title="No version notes yet">
          When you notice a problem that only affects one version, or a fix that arrived in an update, note it here so it shows up next to your guides.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {groups.map(([k, notes]) => (
            <section key={k} aria-labelledby={`v-${k}`}>
              <h2 id={`v-${k}`} className="mb-3 font-medium">
                {shortProduct(k)}
              </h2>
              <ul className="divide-y rounded-lg border bg-card">
                {notes.map((n) => (
                  <li key={n.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:gap-4">
                    <span className={cn("inline-flex h-5 w-fit shrink-0 items-center rounded-full px-2 text-xs font-medium ring-1 ring-inset", typeStyle[n.type])}>{n.type}</span>
                    <div className="flex-1">
                      <p className="font-medium">{n.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{n.detail}</p>
                    </div>
                    <div className="flex gap-2 text-sm">
                      {n.guideIds.map((id) => (
                        <Link key={id} href={`/guides/${id}`} className="font-mono text-xs text-primary hover:underline">
                          {id}
                        </Link>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
