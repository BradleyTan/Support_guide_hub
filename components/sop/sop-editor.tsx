"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ImageIcon, Loader2, Plus, Printer, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import { createSop, deleteSop, updateSop } from "@/app/(app)/sop/actions";
import { move, type SopImage, type SopInput, type SopStep } from "@/lib/sop";

const NO_IMAGE = "none";
type Errors = Partial<Record<keyof SopInput, string>>;

export function SopEditor({ code, initial, images }: { code?: string; initial: SopInput; images: SopImage[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [version, setVersion] = useState(initial.version);
  const [purpose, setPurpose] = useState(initial.purpose);
  const [scope, setScope] = useState(initial.scope);
  const [steps, setSteps] = useState<SopStep[]>(initial.steps.length ? initial.steps : [{ text: "", attachmentId: null }]);
  const [checks, setChecks] = useState<string[]>(initial.checks);
  const [errors, setErrors] = useState<Errors>({});
  const [dirty, setDirty] = useState(!code);
  const [saving, startSave] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDelete] = useTransition();

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setDirty(true);
  };
  const setStep = (i: number, patch: Partial<SopStep>) => touch(setSteps)(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const imageName = new Map(images.map((im) => [im.id, im.name]));

  function save() {
    const input: SopInput = {
      guideCode: initial.guideCode,
      title,
      version,
      purpose,
      scope,
      steps: steps.map((s) => ({ ...s, text: s.text.trim() })).filter((s) => s.text),
      checks: checks.map((c) => c.trim()).filter(Boolean),
    };
    startSave(async () => {
      const res = code ? await updateSop(code, input) : await createSop(input);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      setErrors({});
      setDirty(false);
      if (code) {
        toast.success("SOP saved");
        router.refresh();
      } else {
        const newCode = (res.data as { code: string }).code;
        toast.success(`Saved as ${newCode}`);
        router.replace(`/sop/${newCode}`);
      }
    });
  }

  function remove() {
    startDelete(async () => {
      const res = await deleteSop(code!);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${code} deleted`);
      router.push("/sop");
    });
  }

  return (
    <>
      <PageHeader
        title={code ? `${code}: edit SOP` : "New SOP"}
        description={initial.guideCode ? `Built from guide ${initial.guideCode}. Changes here don’t change the guide.` : "Changes here don’t change any guide."}
        actions={
          <>
            {code && (
              <ButtonLink size="sm" variant="outline" href={`/sop/${code}/print`} aria-disabled={dirty} onClick={(e) => dirty && (e.preventDefault(), toast("Save your changes first, so the PDF shows them."))}>
                <Printer /> Print / Save as PDF
              </ButtonLink>
            )}
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />} {code ? "Save" : "Save SOP"}
            </Button>
          </>
        }
      />

      <div className="flex max-w-3xl flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <div className="grid gap-1.5">
            <Label htmlFor="sop-title">Title</Label>
            <Input id="sop-title" value={title} onChange={(e) => touch(setTitle)(e.target.value)} aria-invalid={!!errors.title} maxLength={300} className="bg-card" />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sop-version">AutoCount version</Label>
            <Input id="sop-version" value={version} onChange={(e) => touch(setVersion)(e.target.value)} maxLength={100} className="bg-card" />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sop-purpose">Purpose</Label>
          <Textarea id="sop-purpose" value={purpose} onChange={(e) => touch(setPurpose)(e.target.value)} rows={2} maxLength={2000} className="bg-card" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sop-scope">Applies to</Label>
          <Input id="sop-scope" value={scope} onChange={(e) => touch(setScope)(e.target.value)} maxLength={2000} className="bg-card" placeholder="e.g. AutoCount Accounting 2.1, e-Invoice" />
        </div>

        <section aria-labelledby="sop-steps" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 id="sop-steps" className="font-medium">
              Steps
            </h2>
            {images.length === 0 && initial.guideCode && <span className="text-xs text-muted-foreground">Attach screenshots to {initial.guideCode} to add them under steps.</span>}
          </div>
          {errors.steps && <p className="text-xs text-destructive">{errors.steps}</p>}
          <ol className="flex flex-col gap-3">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3 rounded-lg border bg-card p-3">
                <span className="num mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">{i + 1}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Label htmlFor={`step-${i}`} className="sr-only">
                    Step {i + 1}
                  </Label>
                  <Textarea id={`step-${i}`} value={s.text} onChange={(e) => setStep(i, { text: e.target.value })} rows={2} maxLength={2000} placeholder="What to do in this step" />
                  {images.length > 0 && (
                    <div className="flex items-center gap-2">
                      <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
                      <Select value={s.attachmentId ?? NO_IMAGE} onValueChange={(v) => setStep(i, { attachmentId: v === NO_IMAGE ? null : String(v) })}>
                        <SelectTrigger size="sm" className="min-w-0 flex-1 sm:max-w-xs" aria-label={`Screenshot for step ${i + 1}`}>
                          <SelectValue>{(v: string) => (v === NO_IMAGE ? "No screenshot" : (imageName.get(v) ?? "Screenshot removed from guide"))}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_IMAGE}>No screenshot</SelectItem>
                          {images.map((im) => (
                            <SelectItem key={im.id} value={im.id}>
                              {im.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {s.attachmentId && images.find((im) => im.id === s.attachmentId)?.url && (
                    // eslint-disable-next-line @next/next/no-img-element -- private, short-lived storage link
                    <img src={images.find((im) => im.id === s.attachmentId)!.url!} alt={`Screenshot for step ${i + 1}`} className="max-h-48 w-fit rounded border object-contain" />
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-0.5">
                  <Button size="icon-xs" variant="ghost" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => touch(setSteps)(move(steps, i, -1))}>
                    <ArrowUp />
                  </Button>
                  <Button size="icon-xs" variant="ghost" aria-label={`Move step ${i + 1} down`} disabled={i === steps.length - 1} onClick={() => touch(setSteps)(move(steps, i, 1))}>
                    <ArrowDown />
                  </Button>
                  <Button size="icon-xs" variant="ghost" aria-label={`Delete step ${i + 1}`} disabled={steps.length === 1} onClick={() => touch(setSteps)(steps.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
          <Button variant="outline" className="w-fit" disabled={steps.length >= 50} onClick={() => touch(setSteps)([...steps, { text: "", attachmentId: null }])}>
            <Plus /> Add step
          </Button>
        </section>

        <section aria-labelledby="sop-checks" className="flex flex-col gap-3">
          <h2 id="sop-checks" className="font-medium">
            Checks at the end
          </h2>
          <p className="-mt-2 text-xs text-muted-foreground">Things the client confirms once the steps are done, e.g. “Invoice prints with all lines”.</p>
          {checks.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <Label htmlFor={`check-${i}`} className="sr-only">
                Check {i + 1}
              </Label>
              <Input id={`check-${i}`} value={c} onChange={(e) => touch(setChecks)(checks.map((x, j) => (j === i ? e.target.value : x)))} maxLength={500} className="bg-card" />
              <Button size="icon-sm" variant="ghost" aria-label={`Remove check ${i + 1}`} onClick={() => touch(setChecks)(checks.filter((_, j) => j !== i))}>
                <X />
              </Button>
            </div>
          ))}
          <Button variant="outline" className="w-fit" disabled={checks.length >= 30} onClick={() => touch(setChecks)([...checks, ""])}>
            <Plus /> Add check
          </Button>
        </section>

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} {code ? "Save" : "Save SOP"}
          </Button>
          {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
          {code && (
            <Button variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Delete SOP
            </Button>
          )}
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {code}?</DialogTitle>
            <DialogDescription>The SOP is removed. The guide it was built from isn’t affected.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={remove} disabled={deleting}>
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
