"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, Calculator, ClipboardCopy, History, Loader2, PenLine, Printer, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { AnalysisResult } from "@/components/analyst/analysis-result";
import { ScenarioForm } from "@/components/analyst/scenario-form";
import { ManualJournal } from "@/components/analyst/manual-journal";
import { analysisToGuide, deleteAnalysis, saveCalculation } from "@/app/(app)/analyst/actions";
import { defaultValues, getScenario, runScenario, SCENARIO_CATEGORIES, SCENARIOS, type Values } from "@/lib/scenarios";
import { claudePrompt } from "@/lib/scenarios/prompt";
import { formatDate } from "@/lib/format";
import type { Analysis } from "@/lib/types";

type Mode = { kind: "scenario"; id: string } | { kind: "history"; code: string } | { kind: "manual" };

function setAddress(mode: Mode) {
  const q = mode.kind === "scenario" ? `?scenario=${mode.id}` : mode.kind === "history" ? `?analysis=${mode.code}` : "?manual=1";
  window.history.replaceState(null, "", `/analyst${q}`);
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied. Paste it into Claude (claude.ai) for a second opinion.", { description: "Remove any client names first." });
  } catch {
    toast.error("Couldn’t copy. Your browser blocked the clipboard.");
  }
}

export function AnalystView({ analyses, initial }: { analyses: Analysis[]; initial: Mode }) {
  const router = useRouter();
  const [mode, setModeState] = useState<Mode>(initial);
  const [tab, setTab] = useState<"scenarios" | "history">(initial.kind === "history" ? "history" : "scenarios");
  const [filter, setFilter] = useState("");
  const [values, setValues] = useState<Record<string, Values>>(() => {
    if (initial.kind === "history") {
      const a = analyses.find((x) => x.id === initial.code);
      if (a?.calculator) return { [a.calculator.scenarioId]: a.calculator.inputs };
    }
    return {};
  });
  const [busy, start] = useTransition();

  function go(m: Mode) {
    setModeState(m);
    setAddress(m);
    window.scrollTo({ top: 0 });
  }

  const scenario = mode.kind === "scenario" ? getScenario(mode.id) : undefined;
  const current = useMemo<Values>(() => (scenario ? (values[scenario.id] ?? defaultValues(scenario)) : {}), [scenario, values]);
  const run = useMemo(() => (scenario ? runScenario(scenario, current) : null), [scenario, current]);
  const saved = mode.kind === "history" ? analyses.find((a) => a.id === mode.code) : undefined;

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? SCENARIOS.filter((s) => `${s.title} ${s.summary} ${s.category}`.toLowerCase().includes(f)) : SCENARIOS;
  }, [filter]);
  const shownHistory = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? analyses.filter((a) => `${a.id} ${a.title} ${a.scenario}`.toLowerCase().includes(f)) : analyses;
  }, [filter, analyses]);

  function saveThen(next?: (code: string) => Promise<void>) {
    if (!scenario || !run?.ok) return;
    start(async () => {
      const res = await saveCalculation(scenario.id, current);
      if (!res.ok) return void toast.error(res.error);
      if (next) return next(res.data.code);
      toast.success(`Saved as ${res.data.code}`);
      router.refresh();
    });
  }

  async function toGuide(code: string) {
    const res = await analysisToGuide(code);
    if (res.ok) {
      toast.success(`Saved as guide ${res.data.code}`, { description: "It starts as unverified." });
      router.push(`/guides/${res.data.code}`);
    } else toast.error(res.error);
  }

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Accounting analyst"
          description="Pick a scenario, enter the figures, and get the treatment, balanced journal entries, AutoCount steps and tax points. Free: the calculations run in the app, no AI."
          howItWorks={
            <>
              Each scenario is a worked calculation done in sen, so rounding never unbalances an entry, and every entry is checked so that total Dr equals total Cr. AutoCount menu paths are marked <strong>Needs verification</strong> until confirmed. Treatment notes are general guidance for a professional to review. <strong>Copy for Claude</strong> copies a ready-made prompt you can paste into your own Claude app for a second opinion; nothing is sent automatically.
            </>
          }
        />
      </div>

      <div className="grid gap-8 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="flex flex-col gap-3 print:hidden" aria-label="Scenarios and history">
          <div role="tablist" aria-label="Choose list" className="grid grid-cols-2 rounded-lg border bg-card p-0.5 text-sm">
            {(["scenarios", "history"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn("h-7 rounded-md transition-colors", tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {t === "scenarios" ? "Scenarios" : `History (${analyses.length})`}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={tab === "scenarios" ? "Find a scenario" : "Find a saved analysis"} aria-label="Filter list" className="h-8 bg-card pl-8" />
          </div>

          {tab === "scenarios" ? (
            <nav className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => go({ kind: "manual" })}
                aria-current={mode.kind === "manual" ? "true" : undefined}
                className={cn("flex items-center gap-2 rounded-md border border-dashed px-2.5 py-2 text-left text-sm", mode.kind === "manual" ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted")}
              >
                <PenLine className="size-4" /> Build your own entry
              </button>
              {SCENARIO_CATEGORIES.map((cat) => {
                const items = shown.filter((s) => s.category === cat);
                if (!items.length) return null;
                return (
                  <div key={cat}>
                    <p className="px-2.5 pb-1 text-xs font-medium text-muted-foreground">{cat}</p>
                    <ul>
                      {items.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => go({ kind: "scenario", id: s.id })}
                            aria-current={mode.kind === "scenario" && mode.id === s.id ? "true" : undefined}
                            className={cn("w-full rounded-md px-2.5 py-1.5 text-left text-sm leading-snug transition-colors", mode.kind === "scenario" && mode.id === s.id ? "bg-accent font-medium text-accent-foreground" : "hover:bg-muted")}
                          >
                            {s.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {shown.length === 0 && <p className="px-2.5 text-sm text-muted-foreground">No scenario matches. Try “Build your own entry”.</p>}
            </nav>
          ) : shownHistory.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">{analyses.length ? "Nothing matches." : "Saved calculations and entries appear here."}</p>
          ) : (
            <ul className="flex max-h-[70vh] flex-col gap-1 overflow-y-auto pr-1">
              {shownHistory.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => go({ kind: "history", code: a.id })}
                    aria-current={mode.kind === "history" && mode.code === a.id ? "true" : undefined}
                    className={cn("w-full rounded-md px-2.5 py-2 text-left text-sm transition-colors", mode.kind === "history" && mode.code === a.id ? "bg-accent text-accent-foreground" : "hover:bg-muted")}
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
          {mode.kind === "manual" && (
            <section aria-labelledby="mj-h" className="rounded-lg border bg-card p-4 sm:p-5">
              <h2 id="mj-h" className="mb-1 text-lg font-semibold">
                Build your own entry
              </h2>
              <p className="mb-4 text-sm text-muted-foreground">For anything the scenarios don’t cover. It can only be saved once total Dr equals total Cr.</p>
              <ManualJournal
                onSaved={(code) => {
                  router.refresh();
                  setTab("history");
                  go({ kind: "history", code });
                }}
              />
            </section>
          )}

          {scenario && (
            <>
              <section aria-labelledby="sc-h" className="rounded-lg border bg-card p-4 sm:p-5 print:border-0 print:p-0">
                <p className="text-xs text-muted-foreground">{scenario.category}</p>
                <h2 id="sc-h" className="mt-0.5 text-lg font-semibold">
                  {scenario.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{scenario.summary}</p>
                <div className="mt-4 print:hidden">
                  <ScenarioForm
                    fields={scenario.fields}
                    values={current}
                    errors={run && !run.ok ? run.errors : {}}
                    onChange={(k, v) => setValues((p) => ({ ...p, [scenario.id]: { ...current, [k]: v } }))}
                  />
                </div>
                {run && !run.ok && run.errors._ && (
                  <p role="alert" className="mt-3 text-sm text-destructive">
                    {run.errors._}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2 print:hidden">
                  <Button disabled={!run?.ok || busy} onClick={() => saveThen()}>
                    {busy ? <Loader2 className="animate-spin" /> : <Save />} Save to history
                  </Button>
                  <Button variant="outline" disabled={!run?.ok || busy} onClick={() => saveThen(toGuide)}>
                    <BookmarkPlus /> Save as guide
                  </Button>
                  <Button variant="outline" disabled={!run?.ok} onClick={() => run?.ok && copy(claudePrompt(scenario.title, run.output.narrative, run.output.result))}>
                    <ClipboardCopy /> Copy for Claude
                  </Button>
                  <Button variant="outline" disabled={!run?.ok} onClick={() => window.print()}>
                    <Printer /> Print / PDF
                  </Button>
                  <Button variant="ghost" onClick={() => setValues((p) => ({ ...p, [scenario.id]: defaultValues(scenario) }))}>
                    <RotateCcw /> Example figures
                  </Button>
                </div>
              </section>

              {run?.ok ? (
                <section aria-label="Result" className="rounded-lg border bg-card p-4 sm:p-5 print:border-0 print:p-0">
                  <p className="mb-4 text-sm">{run.output.narrative}</p>
                  <AnalysisResult a={{ ...run.output.result, confidence: run.output.confidence }} />
                </section>
              ) : (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Fix the highlighted figures to see the entries.</p>
              )}
            </>
          )}

          {mode.kind === "history" &&
            (saved ? (
              <>
                <section className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4 print:border-0 print:p-0">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {saved.id} · {formatDate(saved.createdAt)}
                    </p>
                    <h2 className="mt-0.5 text-lg font-semibold">{saved.title}</h2>
                    <p className="mt-1 max-w-[80ch] text-sm text-muted-foreground">{saved.scenario}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 print:hidden">
                    {saved.calculator && getScenario(saved.calculator.scenarioId) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const c = saved.calculator!;
                          setValues((p) => ({ ...p, [c.scenarioId]: c.inputs }));
                          setTab("scenarios");
                          go({ kind: "scenario", id: c.scenarioId });
                        }}
                      >
                        <Calculator /> Open in calculator
                      </Button>
                    )}
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => start(() => toGuide(saved.id))}>
                      <BookmarkPlus /> Save as guide
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => copy(claudePrompt(saved.title, saved.scenario, saved))}>
                      <ClipboardCopy /> Copy for Claude
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.print()}>
                      <Printer /> Print / PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm(`Delete ${saved.id}?`)) return;
                        start(async () => {
                          const res = await deleteAnalysis(saved.id);
                          if (!res.ok) return void toast.error(res.error);
                          toast.success(`${saved.id} deleted`);
                          go({ kind: "scenario", id: SCENARIOS[0].id });
                          setTab("scenarios");
                          router.refresh();
                        });
                      }}
                    >
                      <Trash2 /> Delete
                    </Button>
                  </div>
                </section>
                <section aria-label="Saved result" className="rounded-lg border bg-card p-4 sm:p-5 print:border-0 print:p-0">
                  <AnalysisResult a={saved} />
                </section>
              </>
            ) : (
              <EmptyState icon={History} title="That analysis isn’t available">
                It may have been deleted. Pick another from History, or start a scenario.
              </EmptyState>
            ))}
        </div>
      </div>
    </>
  );
}
