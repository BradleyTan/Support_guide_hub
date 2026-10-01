"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { BookText, ExternalLink, Globe, Loader2, Pin, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Tag, VerifiedBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/states";
import { pinToGuide, searchMyGuides, searchOfficialSources, type GuideHit, type MatchSource, type OfficialResult, type SearchFilters } from "@/app/(app)/search/actions";
import { googleFallbackUrl, HELP_CENTRES, OTHER_OFFICIAL_SITES, type OfficialHit } from "@/lib/official-sites";
import { shortProduct } from "@/lib/guide-utils";
import { formatDate } from "@/lib/format";
import { PRODUCTS, type Product } from "@/lib/types";

const MATCH_LABEL: Record<MatchSource, string> = { words: "Same words", fuzzy: "Similar spelling", meaning: "Similar meaning" };
const ANY = "any";
const PERIODS = [
  { value: ANY, label: "Any time" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
];

type OfficialState = OfficialResult | null;

function SectionTitle({ id, icon: Icon, title, meta }: { id: string; icon: typeof BookText; title: string; meta?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Icon className="size-4 text-muted-foreground" />
      <h2 id={id} className="font-medium">
        {title}
      </h2>
      {meta && <span className="ml-auto text-xs text-muted-foreground">{meta}</span>}
    </div>
  );
}

function PinDialog({ hit, guides, onClose }: { hit: OfficialHit | null; guides: { id: string; title: string }[]; onClose: () => void }) {
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return (f ? guides.filter((g) => `${g.id} ${g.title}`.toLowerCase().includes(f)) : guides).slice(0, 50);
  }, [filter, guides]);

  return (
    <Dialog open={!!hit} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pin to a guide</DialogTitle>
          <DialogDescription className="line-clamp-2">{hit?.title}</DialogDescription>
        </DialogHeader>
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a guide by number or title" aria-label="Find a guide" autoFocus />
        <ul className="max-h-72 overflow-y-auto rounded-md border">
          {shown.length === 0 && <li className="p-3 text-sm text-muted-foreground">No guides match.</li>}
          {shown.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                disabled={!!busy}
                onClick={async () => {
                  if (!hit) return;
                  setBusy(g.id);
                  const res = await pinToGuide({ code: g.id, title: hit.title, url: hit.url });
                  setBusy(null);
                  if (res.ok) {
                    toast.success(`Pinned to ${g.id}`);
                    onClose();
                  } else toast.error(res.error);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-60"
              >
                <span className="font-mono text-xs text-muted-foreground">{g.id}</span>
                <span className="min-w-0 flex-1 truncate">{g.title}</span>
                {busy === g.id && <Loader2 className="size-4 animate-spin" />}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export function SearchView({
  initialQuery,
  initialMine,
  initialOfficial,
  guides,
}: {
  initialQuery: string;
  /** First results, computed on the server when the page is opened with ?q= */
  initialMine: Awaited<ReturnType<typeof searchMyGuides>> | null;
  initialOfficial: OfficialState;
  guides: { id: string; title: string }[];
}) {
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [period, setPeriod] = useState(ANY);

  const [mine, setMine] = useState<{ hits: GuideHit[]; meaningUsed: boolean } | null>(initialMine?.ok ? { hits: initialMine.hits, meaningUsed: initialMine.meaningUsed } : null);
  const [mineError, setMineError] = useState<string | null>(initialMine && !initialMine.ok ? initialMine.error : null);
  const [official, setOfficial] = useState<OfficialState>(initialOfficial);
  const [loadingMine, startMine] = useTransition();
  const [loadingOfficial, startOfficial] = useTransition();
  const [pinning, setPinning] = useState<OfficialHit | null>(null);

  const run = useCallback((q: string, f: SearchFilters) => {
    if (!q.trim()) {
      setMine(null);
      setOfficial(null);
      return;
    }
    startMine(async () => {
      const res = await searchMyGuides(q, f);
      if (res.ok) {
        setMine({ hits: res.hits, meaningUsed: res.meaningUsed });
        setMineError(null);
      } else setMineError(res.error);
    });
    startOfficial(async () => setOfficial(await searchOfficialSources(q)));
  }, []);

  function submit(q: string, f = filters) {
    const next = q.trim();
    setQuery(next);
    setInput(next);
    // Update the address only (shareable link) without asking the server to render the page and search again.
    window.history.replaceState(null, "", next ? `/search?q=${encodeURIComponent(next)}` : "/search");
    run(next, f);
  }

  function setFilter<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    const f = { ...filters, [key]: value };
    setFilters(f);
    if (query) run(query, f);
  }

  const activeFilters = Object.values(filters).filter((v) => v !== null && v !== undefined && v !== "").length;
  const hasQuery = query.trim().length > 0;

  return (
    <>
      <PageHeader
        title="Search"
        description="Search your guides and official AutoCount sources at the same time. Paste an error message exactly as it appears for the best match."
        howItWorks={
          <>
            Both lists match on the same words, similar spelling and similar meaning. <strong>Official sources</strong> are the AutoCount Cloud Accounting and HRMS help centres ({HELP_CENTRES.map((h) => h.domain).join(", ")}),
            refreshed daily from their published article lists. They’re written for AutoCount’s cloud products, so menus can differ from desktop AutoCount. The AutoCount website and wiki are offered as Google searches.
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-3">
        <form
          role="search"
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
        >
          <label htmlFor="q" className="sr-only">
            Search
          </label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="q" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Describe the problem or paste the error text" className="h-10 bg-card pl-9" maxLength={1000} />
          </div>
          <Button type="submit" className="h-10">
            Search
          </Button>
          <Button type="button" variant="outline" className="h-10" aria-label="Filters" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal /> <span className="hidden sm:inline">Filters</span>
            {activeFilters > 0 && <span className="num rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{activeFilters}</span>}
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Product:</span>
          {[null, ...PRODUCTS].map((p) => (
            <button
              key={p ?? "all"}
              type="button"
              onClick={() => setFilter("product", p as Product | null)}
              aria-pressed={(filters.product ?? null) === p}
              className={cn(
                "h-6 rounded-full border px-2.5 transition-colors",
                (filters.product ?? null) === p ? "border-primary bg-accent text-accent-foreground" : "bg-card hover:border-ring/60",
              )}
            >
              {p ? shortProduct(p) : "All"}
            </button>
          ))}
        </div>

        {showFilters && (
          <div className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="f-module" className="text-xs">
                Module
              </Label>
              <Input id="f-module" placeholder="e.g. Bank Reconciliation" defaultValue={filters.module ?? ""} onBlur={(e) => setFilter("module", e.target.value.trim() || null)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="f-version" className="text-xs">
                Version
              </Label>
              <Input id="f-version" placeholder="e.g. 2.2" defaultValue={filters.version ?? ""} onBlur={(e) => setFilter("version", e.target.value.trim() || null)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="f-tag" className="text-xs">
                Tag
              </Label>
              <Input id="f-tag" placeholder="e.g. sst" defaultValue={filters.tag ?? ""} onBlur={(e) => setFilter("tag", e.target.value.trim() || null)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="f-period" className="text-xs">
                Updated
              </Label>
              <Select
                value={period}
                onValueChange={(v) => {
                  setPeriod(String(v));
                  setFilter("updatedWithinDays", v === ANY ? null : Number(v));
                }}
              >
                <SelectTrigger id="f-period" className="w-full">
                  <SelectValue>{(v: string) => PERIODS.find((p) => p.value === v)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {activeFilters > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-fit sm:col-span-2 lg:col-span-4"
                onClick={() => {
                  setFilters({});
                  setPeriod(ANY);
                  setShowFilters(false);
                  if (query) run(query, {});
                }}
              >
                <X /> Clear filters
              </Button>
            )}
          </div>
        )}
      </div>

      {!hasQuery ? (
        <EmptyState icon={Search} title="Search your guides and AutoCount’s own documentation">
          Type what the client told you, or paste the error text from their screenshot. For example:{" "}
          <button type="button" className="text-primary underline" onClick={() => submit("server was not found")}>
            server was not found
          </button>
          .
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          <section aria-labelledby="sec-mine" aria-busy={loadingMine} className="min-w-0">
            <SectionTitle
              id="sec-mine"
              icon={BookText}
              title="Your guides"
              meta={loadingMine ? "Searching…" : mine ? `${mine.hits.length} match${mine.hits.length === 1 ? "" : "es"}${mine.meaningUsed ? "" : " · meaning search unavailable"}` : null}
            />
            {loadingMine && !mine ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : mineError ? (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/[0.05] p-4 text-sm">
                {mineError}
              </p>
            ) : mine && mine.hits.length === 0 ? (
              <EmptyState icon={SearchX} title="None of your guides match">
                Try other words, remove filters, or check the official results.{" "}
                <Link href="/guides/new" className="text-primary underline">
                  Write a guide
                </Link>{" "}
                once you’ve solved it.
              </EmptyState>
            ) : (
              <ul className={cn("space-y-2 transition-opacity", loadingMine && "opacity-60")}>
                {mine?.hits.map((g) => (
                  <li key={g.id}>
                    <Link href={`/guides/${g.id}`} className="group block rounded-lg border bg-card p-3 transition-colors hover:border-primary/50">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{g.id}</span>
                        {shortProduct(g.product)}
                        {g.module && ` · ${g.module}`}
                        {g.version && ` · v${g.version}`}
                        <VerifiedBadge verified={g.verified} className="ml-auto" />
                      </div>
                      <p className="mt-1 font-medium group-hover:underline">{g.title}</p>
                      {g.errorMessage && <p className="mt-1 line-clamp-1 font-mono text-xs text-muted-foreground">{g.errorMessage}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {g.matchedBy.map((m) => (
                          <span key={m} className="inline-flex h-5 items-center rounded bg-accent px-1.5 text-[11px] text-accent-foreground">
                            {MATCH_LABEL[m]}
                          </span>
                        ))}
                        {g.tags.slice(0, 3).map((t) => (
                          <Tag key={t}>{t}</Tag>
                        ))}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="sec-official" aria-busy={loadingOfficial} className="min-w-0">
            <SectionTitle
              id="sec-official"
              icon={Globe}
              title="Official AutoCount sources"
              meta={loadingOfficial ? "Searching…" : official?.status === "ok" ? `${official.indexed.toLocaleString()} help-centre articles searched` : null}
            />
            {loadingOfficial && !official ? (
              <div className="space-y-2">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : official?.status === "error" ? (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/[0.05] p-4 text-sm">
                {official.reason}
              </p>
            ) : null}

            {official?.status === "ok" && official.results.length > 0 && (
              <ul className={cn("mt-2 divide-y rounded-lg border bg-card transition-opacity", loadingOfficial && "opacity-60")}>
                {official.results.map((r) => (
                  <li key={r.url} className="flex gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 font-medium text-primary hover:underline">
                        {r.title} <ExternalLink className="mt-1 size-3 shrink-0" />
                      </a>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.site}
                        {r.lastmod && ` · updated ${formatDate(r.lastmod)}`}
                      </p>
                      {r.snippet && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{r.snippet}</p>}
                      {r.matchedBy && r.matchedBy.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {r.matchedBy.map((m) => (
                            <span key={m} className="inline-flex h-5 items-center rounded bg-accent px-1.5 text-[11px] text-accent-foreground">
                              {MATCH_LABEL[m as MatchSource] ?? m}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button size="icon-sm" variant="ghost" aria-label={`Pin “${r.title}” to a guide`} onClick={() => setPinning(r)} disabled={guides.length === 0}>
                      <Pin />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {official?.status === "ok" && official.results.length === 0 && (
              <EmptyState icon={SearchX} title="No help-centre articles match">
                Try fewer or different words, or search the other official sites below.
              </EmptyState>
            )}

            {hasQuery && (
              <div className="mt-3 rounded-lg border bg-card p-3 text-sm">
                <p className="text-muted-foreground">Also search on Google, limited to:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href={googleFallbackUrl(query, OTHER_OFFICIAL_SITES.map((s) => s.domain))} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm", variant: "outline" })}>
                    AutoCount website & wiki <ExternalLink />
                  </a>
                  <a href={googleFallbackUrl(query)} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm", variant: "ghost" })}>
                    All official sites <ExternalLink />
                  </a>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      <PinDialog hit={pinning} guides={guides} onClose={() => setPinning(null)} />
    </>
  );
}
