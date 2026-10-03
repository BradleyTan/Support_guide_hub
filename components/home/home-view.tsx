"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { loadSampleData } from "@/app/(app)/actions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookText, Calculator, ChartColumn, FilePlus2, Landmark, Loader2, NotebookText, ScanBarcode, Search, Sparkles, Upload, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { Tag, VerifiedBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/states";
import { countBy, recentlyUpdated, shortProduct, topTags, unverified } from "@/lib/guide-utils";
import { ACTIVITY_DAYS, newGuideHref, type OpenedGuide, type SearchGap } from "@/lib/insights";
import { formatDate } from "@/lib/format";
import { PRODUCTS, type Guide, type Product } from "@/lib/types";

const productIcon: Record<Product, LucideIcon> = {
  "AutoCount Accounting": Landmark,
  "AutoCount Payroll": Wallet,
  "AutoCount POS": ScanBarcode,
  "AutoCount Account Book": NotebookText,
};

const exampleSearches = ["SQL Server not found", "PCB bonus", "e-Invoice TIN", "bank recon difference"];

function SearchBox({ large = false }: { large?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/search");
      }}
      className="flex gap-2"
    >
      <label htmlFor="home-search" className="sr-only">
        Search guides and official AutoCount sources
      </label>
      <div className="relative flex-1">
        <Search className={cn("pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground", large ? "size-5" : "size-4")} />
        <Input
          id="home-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Describe the problem or paste an error message"
          className={cn("bg-card", large ? "h-12 pl-10 text-base" : "h-9 pl-9")}
        />
      </div>
      <Button type="submit" size={large ? "lg" : "default"} className={large ? "h-12 px-5" : undefined}>
        Search
      </Button>
    </form>
  );
}

function GuideRow({ g, meta }: { g: Guide; meta: React.ReactNode }) {
  return (
    <li>
      <Link href={`/guides/${g.id}`} className="group flex items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/60">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium group-hover:underline">{g.title}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {g.id} · {shortProduct(g.product)} · {g.module} · {meta}
          </span>
        </span>
      </Link>
    </li>
  );
}

function Section({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </div>
      <div className="p-2">{children}</div>
    </section>
  );
}

export function HomeView({ guides, opened, gaps }: { guides: Guide[]; opened: OpenedGuide[]; gaps: SearchGap[] }) {
  const header = (
    <PageHeader
      title="Guidelines"
      description="Your own AutoCount fixes and how-tos, searchable in one place. Tickets stay in Zoho Desk."
      howItWorks={
        <>
          Search covers <strong>your guides</strong> and the <strong>official AutoCount help centres</strong>. “Most opened” counts how often you opened each guide in the last {ACTIVITY_DAYS} days; <strong>Insights</strong> has the full picture, including searches that found no guide.
        </>
      }
    />
  );

  if (guides.length === 0)
    return (
      <>
        {header}
        <EmptyState
          icon={BookText}
          title="Start your guide library"
          action={
            <>
              <ButtonLink href="/guides/new">
                <FilePlus2 /> Write your first guide
              </ButtonLink>
              <ButtonLink variant="outline" href="/guides/import">
                <Upload /> Import from Excel
              </ButtonLink>
              <LoadSampleButton />
            </>
          }
        >
          Write up a fix you’ve already done as a guide. You can also import an existing Excel log, or load 10 sample guides to try things out.
        </EmptyState>
      </>
    );

  return (
    <>
      {header}
      <SearchFirst guides={guides} opened={opened} gaps={gaps} />
    </>
  );
}

function LoadSampleButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await loadSampleData();
          if (res.ok) {
            toast.success(`Added ${res.guides} sample guides`, { description: "Plus sample analyses and templates." });
            router.refresh();
          } else toast.error(res.error);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} Load sample data
    </Button>
  );
}

function SearchFirst({ guides, opened, gaps }: { guides: Guide[]; opened: OpenedGuide[]; gaps: SearchGap[] }) {
  const openGaps = gaps.filter((g) => !g.coveredBy);
  const toCheck = unverified(guides);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <SearchBox large />
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          Try:
          {exampleSearches.map((s) => (
            <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="rounded-full border bg-card px-2 py-0.5 text-foreground hover:border-primary/50">
              {s}
            </Link>
          ))}
          <span className="hidden sm:inline">· paste error text exactly as it appears for the best match</span>
        </p>
      </div>

      <section aria-labelledby="by-product">
        <h2 id="by-product" className="mb-3 text-sm font-medium">
          Browse by product
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PRODUCTS.map((p) => {
            const list = guides.filter((g) => g.product === p);
            const modules = countBy(list, (g) => g.module);
            const Icon = productIcon[p];
            return (
              <div key={p} className="flex flex-col rounded-lg border bg-card p-4">
                <Link href={`/guides?product=${encodeURIComponent(p)}`} className="group flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <Icon className="size-4" />
                  </span>
                  <span className="flex-1 font-medium group-hover:underline">{shortProduct(p)}</span>
                  <span className="num text-sm text-muted-foreground">{list.length}</span>
                </Link>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {modules.length ? (
                    modules.map((m) => (
                      <li key={m.name}>
                        <Link
                          href={`/guides?product=${encodeURIComponent(p)}&module=${encodeURIComponent(m.name)}`}
                          className="inline-flex h-6 items-center rounded-md bg-muted px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          {m.name}
                        </Link>
                      </li>
                    ))
                  ) : (
                    <li className="text-xs text-muted-foreground">No guides yet</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Most opened" action={<span className="text-xs text-muted-foreground">last {ACTIVITY_DAYS} days</span>}>
          {opened.length ? (
            <ul>
              {opened.slice(0, 5).map((o) => (
                <GuideRow key={o.guide.id} g={o.guide} meta={`opened ${o.opens}×`} />
              ))}
            </ul>
          ) : (
            <p className="px-2 py-3 text-sm text-muted-foreground">Guides you open will be listed here.</p>
          )}
        </Section>
        <Section
          title="Recently updated"
          action={
            <Link href="/guides" className="text-xs text-primary hover:underline">
              All guides
            </Link>
          }
        >
          <ul>
            {recentlyUpdated(guides).map((g) => (
              <GuideRow key={g.id} g={g} meta={formatDate(g.updatedAt)} />
            ))}
          </ul>
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Section title={`Waiting for you to verify (${toCheck.length})`}>
          <p className="px-2 pt-1 pb-2 text-xs text-muted-foreground">Fixes you haven’t confirmed work yet. They show an “Unverified” label wherever they appear.</p>
          <ul>
            {toCheck.map((g) => (
              <GuideRow key={g.id} g={g} meta={<VerifiedBadge verified={false} className="h-4 align-middle text-[10px]" />} />
            ))}
          </ul>
        </Section>
        <div className="flex flex-col gap-4">
          <Section
            title={`Search gaps (${openGaps.length})`}
            action={
              <Link href="/insights" className="text-xs text-primary hover:underline">
                Insights
              </Link>
            }
          >
            {openGaps.length ? (
              <ul>
                {openGaps.slice(0, 3).map((gap) => (
                  <li key={gap.query}>
                    <Link href={newGuideHref(gap.query)} className="group block rounded-md px-2 py-2 transition-colors hover:bg-muted/60">
                      <span className="block text-sm font-medium break-words group-hover:underline">“{gap.query}”</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">searched {gap.times}×, no guide · write one</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-start gap-2 px-2 py-2 text-xs text-muted-foreground">
                <ChartColumn className="mt-0.5 size-3.5 shrink-0" />
                Searches you repeat that find none of your guides will show up here.
              </p>
            )}
          </Section>
          <Section title="Common topics">
          <ul className="flex flex-wrap gap-1.5 p-2">
            {topTags(guides, 10).map((t) => (
              <li key={t.name}>
                <Link href={`/search?q=${encodeURIComponent(t.name)}`}>
                  <Tag>
                    {t.name} · {t.count}
                  </Tag>
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 border-t p-2 pt-3">
            <ButtonLink size="sm" href="/guides/new">
              <FilePlus2 /> New guide
            </ButtonLink>
            <ButtonLink size="sm" variant="outline" href="/analyst">
              <Calculator /> Analyse scenario
            </ButtonLink>
          </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
