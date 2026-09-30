"use client";

import { useState } from "react";
import { BookmarkPlus, Calculator, FileDown, History, Loader2, MessageSquareText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { SmartInput } from "@/components/shared/smart-input";
import { EmptyState, BlockSkeleton } from "@/components/shared/states";
import { AnalysisResult } from "@/components/analyst/analysis-result";
import { formatDate } from "@/lib/format";
import type { Analysis, ChatMessage } from "@/lib/types";

type Phase = "result" | "thinking" | "clarify";

export function AnalystView({ analyses }: { analyses: Analysis[] }) {
  const [activeId, setActiveId] = useState(analyses[0]?.id ?? "");
  const [phase, setPhase] = useState<Phase>("result");
  const [chat, setChat] = useState<ChatMessage[]>(analyses[0]?.chat ?? []);
  const [chatKey, setChatKey] = useState(0);
  const active = analyses.find((a) => a.id === activeId);

  function open(id: string) {
    setActiveId(id);
    setPhase("result");
    setChat(analyses.find((a) => a.id === id)?.chat ?? []);
  }

  function analyse(text: string) {
    // Too little detail: the analyst asks instead of guessing. (Live analysis arrives in Phase 4.)
    setPhase(text.trim().length < 60 ? "clarify" : "thinking");
    if (text.trim().length >= 60) setTimeout(() => open(analyses[0]?.id ?? ""), 1500);
  }

  return (
    <>
      <PageHeader
        title="Accounting analyst"
        description="Describe a transaction, with a screenshot or statement if you have one. You get the treatment, journal entries, AutoCount steps and tax points."
        howItWorks={
          <>
            Claude Opus analyses the scenario on the server; your API key never reaches the browser. It checks your guides and official AutoCount sources first and <strong>labels general knowledge as such</strong>. Every journal entry is checked on the server so total Dr equals total Cr. It <strong>asks for missing details</strong> (tax code, rate, document type) instead of guessing. Any AutoCount menu path it can’t confirm is marked <em>Needs verification</em>.
          </>
        }
      />

      <div className="grid gap-8 xl:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="order-last xl:order-first">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <History className="size-4 text-muted-foreground" /> History
          </h2>
          {analyses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Your analyses are saved here so you can search and reopen them.</p>
          ) : (
            <ul className="space-y-1">
              {analyses.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => open(a.id)}
                    aria-current={a.id === activeId ? "true" : undefined}
                    className={cn("w-full rounded-md px-2.5 py-2 text-left text-sm transition-colors", a.id === activeId ? "bg-accent text-accent-foreground" : "hover:bg-muted")}
                  >
                    <span className="block leading-snug font-medium">{a.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.id} · {formatDate(a.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <SmartInput
            label="Scenario"
            placeholder="e.g. Customer paid a USD deposit, then we invoiced with SST, then they paid part in USD…"
            rows={4}
            extraction={[
              { label: "Document", value: "Bank statement – Maybank USD account" },
              { label: "Transaction", value: "05/09/2026  Inward TT  USD 2,000.00" },
              { label: "Rate on statement", value: "4.38", uncertain: true },
            ]}
            onUseExtraction={() => toast("Figures added to the scenario (mock)")}
            submitLabel="Analyse"
            onSubmit={(text) => analyse(text)}
          />

          {phase === "thinking" ? (
            <div className="space-y-3" role="status">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Checking your guides and official sources, then working out the entries…
              </p>
              <BlockSkeleton className="h-24" />
              <BlockSkeleton className="h-64" />
            </div>
          ) : phase === "clarify" ? (
            <Clarify onDone={() => open(analyses[0]?.id ?? "")} />
          ) : !active ? (
            <EmptyState icon={Calculator} title="Describe a scenario to get started">
              Include amounts, dates, currency rates and tax codes if you know them. You can also attach a statement or invoice photo and I’ll read the figures. Live analysis is connected in Phase 4.
            </EmptyState>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {active.id} · {formatDate(active.createdAt)}
                  </p>
                  <h2 className="mt-0.5 text-lg font-semibold">{active.title}</h2>
                  <p className="mt-1 max-w-[80ch] text-sm text-muted-foreground">{active.scenario}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => toast.success("Saved as guide (mock)", { description: "Creates an unverified guide in Tax / Multi-currency." })}>
                    <BookmarkPlus /> Save as guide
                  </Button>
                  <ButtonLink size="sm" variant="outline" href={`/replies?analysis=${active.id}`}>
                    <MessageSquareText /> Draft reply
                  </ButtonLink>
                  <Button size="sm" variant="outline" onClick={() => toast("PDF export is mocked", { description: "The real version downloads a formatted PDF." })}>
                    <FileDown /> PDF
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-4 sm:p-5">
                <AnalysisResult a={active} />
              </div>

              <section aria-labelledby="followup" className="rounded-lg border bg-card">
                <h2 id="followup" className="border-b px-4 py-2.5 text-sm font-medium">
                  Follow-up questions
                </h2>
                <div className="space-y-3 p-4">
                  {chat.length === 0 && <p className="text-sm text-muted-foreground">Ask anything about this scenario. The context above is kept.</p>}
                  {chat.map((m, i) => (
                    <div key={i} className={cn("max-w-[75ch] rounded-lg px-3 py-2 text-sm", m.role === "user" ? "ml-auto bg-accent text-accent-foreground" : "bg-muted")}>
                      {m.role === "assistant" && (
                        <span className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Sparkles className="size-3" /> Analyst
                        </span>
                      )}
                      {m.text}
                    </div>
                  ))}
                  <SmartInput
                    key={chatKey}
                    compact
                    label="Follow-up question"
                    placeholder="Ask a follow-up, or attach another screenshot…"
                    rows={2}
                    submitLabel="Ask"
                    onSubmit={(text) => {
                      setChat((c) => [
                        ...c,
                        { role: "user", text: text || "(image)" },
                        { role: "assistant", text: "In the real version, Claude answers here using the full context of this analysis. (Prototype reply.)" },
                      ]);
                      setChatKey((k) => k + 1);
                    }}
                  />
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Clarify({ onDone }: { onDone: () => void }) {
  return (
    <div className="rounded-lg border bg-card p-4 sm:p-5">
      <p className="flex items-center gap-2 font-medium">
        <Sparkles className="size-4 text-primary" /> I need two details before I can give correct entries
      </p>
      <p className="mt-1 text-sm text-muted-foreground">I won’t guess these, because they change the journal entries and the tax.</p>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onDone();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-tax">Which tax applies to the invoice?</Label>
          <Input id="c-tax" placeholder="e.g. service tax 8%" className="bg-background" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-rate">Exchange rate on each date</Label>
          <Input id="c-rate" placeholder="e.g. deposit 4.45, invoice 4.40" className="bg-background" />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">Continue analysis</Button>
        </div>
      </form>
    </div>
  );
}
