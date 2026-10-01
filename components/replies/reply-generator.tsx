"use client";

import { useMemo, useState } from "react";
import { Copy, FileStack, MessageSquareText, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { countTemplateUse } from "@/app/(app)/templates/actions";
import { DEFAULT_REPLY_TEMPLATE, analysisValues, fillTemplate, formatForChannel, guideValues, unfilledPlaceholders, type Channel } from "@/lib/templates";
import type { Analysis, Guide, Template } from "@/lib/types";

const STANDARD = "standard";

function Segmented<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="inline-flex w-fit rounded-lg border bg-card p-0.5 text-sm">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn("h-7 rounded-md px-3 transition-colors", value === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function ReplyGenerator({
  guides,
  analyses,
  templates,
  initialSource,
  initialTemplate,
}: {
  guides: Guide[];
  analyses: Analysis[];
  templates: Template[];
  initialSource?: string;
  initialTemplate?: string;
}) {
  const replyTemplates = templates.filter((t) => t.kind === "Reply");
  const firstSource = guides[0] ? `guide:${guides[0].id}` : analyses[0] ? `analysis:${analyses[0].id}` : "";
  const validSource = (s?: string) =>
    !!s && (guides.some((g) => `guide:${g.id}` === s) || analyses.some((a) => `analysis:${a.id}` === s));
  const [source, setSource] = useState(validSource(initialSource) ? initialSource! : firstSource);
  const [templateId, setTemplateId] = useState(replyTemplates.some((t) => t.id === initialTemplate) ? initialTemplate! : STANDARD);
  const [contact, setContact] = useState("");
  const [channel, setChannel] = useState<Channel>("email");
  const [edited, setEdited] = useState<string | null>(null);

  const template = replyTemplates.find((t) => t.id === templateId);
  const body = template?.body ?? DEFAULT_REPLY_TEMPLATE;
  const values = useMemo(() => {
    const name = contact.trim() || "there";
    const [kind, id] = source.split(/:(.*)/);
    if (kind === "guide") {
      const g = guides.find((x) => x.id === id);
      return g ? guideValues(g, name) : null;
    }
    const a = analyses.find((x) => x.id === id);
    return a ? analysisValues(a, name) : null;
  }, [source, contact, guides, analyses]);
  const generated = values ? formatForChannel(fillTemplate(body, values), channel) : "";
  const text = edited ?? generated;
  const missing = values ? unfilledPlaceholders(body, values, source.startsWith("analysis:") ? "analysis" : "guide").filter((k) => k !== "contact") : [];

  const sourceLabels = new Map<string, string>([
    ...guides.map((g) => [`guide:${g.id}`, `${g.id} · ${g.title}`] as const),
    ...analyses.map((a) => [`analysis:${a.id}`, `${a.id} · ${a.title}`] as const),
  ]);

  /** Changing an option rebuilds the draft; your own edits are replaced, so say so. */
  function change(apply: () => void) {
    apply();
    if (edited !== null) {
      setEdited(null);
      toast("Draft rebuilt from the template", { description: "Your edits to the previous draft were replaced." });
    }
  }

  const header = (
    <PageHeader
      title="Reply generator"
      description="Turn a guide or an analysis into a client-ready message from your reply template, then copy it into Zoho Desk or WhatsApp."
      howItWorks={
        <>
          The reply is your template with the placeholders filled in from the guide: <code className="font-mono text-xs">{"{steps}"}</code> becomes the numbered fix steps, <code className="font-mono text-xs">{"{cause}"}</code> the cause, and so on. Lines with nothing to fill in are left out. No AI is used and nothing is sent anywhere; you edit the draft, then copy it. Manage your reply templates under Templates & snippets.
        </>
      }
    />
  );

  if (!guides.length && !analyses.length)
    return (
      <>
        {header}
        <EmptyState icon={MessageSquareText} title="Nothing to reply about yet" action={<ButtonLink href="/guides/new">Write a guide</ButtonLink>}>
          Replies are built from a guide’s fix steps or an analysis. Add a guide first.
        </EmptyState>
      </>
    );

  return (
    <>
      {header}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source">Based on</Label>
            <Select value={source} onValueChange={(v) => change(() => setSource(String(v)))}>
              <SelectTrigger id="source" className="w-full bg-card">
                <SelectValue>{(v: string) => <span className="truncate">{sourceLabels.get(v)}</span>}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {guides.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Guides</SelectLabel>
                    {guides.map((g) => (
                      <SelectItem key={g.id} value={`guide:${g.id}`}>
                        {g.id} · {g.title}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {analyses.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Analyses</SelectLabel>
                    {analyses.map((a) => (
                      <SelectItem key={a.id} value={`analysis:${a.id}`}>
                        {a.id} · {a.title}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reply-template">Template</Label>
            <Select value={templateId} onValueChange={(v) => change(() => setTemplateId(String(v)))}>
              <SelectTrigger id="reply-template" className="w-full bg-card">
                <SelectValue>{(v: string) => <span className="truncate">{v === STANDARD ? "Standard reply" : replyTemplates.find((t) => t.id === v)?.title}</span>}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STANDARD}>Standard reply</SelectItem>
                {replyTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ButtonLink href="/templates" variant="link" size="sm" className="h-auto w-fit px-0 text-xs">
              <FileStack /> Manage reply templates
            </ButtonLink>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact">Client’s name</Label>
            <Input id="contact" value={contact} onChange={(e) => change(() => setContact(e.target.value))} placeholder="e.g. Ms Tan" className="bg-card" maxLength={100} />
            <p className="text-xs text-muted-foreground">Fills {"{contact}"}. Left empty, the reply says “Hi there”.</p>
          </div>

          <Segmented
            label="Channel"
            value={channel}
            onChange={(c) => change(() => setChannel(c))}
            options={[
              { value: "email", label: "Zoho Desk email" },
              { value: "whatsapp", label: "WhatsApp" },
            ]}
          />
        </div>

        <section aria-labelledby="draft-h" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="draft-h" className="font-medium">
              Draft
            </h2>
            <span className="text-xs text-muted-foreground">
              {channel === "email" ? "Email" : "WhatsApp"} · {template ? template.title : "Standard reply"}
              {edited !== null && " · edited"}
            </span>
          </div>
          <Label htmlFor="draft" className="sr-only">
            Reply draft
          </Label>
          <Textarea id="draft" value={text} onChange={(e) => setEdited(e.target.value)} rows={channel === "email" ? 18 : 12} className="field-sizing-fixed bg-card leading-relaxed" />
          {missing.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Left out because this {source.startsWith("guide:") ? "guide" : "analysis"} has none: {missing.map((k) => `{${k}}`).join(", ")}.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!text.trim()}
              onClick={() => {
                navigator.clipboard?.writeText(text);
                toast.success(channel === "email" ? "Copied. Paste it into your Zoho Desk reply." : "Copied. Paste it into WhatsApp.");
                if (template) void countTemplateUse(template.id);
              }}
            >
              <Copy /> Copy
            </Button>
            <Button variant="outline" disabled={edited === null} onClick={() => setEdited(null)}>
              <RotateCcw /> Undo my edits
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
