"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FilePlus2, GraduationCap, SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { AddStartersDialog, type StarterChoice } from "@/components/knowledge/add-starters-dialog";
import { ReviewedBadge } from "@/components/knowledge/reviewed-badge";
import { KNOWLEDGE_CATEGORIES, type KnowledgeArticle } from "@/lib/knowledge/model";

export function KnowledgeList({ articles, missing }: { articles: KnowledgeArticle[]; missing: StarterChoice[] }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return articles;
    return articles.filter((a) => {
      const text = `${a.title} ${a.tellCustomer} ${a.category}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [articles, q]);

  return (
    <>
      <PageHeader
        title="Knowledge hub"
        description="Accounting ideas in plain words, with a ready-made explanation for the customer at the top of each article."
        actions={
          <>
            {articles.length > 0 && <AddStartersDialog missing={missing} />}
            <ButtonLink size="sm" href="/knowledge/new">
              <FilePlus2 /> New article
            </ButtonLink>
          </>
        }
        howItWorks={
          <>
            Each article starts with <strong>Tell the customer</strong>: two or three sentences you can say or paste straight away. Below that: what it is, an example, where it is in AutoCount (Desktop and Cloud, marked <strong>Needs verification</strong> until you confirm), common mistakes and sources. Starter articles are added only when you tick them, and stay “Not reviewed yet” until you check them. Everything is private to your account; no AI is used.
          </>
        }
      />

      {articles.length === 0 ? (
        <EmptyState icon={GraduationCap} title="Start your Knowledge hub" action={missing.length ? <AddStartersDialog missing={missing} variant="default" /> : undefined}>
          Add ready-made articles on debtor aging, bank reconciliation, opening balances and more, or write your own with <strong>New article</strong>.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter articles, e.g. aging" aria-label="Filter articles" className="max-w-md bg-card" />
          {shown.length === 0 && (
            <EmptyState icon={SearchX} title="No articles match">
              Try another word, or search everything from Search.
            </EmptyState>
          )}
          {KNOWLEDGE_CATEGORIES.filter((cat) => shown.some((a) => a.category === cat)).map((cat) => (
            <section key={cat} aria-labelledby={`kb-${cat}`}>
              <h2 id={`kb-${cat}`} className="mb-2 text-sm font-medium">
                {cat}
              </h2>
              <ul className="divide-y rounded-lg border bg-card">
                {shown
                  .filter((a) => a.category === cat)
                  .map((a) => (
                    <li key={a.id}>
                      <Link href={`/knowledge/${a.id}`} className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/60">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium group-hover:underline">{a.title}</span>
                          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{a.tellCustomer}</span>
                        </span>
                        <ReviewedBadge reviewed={a.reviewed} />
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
