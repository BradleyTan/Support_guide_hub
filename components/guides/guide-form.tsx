"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CopyCheck, FileText, ImagePlus, Loader2, Save, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { AttachmentList } from "@/components/guides/attachments";
import { createGuide, findSimilarGuides, updateGuide, addAttachment } from "@/app/(app)/guides/actions";
import { splitLines, splitTags, type GuideInput } from "@/lib/guide-schema";
import { shortProduct } from "@/lib/guide-utils";
import { ACCEPTED_TYPES, MAX_FILES, validateFile } from "@/lib/files";
import { uploadAttachment } from "@/lib/upload";
import { CATEGORIES, PRODUCTS, type Attachment } from "@/lib/types";

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

type Errors = Partial<Record<keyof FormState, string>>;

const blank: FormState = { title: "", product: "", version: "", module: "", category: "", symptom: "", errorMessage: "", cause: "", steps: "", prevention: "", tags: "" };

function toFormState(g: GuideInput): FormState {
  return { ...g, category: g.category ?? "", steps: g.steps.join("\n"), tags: g.tags.join(", ") };
}

function toInput(f: FormState) {
  return {
    ...f,
    product: f.product || undefined,
    category: f.category || null,
    steps: splitLines(f.steps),
    tags: splitTags(f.tags),
  };
}

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

function PickSelect({ id, value, onChange, options, placeholder, invalid }: { id: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string; invalid?: boolean }) {
  return (
    <Select value={value || null} onValueChange={(v) => onChange(String(v ?? ""))}>
      <SelectTrigger id={id} className="w-full bg-card" aria-invalid={invalid}>
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

/** Files picked on a new guide; uploaded right after the guide is created. */
function PendingFiles({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={files.length >= MAX_FILES}>
          <ImagePlus /> Add screenshot or PDF
        </Button>
        <span className="text-xs text-muted-foreground">PNG, JPG, WEBP or PDF, up to 10 MB each. Large screenshots are shrunk automatically.</span>
      </div>
      <input
        ref={ref}
        type="file"
        hidden
        multiple
        accept={ACCEPTED_TYPES.join(",")}
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          const errs = picked.map(validateFile).filter((x): x is string => !!x);
          const ok = picked.filter((f) => !validateFile(f)).slice(0, MAX_FILES - files.length);
          setErrors(errs);
          onChange([...files, ...ok]);
          e.target.value = "";
        }}
      />
      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 text-sm text-destructive">
          {errors.map((m) => (
            <li key={m} className="flex items-start gap-1.5">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {m}
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Files to attach">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm">
              {f.type === "application/pdf" ? <FileText className="size-4 text-muted-foreground" /> : <ImagePlus className="size-4 text-muted-foreground" />}
              <span className="max-w-48 truncate">{f.name}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function GuideForm({
  mode,
  userId,
  code,
  guideDbId,
  initial,
  prefillTitle,
  attachments = [],
}: {
  mode: "create" | "edit";
  userId: string;
  code?: string;
  guideDbId?: string;
  initial?: GuideInput;
  /** New guide only: e.g. a search with no matching guide, from Insights. */
  prefillTitle?: string;
  attachments?: Attachment[];
}) {
  const router = useRouter();
  const [f, setF] = useState<FormState>(initial ? toFormState(initial) : { ...blank, title: prefillTitle ?? "" });
  const [errors, setErrors] = useState<Errors>({});
  const [files, setFiles] = useState<File[]>([]);
  const [similar, setSimilar] = useState<{ code: string; title: string }[]>([]);
  const [saving, startSaving] = useTransition();
  const set = (k: keyof FormState) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  // Duplicate check against saved guides, a moment after typing stops.
  useEffect(() => {
    const title = f.title.trim();
    if (title.length < 8) return;
    const t = setTimeout(async () => setSimilar(await findSimilarGuides(title, f.errorMessage, code)), 450);
    return () => clearTimeout(t);
  }, [f.title, f.errorMessage, code]);
  const shownSimilar = f.title.trim().length < 8 ? [] : similar;

  function save() {
    startSaving(async () => {
      const input = toInput(f);
      const res = mode === "create" ? await createGuide(input) : await updateGuide(code!, input);
      if (!res.ok) {
        setErrors((res.fieldErrors as Errors) ?? {});
        toast.error(res.error);
        return;
      }
      setErrors({});
      const saved = mode === "create" ? (res.data as { id: string; code: string }) : { id: guideDbId!, code: code! };
      let failed = 0;
      for (const file of files) {
        try {
          const meta = await uploadAttachment(userId, saved.id, file);
          const linked = await addAttachment(saved.code, meta);
          if (!linked.ok) failed++;
        } catch {
          failed++;
        }
      }
      if (failed) toast.error(`${failed} file${failed > 1 ? "s" : ""} couldn’t be attached. Open the guide and try again.`);
      toast.success(mode === "create" ? `Saved as ${saved.code}` : "Changes saved");
      router.push(`/guides/${saved.code}`);
    });
  }

  return (
    <>
      <PageHeader
        title={mode === "create" ? "New guide" : `Edit ${code}`}
        description={mode === "create" ? "Record a fix or how-to so you can find it next time. New guides start as unverified." : "Changes are saved to the guide’s edit history."}
      />

      <form
        className="flex max-w-3xl flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        noValidate
      >
        <Field label="Title" htmlFor="title" error={errors.title}>
          <Input id="title" value={f.title} onChange={(e) => set("title")(e.target.value)} aria-invalid={!!errors.title} placeholder="e.g. Invoice prints blank after moving to a new PC" className="bg-card" maxLength={300} />
        </Field>

        {shownSimilar.length > 0 && (
          <div role="status" className="flex flex-col gap-2 rounded-md border border-warning/40 bg-warning/[0.08] px-3 py-2 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <CopyCheck className="size-4 text-warning" /> Similar guides already exist
            </p>
            <ul className="space-y-1">
              {shownSimilar.map((s) => (
                <li key={s.code}>
                  <Link href={`/guides/${s.code}`} target="_blank" className="hover:underline">
                    <span className="font-mono text-xs text-muted-foreground">{s.code}</span> {s.title}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">If it’s the same problem, consider editing that guide instead.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product" htmlFor="product" error={errors.product}>
            <PickSelect id="product" value={f.product} onChange={set("product")} placeholder="Choose product" invalid={!!errors.product} options={PRODUCTS.map((p) => ({ value: p, label: shortProduct(p) }))} />
          </Field>
          <Field label="Versions" htmlFor="version" error={errors.version} hint="e.g. 2.1, 2.2">
            <Input id="version" value={f.version} onChange={(e) => set("version")(e.target.value)} className="bg-card" maxLength={100} />
          </Field>
          <Field label="Module" htmlFor="module" error={errors.module}>
            <Input id="module" value={f.module} onChange={(e) => set("module")(e.target.value)} placeholder="e.g. Bank Reconciliation" className="bg-card" maxLength={100} />
          </Field>
          <Field label="Category" htmlFor="category">
            <PickSelect id="category" value={f.category} onChange={set("category")} placeholder="Choose category (optional)" options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Field>
        </div>

        <Field label="Symptom" htmlFor="symptom" error={errors.symptom} hint="What the user sees or reports.">
          <Textarea id="symptom" rows={2} value={f.symptom} onChange={(e) => set("symptom")(e.target.value)} className="bg-card" />
        </Field>
        <Field label="Error message" htmlFor="errorMessage" error={errors.errorMessage} hint="Exact text, so search can match it later.">
          <Textarea id="errorMessage" rows={2} value={f.errorMessage} onChange={(e) => set("errorMessage")(e.target.value)} className="bg-card font-mono text-[13px]" />
        </Field>
        <Field label="Cause" htmlFor="cause" error={errors.cause}>
          <Textarea id="cause" rows={2} value={f.cause} onChange={(e) => set("cause")(e.target.value)} className="bg-card" />
        </Field>
        <Field label="Fix steps" htmlFor="steps" error={errors.steps} hint="One step per line. Numbers or bullets at the start are removed.">
          <Textarea id="steps" rows={6} value={f.steps} onChange={(e) => set("steps")(e.target.value)} aria-invalid={!!errors.steps} className="bg-card" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prevention" htmlFor="prevention" error={errors.prevention}>
            <Input id="prevention" value={f.prevention} onChange={(e) => set("prevention")(e.target.value)} className="bg-card" />
          </Field>
          <Field label="Tags" htmlFor="tags" hint="Comma-separated, e.g. sst, bank-recon">
            <Input id="tags" value={f.tags} onChange={(e) => set("tags")(e.target.value)} className="bg-card" />
          </Field>
        </div>

        <section aria-labelledby="att-h" className="flex flex-col gap-2">
          <h2 id="att-h" className="text-sm font-medium">
            Attachments
          </h2>
          {mode === "create" ? <PendingFiles files={files} onChange={setFiles} /> : <AttachmentList code={code!} guideDbId={guideDbId!} userId={userId} attachments={attachments} />}
        </section>

        <div className="sticky bottom-16 z-10 -mx-1 flex flex-wrap gap-2 rounded-lg border bg-background/95 p-2 backdrop-blur lg:bottom-4">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} {mode === "create" ? "Save guide" : "Save changes"}
          </Button>
          <ButtonLink variant="ghost" href={mode === "create" ? "/guides" : `/guides/${code}`}>
            Cancel
          </ButtonLink>
        </div>
      </form>
    </>
  );
}
