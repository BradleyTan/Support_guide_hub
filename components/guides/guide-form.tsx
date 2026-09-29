"use client";

import { useMemo, useState } from "react";
import { CopyCheck, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { SmartInput, type ExtractedField } from "@/components/shared/smart-input";
import { guides } from "@/lib/mock/guides";
import { searchGuides, shortProduct } from "@/lib/guide-utils";
import { CATEGORIES, PRODUCTS } from "@/lib/types";

interface FormState {
  title: string;
  product: string;
  version: string;
  module: string;
  category: string;
  symptom: string;
  errorMessage: string;
  cause: string;
  steps: string;
  prevention: string;
  tags: string;
}

const blank: FormState = { title: "", product: "", version: "", module: "", category: "", symptom: "", errorMessage: "", cause: "", steps: "", prevention: "", tags: "" };

/** What the AI would return for the sample note / screenshot. Mock only. */
const aiDraft: FormState = {
  title: "Server not found when opening account book after Windows update",
  product: "AutoCount Accounting",
  version: "2.2",
  module: "Database",
  category: "Installation & Database",
  symptom: "Workstations can't open the account book; the server PC was updated over the weekend.",
  errorMessage: "A network-related or instance-specific error occurred while establishing a connection to SQL Server.",
  cause: "Firewall profile switched to Public after the update, blocking SQL Server.",
  steps: "Set the server's network profile back to Private\nAllow TCP 1433 and UDP 1434 in the firewall\nCheck SQL Server Browser is running\nReopen the account book from a workstation",
  prevention: "Pause feature updates on the server PC.",
  tags: "sql-server, firewall, windows-update",
};

const screenshotFields: ExtractedField[] = [
  { label: "Error text", value: aiDraft.errorMessage },
  { label: "Product", value: "AutoCount Accounting" },
  { label: "Screen", value: "Open account book (login)", uncertain: true },
  { label: "Version shown", value: "2.2", uncertain: true },
];

const sampleNote =
  "sinar hw monday - all PCs cannot open acc book. server got windows update weekend. error network-related or instance-specific error... sql server. firewall profile became public. set back private + open 1433/1434, sql browser running. ok now. tell them pause updates";

function Field({ label, htmlFor, error, hint, children, className }: { label: string; htmlFor: string; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive" id={`${htmlFor}-err`}>
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function PickSelect({ id, value, onChange, options, placeholder }: { id: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string }) {
  return (
    <Select value={value || null} onValueChange={(v) => onChange(String(v ?? ""))}>
      <SelectTrigger id={id} className="w-full bg-card">
        <SelectValue placeholder={placeholder}>{(v: string | null) => options.find((o) => o.value === v)?.label ?? placeholder}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function GuideForm() {
  const [f, setF] = useState<FormState>(blank);
  const [drafting, setDrafting] = useState(false);
  const [fromAi, setFromAi] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const set = (k: keyof FormState) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const duplicate = useMemo(() => {
    if (f.title.trim().length < 8) return undefined;
    const top = searchGuides(guides, `${f.title} ${f.errorMessage}`)[0];
    return top && top.score >= 6 ? top.guide : undefined;
  }, [f.title, f.errorMessage]);

  function draftWithAi() {
    setDrafting(true);
    setTimeout(() => {
      setF(aiDraft);
      setFromAi(true);
      setDrafting(false);
      setErrors({});
    }, 1200);
  }

  function save() {
    const e: typeof errors = {};
    if (!f.title.trim()) e.title = "Give the guide a title so you can find it later.";
    if (!f.product) e.product = "Choose the product this applies to.";
    if (!f.steps.trim()) e.steps = "Add at least one fix step.";
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("A few fields need attention", { description: "Check the highlighted fields." });
      return;
    }
    toast.success("Guide saved (mock)", { description: "In the real app it gets the next number, e.g. G-1052." });
  }

  return (
    <>
      <PageHeader
        title="New guide"
        description="Write it yourself, or paste messy notes or a screenshot and let the AI draft it. Nothing is saved until you check it and select Save."
        howItWorks={
          <>
            The AI (Claude Sonnet) reads your notes or screenshot and fills the fields. It leaves anything it can’t read blank instead of guessing. Masked areas are removed before the image is sent. As you type a title, it checks for <strong>similar existing guides</strong> so you don’t duplicate one.
          </>
        }
      />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <section aria-labelledby="start-from" className="flex flex-col gap-3">
          <h2 id="start-from" className="text-sm font-medium">
            Start from notes or a screenshot
          </h2>
          <SmartInput
            label="Notes or screenshot"
            placeholder="Paste your notes, a WhatsApp chat or an error screenshot here…"
            defaultText={sampleNote}
            rows={6}
            extraction={screenshotFields}
            onUseExtraction={() => draftWithAi()}
            submitLabel={drafting ? "Drafting…" : "Draft guide with AI"}
            onSubmit={() => draftWithAi()}
          />
          {drafting && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" /> Reading your notes and filling the form…
            </p>
          )}
        </section>

        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          noValidate
        >
          {fromAi && (
            <p className="flex items-start gap-2 rounded-md bg-accent/60 px-3 py-2 text-sm text-accent-foreground">
              <Sparkles className="mt-0.5 size-4 shrink-0" /> Drafted by AI from your notes. Check each field before saving. The guide will be saved as unverified.
            </p>
          )}

          <Field label="Title" htmlFor="title" error={errors.title}>
            <Input id="title" value={f.title} onChange={(e) => set("title")(e.target.value)} aria-invalid={!!errors.title} placeholder="e.g. Invoice prints blank after moving to a new PC" className="bg-card" />
          </Field>

          {duplicate && (
            <div role="status" className="flex flex-wrap items-center gap-2 rounded-md border border-warning/40 bg-warning/[0.08] px-3 py-2 text-sm">
              <CopyCheck className="size-4 text-warning" />
              <span>
                A similar guide already exists: <span className="font-mono text-xs">{duplicate.id}</span> {duplicate.title}
              </span>
              <span className="ml-auto flex gap-2">
                <ButtonLink size="xs" variant="outline" href={`/guides/${duplicate.id}`}>
                  Open it
                </ButtonLink>
                <Button size="xs" variant="ghost" onClick={() => toast("Would add these notes to the existing guide as a new revision")}>
                  Add to it instead
                </Button>
              </span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product" htmlFor="product" error={errors.product}>
              <PickSelect id="product" value={f.product} onChange={set("product")} placeholder="Choose product" options={PRODUCTS.map((p) => ({ value: p, label: shortProduct(p) }))} />
            </Field>
            <Field label="Versions" htmlFor="version" hint="Comma-separated, e.g. 2.1, 2.2">
              <Input id="version" value={f.version} onChange={(e) => set("version")(e.target.value)} className="bg-card" />
            </Field>
            <Field label="Module" htmlFor="module">
              <Input id="module" value={f.module} onChange={(e) => set("module")(e.target.value)} placeholder="e.g. Bank Reconciliation" className="bg-card" />
            </Field>
            <Field label="Category" htmlFor="category">
              <PickSelect id="category" value={f.category} onChange={set("category")} placeholder="Choose category" options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
            </Field>
          </div>

          <Field label="Symptom" htmlFor="symptom" hint="What the user sees or reports.">
            <Textarea id="symptom" rows={2} value={f.symptom} onChange={(e) => set("symptom")(e.target.value)} className="bg-card" />
          </Field>
          <Field label="Error message" htmlFor="errorMessage" hint="Exact text, so search can match it later.">
            <Textarea id="errorMessage" rows={2} value={f.errorMessage} onChange={(e) => set("errorMessage")(e.target.value)} className="bg-card font-mono text-[13px]" />
          </Field>
          <Field label="Cause" htmlFor="cause">
            <Textarea id="cause" rows={2} value={f.cause} onChange={(e) => set("cause")(e.target.value)} className="bg-card" />
          </Field>
          <Field label="Fix steps" htmlFor="steps" error={errors.steps} hint="One step per line.">
            <Textarea id="steps" rows={5} value={f.steps} onChange={(e) => set("steps")(e.target.value)} aria-invalid={!!errors.steps} className="bg-card" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prevention" htmlFor="prevention">
              <Input id="prevention" value={f.prevention} onChange={(e) => set("prevention")(e.target.value)} className="bg-card" />
            </Field>
            <Field label="Tags" htmlFor="tags" hint="Comma-separated">
              <Input id="tags" value={f.tags} onChange={(e) => set("tags")(e.target.value)} className="bg-card" />
            </Field>
          </div>

          <div className="sticky bottom-16 z-10 -mx-1 flex flex-wrap gap-2 rounded-lg border bg-background/95 p-2 backdrop-blur lg:bottom-4">
            <Button type="submit">
              <Save /> Save guide
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setF(blank); setFromAi(false); setErrors({}); }}>
              Clear form
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
