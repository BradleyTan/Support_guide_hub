"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookText, Calculator, FilePlus2, Landmark, NotebookText, ScanBarcode, Search, Upload, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { ProductLabel, Tag, VerifiedBadge } from "@/components/shared/badges";
import { BlockSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { useDemoState } from "@/components/shell/demo-state";
import { guides } from "@/lib/mock/guides";
import { countBy, mostUsed, recentlyUpdated, shortProduct, topTags, unverified } from "@/lib/guide-utils";
import { formatDate } from "@/lib/format";
import { CATEGORIES, PRODUCTS, type Guide, type Product } from "@/lib/types";

type Layout = "a" | "b";

const productIcon: Record<Product, LucideIcon> = {
  "AutoCount Accounting": Landmark,
  "AutoCount Payroll": Wallet,
  "AutoCount POS": ScanBarcode,
  "AutoCount Account Book": NotebookText,
};

const exampleSearches = ["SQL Server not found", "PCB bonus", "e-Invoice TIN", "bank recon difference"];

function LayoutSwitch({ layout }: { layout: Layout }) {
  const router = useRouter();
  return (
    <div role="radiogroup" aria-label="Home layout option" className="inline-flex rounded-lg border bg-card p-0.5 text-sm">
      {(["a", "b"] as const).map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={layout === l}
          onClick={() => router.replace(l === "a" ? "/" : "/?style=b", { scroll: false })}
          className={cn("h-7 rounded-md px-3 transition-colors", layout === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {l === "a" ? "Option A · Search-first" : "Option B · Library shelf"}
        </button>
      ))}
    </div>
  );
}

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
          placeholder={large ? "Describe the problem or paste an error message" : "Search guides or errors"}
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

export function HomeView({ layout }: { layout: Layout }) {
  const { state } = useDemoState();
  const header = (
    <PageHeader
      title="Guidelines"
      description="Your own AutoCount fixes and how-tos, searchable in one place. Tickets stay in Zoho Desk."
      actions={<LayoutSwitch layout={layout} />}
      howItWorks={
        <>
          Search covers <strong>your guides</strong> and <strong>official AutoCount sources</strong>, and the AI writes an answer with citations. “Most used” counts how often you open a guide or use it in a reply. Pick Option A or B here; the one you choose becomes the home screen.
        </>
      }
    />
  );

  if (state === "loading")
    return (
      <>
        {header}
        <div className="grid gap-4 lg:grid-cols-4">
          <BlockSkeleton className="h-14 lg:col-span-4" />
          {[0, 1, 2, 3].map((i) => (
            <BlockSkeleton key={i} className="h-32" />
          ))}
          <BlockSkeleton className="h-64 lg:col-span-2" />
          <BlockSkeleton className="h-64 lg:col-span-2" />
        </div>
      </>
    );
  if (state === "error")
    return (
      <>
        {header}
        <ErrorState title="Couldn’t load your guides">The database didn’t respond within 10 seconds. Your guides are safe. Check your connection and try again.</ErrorState>
      </>
    );
  if (state === "empty")
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
            </>
          }
        >
          Turn a fix you’ve already done into a guide: paste your notes or a screenshot and the AI drafts it for you to check. You can also import an existing Excel log.
        </EmptyState>
      </>
    );

  return (
    <>
      {header}
      {layout === "a" ? <SearchFirst /> : <LibraryShelf />}
    </>
  );
}

/* ---------- Option A: Search-first ---------- */

function SearchFirst() {
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
          <span className="hidden sm:inline">· or paste a screenshot on the Search page</span>
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
        <Section title="Most used" action={<span className="text-xs text-muted-foreground">last 90 days</span>}>
          <ul>
            {mostUsed(guides).map((g) => (
              <GuideRow key={g.id} g={g} meta={`used ${g.uses}×`} />
            ))}
          </ul>
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
          <p className="px-2 pt-1 pb-2 text-xs text-muted-foreground">These fixes haven’t been confirmed yet, so the AI labels them unverified when it quotes them.</p>
          <ul>
            {toCheck.map((g) => (
              <GuideRow key={g.id} g={g} meta={<VerifiedBadge verified={false} className="h-4 align-middle text-[10px]" />} />
            ))}
          </ul>
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
  );
}

/* ---------- Option B: Library shelf ---------- */

function LibraryShelf() {
  const cats = CATEGORIES.map((c) => ({ name: c, items: guides.filter((g) => g.category === c) })).filter((c) => c.items.length);
  const [active, setActive] = useState(cats[0].name);
  const current = cats.find((c) => c.name === active) ?? cats[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="flex flex-col gap-4">
        <SearchBox />
        <nav aria-label="Guide categories" className="rounded-lg border bg-card p-1.5">
          <p className="px-2 pt-1 pb-1.5 text-xs font-medium text-muted-foreground">Contents</p>
          <ul>
            {cats.map((c) => (
              <li key={c.name}>
                <button
                  type="button"
                  onClick={() => setActive(c.name)}
                  aria-current={c.name === active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    c.name === active ? "bg-accent font-medium text-accent-foreground" : "hover:bg-muted",
                  )}
                >
                  <span className="flex-1">{c.name}</span>
                  <span className="num text-xs text-muted-foreground">{c.items.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-col gap-2">
          <ButtonLink href="/guides/new">
            <FilePlus2 /> New guide
          </ButtonLink>
          <ButtonLink variant="outline" href="/analyst">
            <Calculator /> Analyse scenario
          </ButtonLink>
        </div>
      </aside>

      <section aria-labelledby="shelf-title">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 id="shelf-title" className="text-lg font-semibold">
            {current.name}
          </h2>
          <Link href="/guides" className="text-sm text-primary hover:underline">
            Open library
          </Link>
        </div>
        <ol className="divide-y rounded-lg border bg-card">
          {current.items.map((g) => (
            <li key={g.id}>
              <Link href={`/guides/${g.id}`} className="group block p-4 transition-colors hover:bg-muted/40">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{g.id}</span>
                  <ProductLabel product={g.product} />
                  <span className="text-xs text-muted-foreground">· {g.module} · v{g.version}</span>
                  <VerifiedBadge verified={g.verified} className="ml-auto" />
                </div>
                <h3 className="mt-1.5 font-medium group-hover:underline">{g.title}</h3>
                <p className="mt-1 max-w-[75ch] text-sm text-muted-foreground">{g.symptom}</p>
                <p className="mt-2 flex items-start gap-1.5 text-sm">
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    <span className="text-muted-foreground">First step: </span>
                    {g.steps[0]}
                  </span>
                </p>
              </Link>
            </li>
          ))}
        </ol>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Section title="Most used">
            <ul>
              {mostUsed(guides, 4).map((g) => (
                <GuideRow key={g.id} g={g} meta={`used ${g.uses}×`} />
              ))}
            </ul>
          </Section>
          <Section title={`Waiting for you to verify (${unverified(guides).length})`}>
            <ul>
              {unverified(guides).map((g) => (
                <GuideRow key={g.id} g={g} meta={formatDate(g.updatedAt)} />
              ))}
            </ul>
          </Section>
        </div>
      </section>
    </div>
  );
}
