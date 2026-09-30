"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, FileDown, ImagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { ButtonLink } from "@/components/ui/button";
import { formatDate, now } from "@/lib/format";
import type { Guide } from "@/lib/types";
import { BookOpenCheck } from "lucide-react";

export function SopBuilder({ guides, initialGuide }: { guides: Guide[]; initialGuide?: string }) {
  if (guides.length === 0)
    return (
      <>
        <PageHeader title="SOP builder" description="Turn a guide into a step-by-step procedure you can hand to a client or a colleague as a PDF." />
        <EmptyState icon={BookOpenCheck} title="You need a guide first" action={<ButtonLink href="/guides/new">Write a guide</ButtonLink>}>
          SOPs are built from your guides. Write one, or load the sample data from the Home page.
        </EmptyState>
      </>
    );
  return <SopEditor guides={guides} initialGuide={initialGuide} />;
}

function SopEditor({ guides, initialGuide }: { guides: Guide[]; initialGuide?: string }) {
  const getGuide = (id: string) => guides.find((x) => x.id === id);
  const [guideId, setGuideId] = useState(getGuide(initialGuide ?? "") ? initialGuide! : guides[0].id);
  const g = getGuide(guideId)!;
  const [title, setTitle] = useState(`SOP: ${g.title}`);
  const [steps, setSteps] = useState(g.steps.map((s) => ({ text: s, shot: false })));

  function pick(id: string) {
    const ng = getGuide(id)!;
    setGuideId(id);
    setTitle(`SOP: ${ng.title}`);
    setSteps(ng.steps.map((s) => ({ text: s, shot: false })));
  }

  function move(i: number, d: -1 | 1) {
    setSteps((s) => {
      const n = [...s];
      [n[i], n[i + d]] = [n[i + d], n[i]];
      return n;
    });
  }

  return (
    <>
      <PageHeader
        title="SOP builder"
        description="Turn a guide into a step-by-step procedure you can hand to a client or a colleague as a PDF."
        howItWorks={
          <>
            The AI rewrites the guide’s fix as numbered, client-safe steps and adds a purpose, scope and checks. You can edit, reorder and attach screenshots to any step. <strong>Export PDF</strong> produces a formatted document with the version and date.
          </>
        }
        actions={
          <Button onClick={() => toast("PDF export is mocked", { description: `Would download “${title}.pdf”.` })}>
            <FileDown /> Export PDF
          </Button>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sop-guide">From guide</Label>
            <Select value={guideId} onValueChange={(v) => pick(String(v))}>
              <SelectTrigger id="sop-guide" className="w-full bg-card">
                <SelectValue>{(v: string) => <span className="truncate">{`${v} · ${getGuide(v)?.title}`}</span>}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {guides.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.id} · {x.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sop-title">SOP title</Label>
            <Input id="sop-title" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-card" />
          </div>
          <Button variant="outline" onClick={() => setSteps((s) => [...s, { text: "New step", shot: false }])}>
            <Plus /> Add step
          </Button>
        </div>

        {
          <article aria-label="SOP preview" className="mx-auto w-full max-w-3xl rounded-lg border bg-card p-6 shadow-[0_1px_3px_oklch(0_0_0/0.06)] sm:p-10">
            <header className="border-b pb-4">
              <p className="text-xs text-muted-foreground">
                Standard operating procedure · v1.0 · {formatDate(now().toISOString())}
              </p>
              <h2 className="mt-1 text-xl font-semibold">{title}</h2>
              <dl className="mt-3 grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Applies to</dt>
                <dd>
                  {g.product} {g.version} · {g.module}
                </dd>
                <dt className="text-muted-foreground">Purpose</dt>
                <dd>{g.symptom}</dd>
              </dl>
            </header>
            <ol className="mt-6 space-y-4">
              {steps.map((s, i) => (
                <li key={i} className="group flex gap-3">
                  <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">{i + 1}</span>
                  <div className="flex-1 space-y-2">
                    <Input
                      value={s.text}
                      aria-label={`Step ${i + 1}`}
                      onChange={(e) => setSteps((p) => p.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                      className="border-transparent bg-transparent px-1 shadow-none hover:border-input focus-visible:border-ring dark:bg-transparent"
                    />
                    {s.shot && <div className="flex h-24 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">Screenshot for step {i + 1}</div>}
                  </div>
                  <div className="flex shrink-0 items-start gap-0.5 opacity-60 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    <Button size="icon-xs" variant="ghost" aria-label="Attach screenshot" onClick={() => setSteps((p) => p.map((x, j) => (j === i ? { ...x, shot: !x.shot } : x)))}>
                      <ImagePlus />
                    </Button>
                    <Button size="icon-xs" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp />
                    </Button>
                    <Button size="icon-xs" variant="ghost" aria-label="Move down" disabled={i === steps.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown />
                    </Button>
                    <Button size="icon-xs" variant="ghost" aria-label="Delete step" onClick={() => setSteps((p) => p.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
            {g.prevention && (
              <section className="mt-8 border-t pt-4 text-sm">
                <h3 className="font-medium">Afterwards</h3>
                <p className="mt-1 text-muted-foreground">{g.prevention}</p>
              </section>
            )}
          </article>
        }
      </div>
    </>
  );
}
