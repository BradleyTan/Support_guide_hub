"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookText, ExternalLink, Globe, ImagePlus, Pin, Search, SearchX, Sparkles, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button, ButtonLink, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { ConfidenceBadge, Tag, VerifiedBadge } from "@/components/shared/badges";
import { SmartInput } from "@/components/shared/smart-input";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { useDemoState } from "@/components/shell/demo-state";
import { guides } from "@/lib/mock/guides";
import { officialResults } from "@/lib/mock/library";
import { searchGuides, shortProduct } from "@/lib/guide-utils";
import { formatDate } from "@/lib/format";
import { PRODUCTS } from "@/lib/types";
import { googleFallbackUrl } from "@/lib/official-sites";

const googleFallback = (q: string) => googleFallbackUrl(q);

function SectionTitle({ id, n, icon: Icon, title, meta }: { id: string; n: string; icon: typeof BookText; title: string; meta?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="flex size-6 items-center justify-center rounded-md bg-accent text-xs font-semibold text-accent-foreground" aria-hidden>
        {n}
      </span>
      <Icon className="size-4 text-muted-foreground" />
      <h2 id={id} className="font-medium">
        {title}
      </h2>
      {meta && <span className="ml-auto text-xs text-muted-foreground">{meta}</span>}
    </div>
  );
}

export function SearchView({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const { state } = useDemoState();
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [product, setProduct] = useState<string | null>(null);
  const [byImage, setByImage] = useState(false);
  const [officialDown, setOfficialDown] = useState(false);

  function run(q: string) {
    setQuery(q);
    setInput(q);
    router.replace(q ? `/search?q=${encodeURIComponent(q)}` : "/search", { scroll: false });
  }

  const mine = searchGuides(guides, query)
    .map((r) => r.guide)
    .filter((g) => !product || g.product === product);
  const hasQuery = query.trim().length > 0;
  const noResults = state === "empty" || (hasQuery && mine.length === 0);
  const top = mine[0];

  return (
    <>
      <PageHeader
        title="Search"
        description="One search across your guides and official AutoCount sources, with an AI answer that cites both."
        howItWorks={
          <>
            <strong>Your guides</strong> are matched by keywords and by meaning. <strong>Official sources</strong> come from a free SearXNG search limited to AutoCount websites; results are cached for 7 days. If SearXNG is offline you get one-click Google links limited to AutoCount sites. The <strong>AI answer</strong> says clearly whether it relied on your guides, official docs, or both.
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-3">
        <form
          role="search"
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(input.trim());
          }}
        >
          <label htmlFor="q" className="sr-only">
            Search
          </label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="q" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Describe the problem or paste an error message" className="h-10 bg-card pl-9" />
          </div>
          <Button type="submit" className="h-10">
            Search
          </Button>
          <Button type="button" variant="outline" className="h-10" aria-pressed={byImage} onClick={() => setByImage(!byImage)}>
            <ImagePlus /> <span className="hidden sm:inline">By screenshot</span>
          </Button>
        </form>
        {byImage && (
          <SmartInput
            compact
            label="Screenshot of the error"
            placeholder="Paste or drop a screenshot of the error. You can add a note too."
            rows={2}
            extraction={[{ label: "Error text read from image", value: "The server was not found or was not accessible." }]}
            onUseExtraction={(fields) => {
              setByImage(false);
              run(fields[0].value);
            }}
          />
        )}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Product:</span>
          {[null, ...PRODUCTS].map((p) => (
            <button
              key={p ?? "all"}
              type="button"
              onClick={() => setProduct(p)}
              aria-pressed={product === p}
              className={cn("h-6 rounded-full border px-2.5 transition-colors", product === p ? "border-primary bg-accent text-accent-foreground" : "bg-card hover:border-ring/60")}
            >
              {p ? shortProduct(p) : "All"}
            </button>
          ))}
        </div>
      </div>

      {!hasQuery && state !== "loading" && state !== "error" ? (
        <EmptyState icon={Search} title="Search your guides and AutoCount’s own documentation">
          Type what the client told you, paste an error message, or search with a screenshot. For example:{" "}
          <button type="button" className="text-primary underline" onClick={() => run("server was not found")}>
            server was not found
          </button>
          .
        </EmptyState>
      ) : state === "error" ? (
        <ErrorState title="Search didn’t finish">The AI service didn’t reply (rate limit reached). Your guide results still work. Try the AI answer again in a minute.</ErrorState>
      ) : (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <div className="flex flex-col gap-8">
            {/* A. My guides */}
            <section aria-labelledby="sec-mine">
              <SectionTitle id="sec-mine" n="A" icon={BookText} title="Your guides" meta={state === "loading" ? "Searching…" : `${noResults ? 0 : mine.length} match${mine.length === 1 ? "" : "es"}`} />
              {state === "loading" ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : noResults ? (
                <EmptyState icon={SearchX} title="None of your guides match">
                  Check the official results, or{" "}
                  <Link href="/guides/new" className="text-primary underline">
                    write a guide
                  </Link>{" "}
                  once you’ve solved it.
                </EmptyState>
              ) : (
                <ul className="space-y-2">
                  {mine.map((g) => (
                    <li key={g.id}>
                      <Link href={`/guides/${g.id}`} className="group block rounded-lg border bg-card p-3 transition-colors hover:border-primary/50">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{g.id}</span>
                          {shortProduct(g.product)} · {g.module} · v{g.version}
                          <VerifiedBadge verified={g.verified} className="ml-auto" />
                        </div>
                        <p className="mt-1 font-medium group-hover:underline">{g.title}</p>
                        {g.errorMessage && <p className="mt-1 line-clamp-1 font-mono text-xs text-muted-foreground">{g.errorMessage}</p>}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {g.tags.slice(0, 4).map((t) => (
                            <Tag key={t}>{t}</Tag>
                          ))}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* B. Official sources */}
            <section aria-labelledby="sec-official">
              <SectionTitle
                id="sec-official"
                n="B"
                icon={Globe}
                title="Official AutoCount sources"
                meta={
                  <button type="button" onClick={() => setOfficialDown(!officialDown)} className="underline-offset-2 hover:underline">
                    {officialDown ? "Show: search online" : "Preview: search offline"}
                  </button>
                }
              />
              {state === "loading" ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : officialDown ? (
                <div className="rounded-lg border bg-card p-4 text-sm">
                  <p className="flex items-center gap-2 font-medium">
                    <WifiOff className="size-4 text-warning" /> Official search is offline
                  </p>
                  <p className="mt-1 text-muted-foreground">SearXNG didn’t respond. Search AutoCount’s sites directly instead:</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={googleFallback(query)} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm", variant: "outline" })}>
                      Google, AutoCount sites only <ExternalLink />
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  <ul className="divide-y rounded-lg border bg-card">
                    {officialResults.map((r) => (
                      <li key={r.title} className="flex gap-3 p-3">
                        <div className="min-w-0 flex-1">
                          <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 font-medium text-primary hover:underline">
                            {r.title} <ExternalLink className="mt-1 size-3 shrink-0" />
                          </a>
                          <p className="truncate text-xs text-muted-foreground">
                            {r.url} · {r.site} · cached {formatDate(r.cachedAt)}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">{r.snippet}</p>
                        </div>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Pin “${r.title}” to a guide`}
                          onClick={() => toast("Pinned (mock)", { description: top ? `Added to ${top.id} as an official source.` : "Choose a guide to pin it to." })}
                        >
                          <Pin />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Sample results. Not finding it?{" "}
                    <a href={googleFallback(query)} target="_blank" rel="noreferrer" className="text-primary underline">
                      Search Google, limited to AutoCount sites
                    </a>
                  </p>
                </>
              )}
            </section>
          </div>

          {/* C. AI answer */}
          <section aria-labelledby="sec-ai" className="xl:sticky xl:top-20 xl:self-start">
            <SectionTitle id="sec-ai" n="C" icon={Sparkles} title="AI answer" />
            <div className="rounded-lg border bg-card p-4 text-sm">
              {state === "loading" ? (
                <div className="space-y-2" aria-busy>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : noResults || !top ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Based on: official docs only</p>
                  <p>None of your guides cover this. The official results above are the best starting point. I don’t have enough to give confident steps, so I haven’t guessed any.</p>
                  <ConfidenceBadge level="Low" />
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">Based on: your guides + official docs</p>
                  <p>
                    This matches your guide <strong className="font-medium">“{top.title}”</strong>. Likely cause: {top.cause ?? "not recorded yet."}{" "}
                    <Link href={`/guides/${top.id}`} className="font-mono text-xs text-primary">
                      [{top.id}]
                    </Link>
                  </p>
                  <ol className="list-decimal space-y-1 pl-5">
                    {top.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                  <p className="text-muted-foreground">
                    The official troubleshooting page covers the same checks{" "}
                    <a href={officialResults[0].url} target="_blank" rel="noreferrer" className="font-mono text-xs text-primary">
                      [1]
                    </a>
                    .
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <ConfidenceBadge level={top.verified ? "High" : "Medium"} />
                    {!top.verified && <span className="text-xs text-muted-foreground">Your guide is unverified</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <ButtonLink size="sm" variant="outline" href={`/replies?guide=${top.id}`}>
                      Draft client reply
                    </ButtonLink>
                    <ButtonLink size="sm" variant="ghost" href="/guides/new">
                      Save as new guide
                    </ButtonLink>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
