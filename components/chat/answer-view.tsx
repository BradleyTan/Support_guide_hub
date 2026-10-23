"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, BookPlus, Copy, ExternalLink, Globe } from "lucide-react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { setAnswerChecked } from "@/app/(app)/chat/actions";
import type { ChatMessage } from "@/lib/accountant/chat";
import type { CheckedAnswer, CheckedStep, SourceKind } from "@/lib/accountant/core/answer";
import { formatRM, UNBALANCED_LABEL } from "@/lib/accountant/core/checks";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<SourceKind, string> = { "my-guide": "My guide", knowledge: "Knowledge hub", official: "AutoCount help", web: "Web" };
const STATUS: Record<CheckedStep["status"], { label: string; className: string }> = {
  confirmed: { label: "Confirmed", className: "border-success/30 bg-success/10 text-success" },
  "unverified-source": { label: "From an unverified guide — check it", className: "border-warning/40 bg-warning/10 text-foreground" },
  "not-confirmed": { label: "Not confirmed", className: "border-destructive/30 bg-destructive/10 text-destructive" },
  "no-path": { label: "No menu path", className: "border-border text-muted-foreground" },
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h4 className="text-sm font-medium">{title}</h4>
      {children}
    </section>
  );
}

function Entries({ c }: { c: CheckedAnswer }) {
  return (
    <div className="space-y-3">
      {c.answer.entries.map((e, i) => {
        const r = c.entryResults[i];
        return (
          <div key={i} className={cn("rounded-lg border bg-card p-3", !r?.balanced && "border-destructive/40")}>
            <p className="mb-1.5 text-xs text-muted-foreground break-words">
              {e.date ? `${e.date} · ` : ""}
              {e.description}
            </p>
            {!r?.balanced && (
              <p className="mb-1.5 text-xs font-medium text-destructive">
                {UNBALANCED_LABEL}
                {r?.problem ? ` — ${r.problem}` : ""}
              </p>
            )}
            <table className="w-full text-sm">
              <tbody>
                {e.lines.map((l, j) => (
                  <tr key={j} className="align-top">
                    <td className="w-8 text-muted-foreground">{l.dr !== null ? "Dr" : "Cr"}</td>
                    <td className={cn("break-words", l.cr !== null && "pl-4")}>
                      {l.account} <span className="text-xs text-muted-foreground">({l.accountType})</span>
                    </td>
                    <td className="text-right tabular-nums whitespace-nowrap">{formatRM(Math.round((l.dr ?? l.cr ?? 0) * 100))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function Steps({ steps }: { steps: CheckedStep[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(["desktop", "cloud"] as const).map((p) => {
        const group = steps.filter((s) => s.platform === p);
        return (
          <div key={p} role="group" aria-label={p === "desktop" ? "Desktop steps" : "Cloud steps"} className="rounded-lg border bg-card p-3">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{p === "desktop" ? "Desktop (AutoCount Accounting)" : "Cloud (AutoCount Cloud Accounting)"}</p>
            {group.length ? (
              <ol className="list-decimal space-y-2 pl-5 text-sm">
                {group.map((s, i) => (
                  <li key={i} className="break-words">
                    {s.text}
                    {s.menuPath && (
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                        <code className="rounded bg-muted px-1 py-0.5 break-words">{s.menuPath}</code>
                        <span className={cn("rounded border px-1.5 py-0.5", STATUS[s.status].className)}>{STATUS[s.status].label}</span>
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground italic">No steps given.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** onSearchWeb: asks the same question again with web search; left out while another answer is on its way. */
export function AnswerView({ message, onSearchWeb }: { message: ChatMessage; onSearchWeb?: () => void }) {
  const router = useRouter();
  const [checked, setChecked] = useState(message.checked);
  const [saving, start] = useTransition();
  const c = message.answer;
  if (!c) return <p className="text-sm text-muted-foreground italic">This answer couldn’t be shown.</p>;
  const a = c.answer;

  function tick(next: boolean) {
    setChecked(next);
    start(async () => {
      const res = await setAnswerChecked(message.id, next);
      if (!res.ok) {
        setChecked(!next);
        toast.error(res.error);
      } else router.refresh();
    });
  }

  return (
    <article aria-label="Answer" className="space-y-4 rounded-xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-xs font-medium text-foreground">Check before relying</span>
        {!a.needsMoreInfo && (
          <ButtonLink size="sm" variant="ghost" href={`/guides/new?fromChat=${message.id}`}>
            <BookPlus /> Save as guide
          </ButtonLink>
        )}
        {!c.sources.some((s) => s.kind === "web") && (
          <Button size="sm" variant="ghost" disabled={!onSearchWeb} onClick={onSearchWeb} title="Ask this question again, also using Groq’s web search (one extra request)">
            <Globe /> Search the web too
          </Button>
        )}
      </div>

      {a.needsMoreInfo ? (
        <Block title="A few questions first">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {a.questions.map((q, i) => (
              <li key={i} className="break-words">
                {q}
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">Answer them below and I’ll work it out.</p>
        </Block>
      ) : (
        <>
          <section aria-label="For you" className="space-y-4">
            <h3 className="font-medium">For you</h3>
            {a.summary && <p className="text-sm leading-relaxed break-words whitespace-pre-line">{a.summary}</p>}
            {a.assumptions.length > 0 && (
              <Block title="Assumptions">
                <ul className="list-disc space-y-1 pl-5 text-sm break-words">
                  {a.assumptions.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </Block>
            )}
            {a.entries.length > 0 && (
              <Block title="Journal entries">
                <Entries c={c} />
              </Block>
            )}
            <Block title="In AutoCount">
              <Steps steps={c.steps} />
            </Block>
            {a.needsAccountant && (
              <div role="note" className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p className="break-words">
                  <span className="font-medium">Check with the customer’s accountant or auditor. </span>
                  {a.needsAccountant}
                </p>
              </div>
            )}
            {(a.doubts.length > 0 || c.flags.length > 0) && (
              <Block title="Doubts and checks">
                <ul className="list-disc space-y-1 pl-5 text-sm break-words text-muted-foreground">
                  {[...a.doubts, ...c.flags].map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </Block>
            )}
            <Block title="Sources">
              {c.sources.length ? (
                <ul className="space-y-1 text-sm">
                  {c.sources.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-baseline gap-1.5 break-words">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{KIND_LABEL[s.kind]}</span>
                      {s.url.startsWith("/") ? (
                        <Link href={s.url} className="text-primary hover:underline">
                          {s.title}
                        </Link>
                      ) : s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-primary hover:underline">
                          {s.title} <ExternalLink className="mt-1 size-3 shrink-0" />
                        </a>
                      ) : (
                        <span>{s.title}</span>
                      )}
                      {!s.checked && s.kind !== "web" && <span className="text-xs text-muted-foreground">(not checked)</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">None of your guides, articles or the help centre matched, so this is general accounting knowledge.</p>
              )}
            </Block>
          </section>

          <section aria-label="For the customer" className="space-y-3 rounded-xl border-2 border-primary/30 bg-primary/[0.04] p-4">
            <h3 className="font-medium">For the customer</h3>
            {c.customerReply ? (
              <>
                <p className="text-[15px] leading-relaxed break-words whitespace-pre-line">{c.customerReply}</p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-primary" checked={checked} disabled={saving} onChange={(e) => tick(e.target.checked)} />
                  I’ve checked the entry and steps
                </label>
                {checked && (
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard?.writeText(c.customerReply ?? "");
                      toast.success("Copied", { description: "Paste it into your reply to the customer." });
                    }}
                  >
                    <Copy /> Copy for the customer
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No ready-to-send reply this time: {c.flags.join("; ") || "the answer didn’t pass the checks"}. Use the notes above to write your own.</p>
            )}
          </section>
        </>
      )}
    </article>
  );
}
