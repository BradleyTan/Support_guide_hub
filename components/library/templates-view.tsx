"use client";

import { useState } from "react";
import { Copy, FileStack, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Tag } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/states";
import type { Template, TemplateKind } from "@/lib/types";

export function TemplatesView({ templates }: { templates: Template[] }) {
  const [kind, setKind] = useState<TemplateKind | "All">("All");
  const list = templates.filter((t) => kind === "All" || t.kind === kind);
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const selected = list.find((t) => t.id === selectedId) ?? list[0];

  return (
    <>
      <PageHeader
        title="Templates & snippets"
        description="Replies, SQL queries and checklists you reuse often."
        actions={
          <Button size="sm" onClick={() => toast("New template form is mocked")}>
            <Plus /> New template
          </Button>
        }
        howItWorks={
          <>
            Text in braces such as <code className="font-mono text-xs">{"{contact}"}</code> is filled in when you use a template in the Reply generator. SQL snippets are stored as text only; the app never runs them against a client database.
          </>
        }
      />
      <Tabs value={kind} onValueChange={(v) => setKind(v as TemplateKind | "All")} className="mb-4">
        <TabsList>
          {(["All", "Reply", "SQL", "Checklist"] as const).map((k) => (
            <TabsTrigger key={k} value={k}>
              {k}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!selected ? (
        <EmptyState icon={FileStack} title="No templates yet" action={<Button onClick={() => toast("New template form is mocked")}>Create a template</Button>}>
          Save replies you send often, handy SQL checks and checklists here. You can also save any generated reply as a template.
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <ul className="space-y-1">
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
          <section className="rounded-lg border bg-card" aria-labelledby="tpl-title">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
              <h2 id="tpl-title" className="font-medium">
                {selected.title}
              </h2>
              <div className="flex gap-1">
                {selected.tags.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => {
                  navigator.clipboard?.writeText(selected.body);
                  toast.success("Copied");
                }}
              >
                <Copy /> Copy
              </Button>
            </div>
            <pre className={cn("overflow-x-auto p-4 text-sm leading-relaxed whitespace-pre-wrap", selected.kind === "SQL" && "font-mono text-[13px]")}>{selected.body}</pre>
          </section>
        </div>
      )}
    </>
  );
}
