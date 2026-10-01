"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenCheck, Plus } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { formatDate } from "@/lib/format";
import type { Sop } from "@/lib/sop";
import type { Guide } from "@/lib/types";

export function SopList({ sops, guides }: { sops: Sop[]; guides: Guide[] }) {
  const router = useRouter();
  const [guide, setGuide] = useState(guides[0]?.id ?? "");
  const labels = new Map(guides.map((g) => [g.id, `${g.id} · ${g.title}`]));

  return (
    <>
      <PageHeader
        title="SOP builder"
        description="Step-by-step procedures for clients, built from a guide and saved as a PDF."
        howItWorks={
          <>
            Start from a guide: its fix steps become the SOP’s steps, and its product, version and module the scope. Edit the wording, reorder steps, add a screenshot from the guide under any step, and list the checks to do at the end. SOPs are saved to your account; <strong>Print / Save as PDF</strong> opens a clean page for your browser’s “Save as PDF”.
          </>
        }
      />

      {guides.length === 0 ? (
        <EmptyState icon={BookOpenCheck} title="You need a guide first" action={<ButtonLink href="/guides/new">Write a guide</ButtonLink>}>
          An SOP starts from a guide’s fix steps.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          <form
            className="flex flex-col gap-2 rounded-lg border bg-card p-4 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (guide) router.push(`/sop/new?guide=${guide}`);
            }}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Label htmlFor="sop-guide">New SOP from guide</Label>
              <Select value={guide} onValueChange={(v) => setGuide(String(v))}>
                <SelectTrigger id="sop-guide" className="w-full">
                  <SelectValue>{(v: string) => <span className="truncate">{labels.get(v)}</span>}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {guides.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.id} · {g.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">
              <Plus /> Create SOP
            </Button>
          </form>

          <section aria-labelledby="saved-sops">
            <h2 id="saved-sops" className="mb-2 text-sm font-medium">
              Saved SOPs ({sops.length})
            </h2>
            {sops.length === 0 ? (
              <p className="rounded-lg border border-dashed bg-card px-4 py-6 text-center text-sm text-muted-foreground">No SOPs yet. Choose a guide above to make the first one.</p>
            ) : (
              <ul className="divide-y rounded-lg border bg-card">
                {sops.map((s) => (
                  <li key={s.id}>
                    <Link href={`/sop/${s.id}`} className="group block px-4 py-3 transition-colors hover:bg-muted/60">
                      <span className="block text-sm font-medium group-hover:underline">{s.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {s.id} · {s.steps.length} step{s.steps.length === 1 ? "" : "s"}
                        {s.guideCode && ` · from ${s.guideCode}`} · updated {formatDate(s.updatedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
