"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { BookText, FilePlus2, Search, SearchCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { ACTIVITY_DAYS, NOT_OPENED_MIN_AGE_DAYS, activityTotals, newGuideHref, weekLabel, type Insights } from "@/lib/insights";
import { shortProduct } from "@/lib/guide-utils";
import { formatDate } from "@/lib/format";
import type { Guide } from "@/lib/types";

const chartConfig = {
  opens: { label: "Guides opened", color: "var(--chart-1)" },
  searches: { label: "Searches", color: "var(--chart-2)" },
  unmatched: { label: "Found no guide", color: "var(--chart-4)" },
} satisfies ChartConfig;

const LIST_LIMIT = 8;

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="num mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function Section({ id, title, action, children, className }: { id: string; title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <h2 id={id} className="text-sm font-medium">
          {title}
        </h2>
        {action}
      </div>
      <div className="p-2">{children}</div>
    </section>
  );
}

function GuideLine({ g, meta }: { g: Guide; meta: React.ReactNode }) {
  return (
    <li>
      <Link href={`/guides/${g.id}`} className="group block rounded-md px-2 py-2 transition-colors hover:bg-muted/60">
        <span className="block text-sm font-medium group-hover:underline">{g.title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {g.id} · {shortProduct(g.product)}
          {g.module && ` · ${g.module}`} · {meta}
        </span>
      </Link>
    </li>
  );
}

function GuideList({ guides, meta, empty }: { guides: Guide[]; meta: (g: Guide) => React.ReactNode; empty: string }) {
  if (!guides.length) return <p className="px-2 py-3 text-sm text-muted-foreground">{empty}</p>;
  return (
    <>
      <ul>
        {guides.slice(0, LIST_LIMIT).map((g) => (
          <GuideLine key={g.id} g={g} meta={meta(g)} />
        ))}
      </ul>
      {guides.length > LIST_LIMIT && <p className="px-2 pt-1 pb-2 text-xs text-muted-foreground">and {guides.length - LIST_LIMIT} more</p>}
    </>
  );
}

export function InsightsView({ insights }: { insights: Insights }) {
  const { weeks, gaps, topOpened, notOpened, health } = insights;
  const totals = activityTotals(weeks);
  const chartData = weeks.map((w) => ({ ...w, label: weekLabel(w.weekStart) }));
  const noActivity = totals.opens === 0 && totals.searches === 0;

  return (
    <>
      <PageHeader
        title="Insights"
        description={`How you’ve used your guide library over the last ${ACTIVITY_DAYS} days, and where it has gaps. Only you can see this.`}
        howItWorks={
          <>
            Opening a guide and searching (without filters) are logged to your account. Repeating the same search within 30 minutes counts once. Logs older than {ACTIVITY_DAYS} days are deleted every night, and you can clear your search history in Settings. A <strong>search gap</strong> is something you searched for at least twice where your latest search found none of your guides.
          </>
        }
      />

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Guides opened" value={totals.opens} note="last 12 weeks" />
          <Stat label="Searches" value={totals.searches} note="last 12 weeks" />
          <Stat
            label="Searches that found no guide"
            value={totals.unmatchedPct === null ? "–" : `${totals.unmatchedPct}%`}
            note={totals.searches ? `${totals.unmatched} of ${totals.searches}` : "no searches yet"}
          />
          <Stat label="Guides added / edited" value={`${totals.added} / ${totals.edited}`} note="last 12 weeks" />
        </div>

        <Section id="weekly" title="Activity by week">
          {noActivity ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">No activity logged yet. Open guides and search as usual, and the weekly totals will build up here.</p>
          ) : (
            <>
              <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full" role="img" aria-label="Bar chart of guides opened, searches and searches that found no guide, per week">
                <BarChart data={chartData} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="opens" fill="var(--color-opens)" radius={3} />
                  <Bar dataKey="searches" fill="var(--color-searches)" radius={3} />
                  <Bar dataKey="unmatched" fill="var(--color-unmatched)" radius={3} />
                </BarChart>
              </ChartContainer>
              <details className="px-2 pb-1 text-sm">
                <summary className="cursor-pointer text-xs text-primary">Show figures as a table</summary>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr className="border-b text-left">
                        <th className="py-1.5 pr-3 font-medium">Week of</th>
                        <th className="py-1.5 pr-3 text-right font-medium">Opened</th>
                        <th className="py-1.5 pr-3 text-right font-medium">Searches</th>
                        <th className="py-1.5 pr-3 text-right font-medium">Found no guide</th>
                        <th className="py-1.5 pr-3 text-right font-medium">Added</th>
                        <th className="py-1.5 text-right font-medium">Edited</th>
                      </tr>
                    </thead>
                    <tbody className="num">
                      {chartData.map((w) => (
                        <tr key={w.weekStart} className="border-b last:border-0">
                          <td className="py-1.5 pr-3">{w.label}</td>
                          <td className="py-1.5 pr-3 text-right">{w.opens}</td>
                          <td className="py-1.5 pr-3 text-right">{w.searches}</td>
                          <td className="py-1.5 pr-3 text-right">{w.unmatched}</td>
                          <td className="py-1.5 pr-3 text-right">{w.added}</td>
                          <td className="py-1.5 text-right">{w.edited}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </Section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <Section id="gaps" title={`Search gaps (${gaps.length})`}>
            {gaps.length === 0 ? (
              <EmptyState icon={SearchCheck} title="No search gaps">
                When you search for the same thing at least twice and none of your guides match, it shows up here so you can write that guide.
              </EmptyState>
            ) : (
              <ul className="divide-y">
                {gaps.map((gap) => (
                  <li key={gap.query} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium break-words">“{gap.query}”</p>
                      <p className="text-xs text-muted-foreground">
                        Searched {gap.times}× · last {formatDate(gap.lastSearched)}
                        {gap.coveredBy && (
                          <>
                            {" · "}
                            <Link href={`/guides/${gap.coveredBy.code}`} className="text-primary hover:underline">
                              {gap.coveredBy.code} may cover this now
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <ButtonLink size="sm" variant="ghost" href={`/search?q=${encodeURIComponent(gap.query)}`} aria-label={`Search again for ${gap.query}`}>
                        <Search /> Search again
                      </ButtonLink>
                      {!gap.coveredBy && (
                        <ButtonLink size="sm" variant="outline" href={newGuideHref(gap.query)} aria-label={`Write a guide for ${gap.query}`}>
                          <FilePlus2 /> Write a guide
                        </ButtonLink>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="most-opened" title="Most opened" action={<span className="text-xs text-muted-foreground">last {ACTIVITY_DAYS} days</span>}>
            {topOpened.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">No guides opened yet.</p>
            ) : (
              <ul>
                {topOpened.map((o) => (
                  <GuideLine key={o.guide.id} g={o.guide} meta={`opened ${o.opens}× · last ${formatDate(o.lastOpened)}`} />
                ))}
              </ul>
            )}
          </Section>
        </div>

        <section aria-labelledby="health">
          <h2 id="health" className="mb-3 text-sm font-medium">
            Library health
          </h2>
          {health.total === 0 ? (
            <EmptyState
              icon={BookText}
              title="No guides yet"
              action={
                <ButtonLink href="/guides/new">
                  <FilePlus2 /> Write a guide
                </ButtonLink>
              }
            >
              Once you have guides, this shows which ones need checking, finishing or updating.
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="overflow-x-auto rounded-lg border bg-card">
                <table className="w-full text-sm">
                  <caption className="sr-only">Guides and verified guides per product</caption>
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b text-left">
                      <th className="px-4 py-2 font-medium">Product</th>
                      <th className="px-4 py-2 text-right font-medium">Guides</th>
                      <th className="px-4 py-2 text-right font-medium">Verified</th>
                    </tr>
                  </thead>
                  <tbody className="num">
                    {health.byProduct.map((p) => (
                      <tr key={p.product} className="border-b last:border-0">
                        <td className="px-4 py-2">
                          <Link href={`/guides?product=${encodeURIComponent(p.product)}`} className="hover:underline">
                            {shortProduct(p.product)}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-right">{p.count}</td>
                        <td className="px-4 py-2 text-right">{p.count ? `${p.verified} (${Math.round((p.verified / p.count) * 100)}%)` : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Section
                  id="to-verify"
                  title={`Not verified yet (${health.unverified.length})`}
                  action={
                    health.unverified.length > 0 && (
                      <Link href="/guides?status=unverified" className="text-xs text-primary hover:underline">
                        Show all
                      </Link>
                    )
                  }
                >
                  <p className="px-2 pt-1 pb-2 text-xs text-muted-foreground">Fixes you haven’t confirmed work yet.</p>
                  <GuideList guides={health.unverified} meta={(g) => `updated ${formatDate(g.updatedAt)}`} empty="Every guide is verified." />
                </Section>
                <Section id="incomplete" title={`Missing cause or fix steps (${health.incomplete.length})`}>
                  <p className="px-2 pt-1 pb-2 text-xs text-muted-foreground">A guide is easier to reuse when it says why the problem happens and how to fix it.</p>
                  <GuideList guides={health.incomplete} meta={(g) => (g.cause?.trim() ? "no fix steps" : g.steps.some((s) => s.trim()) ? "no cause" : "no cause or steps")} empty="Every guide has a cause and fix steps." />
                </Section>
                <Section id="stale" title={`Not edited for over a year (${health.stale.length})`}>
                  <p className="px-2 pt-1 pb-2 text-xs text-muted-foreground">Worth checking against the latest AutoCount version.</p>
                  <GuideList guides={health.stale} meta={(g) => `last edited ${formatDate(g.updatedAt)}`} empty="Every guide was edited within the last year." />
                </Section>
                <Section id="not-opened" title={`Not opened in ${ACTIVITY_DAYS} days (${notOpened.length})`}>
                  <p className="px-2 pt-1 pb-2 text-xs text-muted-foreground">
                    Guides older than {NOT_OPENED_MIN_AGE_DAYS} days you haven’t opened recently. Consider merging or retiring ones you no longer need.
                  </p>
                  <GuideList guides={notOpened} meta={(g) => `added ${formatDate(g.createdAt)}`} empty="You’ve opened every guide recently." />
                </Section>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
