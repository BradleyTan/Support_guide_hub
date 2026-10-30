"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import { useIsOwner } from "@/components/shell/team-context";
import { createArticle, updateArticle } from "@/app/(app)/knowledge/actions";
import { KNOWLEDGE_CATEGORIES, type ArticleInput, type KnowledgeArticle, type KnowledgeCategory, type Source } from "@/lib/knowledge/model";

type Errors = Partial<Record<keyof ArticleInput, string>>;

/** "Label | https://…" per line; a line with only a link uses the link as its label. */
function parseSources(text: string): Source[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.lastIndexOf("|");
      return i < 0 ? { label: l, url: l } : { label: l.slice(0, i).trim(), url: l.slice(i + 1).trim() };
    });
}

const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ArticleForm({ article, relatedOptions }: { article?: KnowledgeArticle; relatedOptions: { slug: string; title: string }[] }) {
  const router = useRouter();
  const isOwner = useIsOwner();
  const [title, setTitle] = useState(article?.title ?? "");
  const [category, setCategory] = useState<KnowledgeCategory>(article?.category ?? "Basics");
  const [tellCustomer, setTellCustomer] = useState(article?.tellCustomer ?? "");
  const [whatItIs, setWhatItIs] = useState(article?.whatItIs ?? "");
  const [example, setExample] = useState(article?.example ?? "");
  const [desktopSteps, setDesktopSteps] = useState(article?.desktopSteps ?? "");
  const [cloudSteps, setCloudSteps] = useState(article?.cloudSteps ?? "");
  const [mistakes, setMistakes] = useState(article?.mistakes.join("\n") ?? "");
  const [related, setRelated] = useState<string[]>(article?.related ?? []);
  const [sources, setSources] = useState(article?.sources.map((s) => `${s.label} | ${s.url}`).join("\n") ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, start] = useTransition();

  function save() {
    const input = { title, category, tellCustomer, whatItIs, example, desktopSteps, cloudSteps, mistakes: lines(mistakes), related, sources: parseSources(sources) };
    start(async () => {
      const res = article ? await updateArticle(article.id, input) : await createArticle(input);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success(article ? "Article saved" : "Article created");
      router.push(`/knowledge/${article ? article.id : (res.data as { id: string }).id}`);
    });
  }

  return (
    <>
      <PageHeader
        title={article ? `Edit: ${article.title}` : "New article"}
        description={article?.starterSlug ? "This is a starter article. Once you save changes, newer starter versions won’t replace your text." : "Write an explanation in your own words."}
      />
      {article?.reviewed && !isOwner && (
        <p role="note" className="mb-4 max-w-3xl text-sm text-muted-foreground">
          This article is Reviewed. Saving changes marks it Not reviewed until the owner checks it again.
        </p>
      )}
      <div className="flex max-w-3xl flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <Field id="kb-title" label="Title" error={errors.title}>
            <Input id="kb-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} aria-invalid={!!errors.title} className="bg-card" />
          </Field>
          <Field id="kb-category" label="Category" error={errors.category}>
            <Select value={category} onValueChange={(v) => setCategory(v as KnowledgeCategory)}>
              <SelectTrigger id="kb-category" className="w-full bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KNOWLEDGE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field id="kb-tell" label="Tell the customer" hint="Two or three plain sentences you can say or paste to a client." error={errors.tellCustomer}>
          <Textarea id="kb-tell" value={tellCustomer} onChange={(e) => setTellCustomer(e.target.value)} rows={3} maxLength={1000} aria-invalid={!!errors.tellCustomer} className="bg-card" />
        </Field>
        <Field id="kb-what" label="What it is" error={errors.whatItIs}>
          <Textarea id="kb-what" value={whatItIs} onChange={(e) => setWhatItIs(e.target.value)} rows={5} maxLength={4000} className="bg-card" />
        </Field>
        <Field id="kb-example" label="Example" hint="A small worked example in RM." error={errors.example}>
          <Textarea id="kb-example" value={example} onChange={(e) => setExample(e.target.value)} rows={4} maxLength={4000} className="bg-card" />
        </Field>
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-medium">In AutoCount (menu path; leave empty if not known)</legend>
          <Field id="kb-desktop" label="Desktop" error={errors.desktopSteps}>
            <Textarea id="kb-desktop" value={desktopSteps} onChange={(e) => setDesktopSteps(e.target.value)} rows={3} maxLength={2000} className="bg-card" placeholder="e.g. A/R > …" />
          </Field>
          <Field id="kb-cloud" label="Cloud" error={errors.cloudSteps}>
            <Textarea id="kb-cloud" value={cloudSteps} onChange={(e) => setCloudSteps(e.target.value)} rows={3} maxLength={2000} className="bg-card" placeholder="e.g. Accounting Menu > Reports > …" />
          </Field>
        </fieldset>
        <Field id="kb-mistakes" label="Common mistakes" hint="One per line." error={errors.mistakes}>
          <Textarea id="kb-mistakes" value={mistakes} onChange={(e) => setMistakes(e.target.value)} rows={4} className="bg-card" />
        </Field>
        {relatedOptions.length > 0 && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Related topics</legend>
            <ul className="grid max-h-48 gap-0.5 overflow-y-auto rounded-md border bg-card p-1 sm:grid-cols-2">
              {relatedOptions.map((o) => (
                <li key={o.slug}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                    <input type="checkbox" className="accent-(--primary)" checked={related.includes(o.slug)} onChange={(e) => setRelated((r) => (e.target.checked ? [...r, o.slug] : r.filter((x) => x !== o.slug)))} />
                    {o.title}
                  </label>
                </li>
              ))}
            </ul>
            {errors.related && <p className="mt-1 text-xs text-destructive">{errors.related}</p>}
          </fieldset>
        )}
        <Field id="kb-sources" label="Sources" hint="One per line: name | https://link" error={errors.sources}>
          <Textarea id="kb-sources" value={sources} onChange={(e) => setSources(e.target.value)} rows={3} className="bg-card font-mono text-[13px]" />
        </Field>
        <div className="flex gap-2 border-t pt-4">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} Save article
          </Button>
          <ButtonLink variant="outline" href={article ? `/knowledge/${article.id}` : "/knowledge"}>
            Cancel
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
