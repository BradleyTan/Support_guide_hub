"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, FileStack, Loader2, MessageSquareText, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import { Tag } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/states";
import { countTemplateUse, createTemplate, deleteTemplate, updateTemplate } from "@/app/(app)/templates/actions";
import { PLACEHOLDERS, TEMPLATE_KINDS, type TemplateInput } from "@/lib/templates";
import type { Template, TemplateKind } from "@/lib/types";

type Errors = Partial<Record<keyof TemplateInput, string>>;

function TemplateEditor({ open, onOpenChange, editing, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; editing: Template | null; onSaved: (id: string) => void }) {
  const [kind, setKind] = useState<TemplateKind>(editing?.kind ?? "Reply");
  const [title, setTitle] = useState(editing?.title ?? "");
  const [body, setBody] = useState(editing?.body ?? "");
  const [tags, setTags] = useState(editing?.tags.join(", ") ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, start] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function insert(key: string) {
    const el = bodyRef.current;
    const token = `{${key}}`;
    if (!el) return setBody((b) => b + token);
    const { selectionStart: a, selectionEnd: z } = el;
    const next = body.slice(0, a) + token + body.slice(z);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + token.length, a + token.length);
    });
  }

  function save() {
    const input = { kind, title, body, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) };
    start(async () => {
      const res = editing ? await updateTemplate(editing.id, input) : await createTemplate(input);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success(editing ? "Template saved" : "Template created");
      onSaved(editing ? editing.id : (res.data as { id: string }).id);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit template" : "New template"}</DialogTitle>
          <DialogDescription>Reply templates can use the placeholders below; they’re filled in from the guide when you make a reply.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <div className="grid gap-1.5">
              <Label htmlFor="tpl-kind">Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as TemplateKind)}>
                <SelectTrigger id="tpl-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tpl-title">Name</Label>
              <Input id="tpl-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!errors.title} maxLength={200} placeholder="e.g. Fix steps for a known issue" />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tpl-body">Text</Label>
            {kind === "Reply" && (
              <div className="flex flex-wrap gap-1" aria-label="Insert a placeholder">
                {PLACEHOLDERS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => insert(p.key)}
                    title={"hint" in p ? `${p.label} (${p.hint})` : p.label}
                    className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  >
                    {`{${p.key}}`}
                  </button>
                ))}
              </div>
            )}
            <Textarea
              id="tpl-body"
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              aria-invalid={!!errors.body}
              rows={10}
              className={cn("bg-card", kind === "SQL" && "font-mono text-[13px]")}
              placeholder={kind === "Reply" ? "Hi {contact},\n\nPlease follow these steps:\n{steps}\n\nRegards," : kind === "SQL" ? "-- Read-only check\nSELECT ..." : "- First check\n- Second check"}
            />
            {errors.body && <p className="text-xs text-destructive">{errors.body}</p>}
            {kind === "Reply" && <p className="text-xs text-muted-foreground">A line whose placeholders have nothing to fill in (for example no cause) is left out of the reply.</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tpl-tags">Tags</Label>
            <Input id="tpl-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma separated, e.g. email, closing" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} {editing ? "Save" : "Create template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TemplatesView({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<TemplateKind | "All">("All");
  const list = templates.filter((t) => kind === "All" || t.kind === kind);
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const selected = list.find((t) => t.id === selectedId) ?? list[0];
  const [editor, setEditor] = useState<{ open: boolean; editing: Template | null; key: number }>({ open: false, editing: null, key: 0 });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDelete] = useTransition();

  const openEditor = (editing: Template | null) => setEditor((e) => ({ open: true, editing, key: e.key + 1 }));

  function remove() {
    if (!selected) return;
    startDelete(async () => {
      const res = await deleteTemplate(selected.id);
      if (!res.ok) return void toast.error(res.error);
      setConfirmDelete(false);
      toast.success(`Deleted “${selected.title}”`);
      router.refresh();
    });
  }

  return (
    <>
      <PageHeader
        title="Templates & snippets"
        description="Replies, SQL queries and checklists you reuse often."
        actions={
          <Button size="sm" onClick={() => openEditor(null)}>
            <Plus /> New template
          </Button>
        }
        howItWorks={
          <>
            Reply templates are used by the Reply generator: placeholders such as <code className="font-mono text-xs">{"{contact}"}</code> and <code className="font-mono text-xs">{"{steps}"}</code> are filled in from the guide you choose. SQL snippets are stored as text only; the app never runs them against a client database.
          </>
        }
      />
      <TemplateEditor
        key={editor.key}
        open={editor.open}
        onOpenChange={(open) => setEditor((e) => ({ ...e, open }))}
        editing={editor.editing}
        onSaved={(id) => {
          setEditor((e) => ({ ...e, open: false }));
          setSelectedId(id);
          router.refresh();
        }}
      />
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{selected?.title}”?</DialogTitle>
            <DialogDescription>It’s removed from your templates and from the Reply generator.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={remove} disabled={deleting}>
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={kind} onValueChange={(v) => setKind(v as TemplateKind | "All")} className="mb-4">
        <TabsList>
          {(["All", ...TEMPLATE_KINDS] as const).map((k) => (
            <TabsTrigger key={k} value={k}>
              {k}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!selected ? (
        <EmptyState icon={FileStack} title={kind === "All" ? "No templates yet" : `No ${kind} templates yet`} action={<Button onClick={() => openEditor(null)}>Create a template</Button>}>
          Save replies you send often, handy SQL checks and checklists here. Without a reply template of your own, the Reply generator uses a standard layout.
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <ul className="space-y-1" aria-label="Templates">
            {list.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  aria-current={selected.id === t.id ? "true" : undefined}
                  className={cn("w-full rounded-md px-3 py-2 text-left transition-colors", selected.id === t.id ? "bg-accent text-accent-foreground" : "hover:bg-muted")}
                >
                  <span className="block text-sm font-medium">{t.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.kind} · used {t.uses}×
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <section className="min-w-0 rounded-lg border bg-card" aria-labelledby="tpl-heading">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
              <h2 id="tpl-heading" className="font-medium">
                {selected.title}
              </h2>
              <div className="flex flex-wrap gap-1">
                {selected.tags.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
              <div className="ml-auto flex flex-wrap gap-1">
                {selected.kind === "Reply" && (
                  <ButtonLink size="sm" variant="ghost" href={`/replies?template=${selected.id}`}>
                    <MessageSquareText /> Use in a reply
                  </ButtonLink>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard?.writeText(selected.body);
                    toast.success("Copied");
                    void countTemplateUse(selected.id);
                  }}
                >
                  <Copy /> Copy
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Edit template" onClick={() => openEditor(selected)}>
                  <Pencil />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Delete template" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 />
                </Button>
              </div>
            </div>
            <pre className={cn("overflow-x-auto p-4 text-sm leading-relaxed whitespace-pre-wrap", selected.kind === "SQL" && "font-mono text-[13px]")}>{selected.body}</pre>
          </section>
        </div>
      )}
    </>
  );
}
