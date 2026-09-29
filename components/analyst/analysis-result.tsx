import Link from "next/link";
import { BookText, CheckCircle2, ExternalLink, Globe, Lightbulb, Scale, XCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfidenceBadge, NeedsVerification } from "@/components/shared/badges";
import { journalTotals } from "@/lib/guide-utils";
import { formatAmount, formatDate } from "@/lib/format";
import type { Analysis } from "@/lib/types";

/** The seven fixed sections every analysis must have, in order. */
function Part({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 border-t py-5 first:border-t-0 first:pt-0 md:grid-cols-[13rem_minmax(0,1fr)]" aria-labelledby={`part-${n}`}>
      <h3 id={`part-${n}`} className="flex items-baseline gap-2 font-medium">
        <span className="num text-sm text-muted-foreground">{n}.</span> {title}
      </h3>
      <div className="min-w-0 space-y-3 text-sm">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}

export function AnalysisResult({ a }: { a: Analysis }) {
  return (
    <div>
      <Part n={1} title="Scenario and assumptions">
        <Bullets items={a.understanding} />
        <p className="text-xs font-medium text-muted-foreground">Assumptions I made. Correct me if any are wrong:</p>
        <Bullets items={a.assumptions} />
      </Part>

      <Part n={2} title="Accounting treatment">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Scale className="size-3.5" /> {a.treatment.standard}
        </p>
        <Bullets items={a.treatment.points} />
        {a.judgementNote && (
          <p className="flex gap-2 rounded-md bg-warning/[0.08] p-3 ring-1 ring-warning/30 ring-inset">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              <span className="font-medium">Judgement call. Please review: </span>
              {a.judgementNote}
            </span>
          </p>
        )}
      </Part>

      <Part n={3} title="Journal entries">
        <div className="space-y-4">
          {a.entries.map((e, i) => {
            const t = journalTotals(e);
            return (
              <div key={i} className="overflow-hidden rounded-lg border">
                <div className="flex flex-wrap items-center gap-2 bg-muted/60 px-3 py-2 text-xs">
                  <span className="num font-medium">{formatDate(e.date)}</span>
                  <span className="text-muted-foreground">{e.description}</span>
                  <span className={`ml-auto inline-flex items-center gap-1 font-medium ${t.balanced ? "text-success" : "text-destructive"}`}>
                    {t.balanced ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                    {t.balanced ? "Dr = Cr" : "Does not balance"}
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="w-28 text-right">Dr (RM)</TableHead>
                      <TableHead className="w-28 text-right">Cr (RM)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {e.lines.map((l, j) => (
                      <TableRow key={j}>
                        <TableCell className={l.cr ? "pl-8" : undefined}>{l.account}</TableCell>
                        <TableCell className="text-right font-mono text-[13px]">{formatAmount(l.dr)}</TableCell>
                        <TableCell className="text-right font-mono text-[13px]">{formatAmount(l.cr)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="text-xs text-muted-foreground">Total</TableCell>
                      <TableCell className="text-right font-mono text-[13px] font-medium">{formatAmount(t.dr)}</TableCell>
                      <TableCell className="text-right font-mono text-[13px] font-medium">{formatAmount(t.cr)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            );
          })}
        </div>
      </Part>

      <Part n={4} title="How to record it in AutoCount">
        <ol className="space-y-3">
          {a.steps.map((s, i) => (
            <li key={i} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{s.document}</span>
                <span className="font-mono text-xs text-muted-foreground">{s.menuPath}</span>
                {!s.verified && <NeedsVerification className="ml-auto" />}
              </div>
              <ul className="mt-2 grid gap-x-4 gap-y-1 text-muted-foreground sm:grid-cols-2">
                {s.fields.map((f) => (
                  <li key={f} className="before:mr-1.5 before:text-primary before:content-['›']">
                    {f}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Part>

      <Part n={5} title="Tax (SST, e-Invoice)">
        <Bullets items={a.tax} />
      </Part>

      <Part n={6} title="Common mistakes and how to check">
        <Bullets items={a.mistakes} />
        <p className="text-xs font-medium text-muted-foreground">Reports to check afterwards</p>
        <Bullets items={a.verifyReports} />
      </Part>

      <Part n={7} title="Confidence and sources">
        <ConfidenceBadge level={a.confidence} />
        {a.needsVerification.length > 0 && (
          <>
            <p className="text-xs font-medium text-muted-foreground">Needs verification before you rely on it</p>
            <Bullets items={a.needsVerification} />
          </>
        )}
        <ul className="space-y-1.5">
          {a.sources.map((s) => (
            <li key={s.label} className="flex items-start gap-2">
              {s.kind === "my-guide" ? <BookText className="mt-0.5 size-4 text-primary" /> : s.kind === "official" ? <Globe className="mt-0.5 size-4 text-info" /> : <Lightbulb className="mt-0.5 size-4 text-muted-foreground" />}
              {s.kind === "my-guide" ? (
                <Link href={`/guides/${s.ref}`} className="hover:underline">
                  {s.label}
                </Link>
              ) : s.kind === "official" ? (
                <a href={s.ref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                  {s.label} <ExternalLink className="size-3" />
                </a>
              ) : (
                <span className="text-muted-foreground">{s.label}</span>
              )}
            </li>
          ))}
        </ul>
      </Part>
    </div>
  );
}
