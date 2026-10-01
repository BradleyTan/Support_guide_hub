"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { History, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { createReleaseNote, deleteReleaseNote, updateReleaseNote } from "@/app/(app)/releases/actions";
import { RELEASE_NOTE_TYPES, compareVersionsDesc, type ReleaseNoteInput } from "@/lib/release-notes";
import { shortProduct } from "@/lib/guide-utils";
import { PRODUCTS, type Product, type ReleaseNote } from "@/lib/types";

const typeStyle: Record<ReleaseNote["type"], string> = {
  "Known issue": "bg-destructive/10 text-destructive ring-destructive/25",
  Fix: "bg-success/10 text-success ring-success/25",
  Note: "bg-info/10 text-info ring-info/25",
};

const ALL = "all";
type GuideRef = { id: string; title: string };
type Errors = Partial<Record<keyof ReleaseNoteInput, string>>;

function NoteEditor({ open, onOpenChange, editing, guides, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; editing: ReleaseNote | null; guides: GuideRef[]; onSaved: () => void }) {
  const [product, setProduct] = useState<string>(editing?.product ?? "");
  const [version, setVersion] = useState(editing?.version ?? "");
  const [type, setType] = useState<ReleaseNote["type"]>(editing?.type ?? "Known issue");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [detail, setDetail] = useState(editing?.detail ?? "");
  const [linked, setLinked] = useState<string[]>(editing?.guideIds ?? []);
  const [filter, setFilter] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, start] = useTransition();
  const shown = guides.filter((g) => !filter.trim() || `${g.id} ${g.title}`.toLowerCase().includes(filter.trim().toLowerCase())).slice(0, 50);

  function save() {
    const input = { product, version, type, title, detail, guideCodes: linked };
    start(async () => {
      const res = editing ? await updateReleaseNote(editing.id, input) : await createReleaseNote(input);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success(editing ? "Note saved" : "Note added");
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit version note" : "Add version note"}</DialogTitle>
          <DialogDescription>Something you noticed in one AutoCount version: a known issue, a fix that arrived in an update, or a general note.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[65vh] gap-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="rn-product">Product</Label>
              <Select value={product} onValueChange={(v) => setProduct(String(v))}>
                <SelectTrigger id="rn-product" className="w-full" aria-invalid={!!errors.product}>
                  <SelectValue>{(v: string) => (v ? shortProduct(v) : "Choose…")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PRODUCTS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {shortProduct(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.product && <p className="text-xs text-destructive">{errors.product}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rn-version">Version</Label>
              <Input id="rn-version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="e.g. 2.2" maxLength={50} aria-invalid={!!errors.version} />
              {errors.version && <p className="text-xs text-destructive">{errors.version}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rn-type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as ReleaseNote["type"])}>
                <SelectTrigger id="rn-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELEASE_NOTE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rn-title">Title</Label>
            <Input id="rn-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} aria-invalid={!!errors.title} />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rn-detail">Detail</Label>
            <Textarea id="rn-detail" value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} maxLength={4000} />
          </div>
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">Linked guides ({linked.length})</legend>
            {guides.length === 0 ? (
              <p className="text-xs text-muted-foreground">You have no guides to link yet.</p>
            ) : (
              <>
                <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter guides" aria-label="Filter guides to link" />
                <ul className="max-h-48 overflow-y-auto rounded-md border bg-card p-1">
                  {shown.map((g) => (
                    <li key={g.id}>
                      <label className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                        <input
                          type="checkbox"
                          className="mt-1 accent-(--primary)"
                          checked={linked.includes(g.id)}
                          onChange={(e) => setLinked((l) => (e.target.checked ? [...l, g.id] : l.filter((x) => x !== g.id)))}
                        />
                        <span>
                          <span className="font-mono text-xs text-muted-foreground">{g.id}</span> {g.title}
                        </span>
                      </label>
                    </li>
                  ))}
                  {shown.length === 0 && <li className="px-2 py-1.5 text-sm text-muted-foreground">No guides match.</li>}
                </ul>
              </>
            )}
            {errors.guideCodes && <p className="text-xs text-destructive">{errors.guideCodes}</p>}
          </fieldset>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} {editing ? "Save" : "Add note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReleasesView({ releaseNotes, guides }: { releaseNotes: ReleaseNote[]; guides: GuideRef[] }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | typeof ALL>(ALL);
  const [editor, setEditor] = useState<{ open: boolean; editing: ReleaseNote | null; key: number }>({ open: false, editing: null, key: 0 });
  const [toDelete, setToDelete] = useState<ReleaseNote | null>(null);
  const [deleting, startDelete] = useTransition();
  const openEditor = (editing: ReleaseNote | null) => setEditor((e) => ({ open: true, editing, key: e.key + 1 }));

  const groups = useMemo(() => {
    const list = releaseNotes.filter((r) => product === ALL || r.product === product);
    const map = new Map<string, { product: Product; version: string; notes: ReleaseNote[] }>();
    for (const r of list) {
      const k = `${r.product}|${r.version}`;
      if (!map.has(k)) map.set(k, { product: r.product, version: r.version, notes: [] });
      map.get(k)!.notes.push(r);
    }
    return [...map.values()].sort((a, b) => compareVersionsDesc(a.version, b.version) || a.product.localeCompare(b.product));
  }, [releaseNotes, product]);

  function remove() {
    if (!toDelete) return;
    startDelete(async () => {
      const res = await deleteReleaseNote(toDelete.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Note deleted");
      setToDelete(null);
      router.refresh();
    });
  }

  return (
    <>
      <PageHeader
        title="Versions & releases"
        description="Known issues and fixes you’ve noted per AutoCount version, linked to your guides."
        actions={
          <Button size="sm" onClick={() => openEditor(null)}>
            <Plus /> Add note
          </Button>
        }
        howItWorks={
          <>
            These notes are your own record of what changed or broke in each AutoCount version. Link a note to the guides it affects; the guide page then lists the note. For AutoCount’s official release notes, search the help centres from Search.
          </>
        }
      />
      <NoteEditor
        key={editor.key}
        open={editor.open}
        onOpenChange={(open) => setEditor((e) => ({ ...e, open }))}
        editing={editor.editing}
        guides={guides}
        onSaved={() => {
          setEditor((e) => ({ ...e, open: false }));
          router.refresh();
        }}
      />
      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this note?</DialogTitle>
            <DialogDescription>“{toDelete?.title}” is removed. Linked guides aren’t affected.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={remove} disabled={deleting}>
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {releaseNotes.length === 0 ? (
        <EmptyState icon={History} title="No version notes yet" action={<Button onClick={() => openEditor(null)}>Add a note</Button>}>
          When you notice a problem that only affects one version, or a fix that arrived in an update, note it here and link it to your guides.
        </EmptyState>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-1.5" role="group" aria-label="Filter by product">
            {[ALL, ...PRODUCTS].map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={product === p}
                onClick={() => setProduct(p as Product | typeof ALL)}
                className={cn("h-7 rounded-full border px-3 text-xs transition-colors", product === p ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}
              >
                {p === ALL ? "All products" : shortProduct(p)}
              </button>
            ))}
          </div>
          {groups.length === 0 && <p className="text-sm text-muted-foreground">No notes for this product yet.</p>}
          <div className="space-y-8">
            {groups.map((grp) => {
              const id = `v-${grp.product}-${grp.version}`.replace(/\W+/g, "-");
              return (
                <section key={id} aria-labelledby={id}>
                  <h2 id={id} className="mb-3 font-medium">
                    {shortProduct(grp.product)} {grp.version}
                  </h2>
                  <ul className="divide-y rounded-lg border bg-card">
                    {grp.notes.map((n) => (
                      <li key={n.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:gap-4">
                        <span className={cn("inline-flex h-5 w-fit shrink-0 items-center rounded-full px-2 text-xs font-medium ring-1 ring-inset", typeStyle[n.type])}>{n.type}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{n.title}</p>
                          {n.detail && <p className="mt-0.5 text-sm whitespace-pre-line text-muted-foreground">{n.detail}</p>}
                          {n.guideIds.length > 0 && (
                            <p className="mt-1.5 flex flex-wrap gap-2">
                              {n.guideIds.map((gid) => (
                                <Link key={gid} href={`/guides/${gid}`} className="font-mono text-xs text-primary hover:underline">
                                  {gid}
                                </Link>
                              ))}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button size="icon-sm" variant="ghost" aria-label={`Edit note: ${n.title}`} onClick={() => openEditor(n)}>
                            <Pencil />
                          </Button>
                          <Button size="icon-sm" variant="ghost" aria-label={`Delete note: ${n.title}`} className="text-destructive hover:text-destructive" onClick={() => setToDelete(n)}>
                            <Trash2 />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
