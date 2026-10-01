"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookText, Download, FilePlus2, Paperclip, SearchX, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { Tag, VerifiedBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/states";
import { searchGuides, shortProduct } from "@/lib/guide-utils";
import { formatDate } from "@/lib/format";
import { exportFileName, guidesSheet } from "@/lib/export";
import { downloadXlsx } from "@/lib/download-xlsx";
import { CATEGORIES, PRODUCTS, type Guide } from "@/lib/types";

const ALL = "all";

function FilterSelect({ label, allLabel, value, onChange, options }: { label: string; allLabel: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const labels = new Map([[ALL, allLabel], ...options.map((o) => [o.value, o.label] as const)]);
  return (
    <Select value={value} onValueChange={(v) => onChange(String(v))}>
      <SelectTrigger size="sm" aria-label={label} className="min-w-32">
        <SelectValue>{(v: string) => labels.get(v)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{labels.get(ALL)}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function GuideList({
  guides,
  initialProduct,
  initialModule,
  initialVerified,
}: {
  guides: Guide[];
  initialProduct?: string;
  initialModule?: string;
  initialVerified?: string;
}) {
  const [q, setQ] = useState("");
  const [product, setProduct] = useState(initialProduct ?? ALL);
  const [module, setModule] = useState(initialModule ?? ALL);
  const [category, setCategory] = useState(ALL);
  const [verified, setVerified] = useState(initialVerified ?? ALL);

  const modules = useMemo(() => [...new Set(guides.filter((g) => product === ALL || g.product === product).map((g) => g.module))].sort(), [guides, product]);

  const rows = useMemo(() => {
    let list = q.trim() ? searchGuides(guides, q).map((r) => r.guide) : [...guides].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (product !== ALL) list = list.filter((g) => g.product === product);
    if (module !== ALL) list = list.filter((g) => g.module === module);
    if (category !== ALL) list = list.filter((g) => g.category === category);
    if (verified !== ALL) list = list.filter((g) => g.verified === (verified === "yes"));
    return list;
  }, [guides, q, product, module, category, verified]);

  const filtered = q || product !== ALL || module !== ALL || category !== ALL || verified !== ALL;
  function clear() {
    setQ("");
    setProduct(ALL);
    setModule(ALL);
    setCategory(ALL);
    setVerified(ALL);
  }

  return (
    <>
      <PageHeader
        title="Guide library"
        description="Every fix and how-to you’ve written, filterable by product, module and category."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={rows.length === 0}
              onClick={async () => {
                try {
                  await downloadXlsx(exportFileName("guides"), [guidesSheet(rows)]);
                  toast.success(`Exported ${rows.length} guide${rows.length === 1 ? "" : "s"}`, { description: "The file can be imported again later." });
                } catch {
                  toast.error("Couldn’t create the Excel file. Please try again.");
                }
              }}
            >
              <Download /> Export{rows.length !== guides.length ? ` ${rows.length}` : ""}
            </Button>
            <ButtonLink variant="outline" size="sm" href="/guides/import">
              <Upload /> Import
            </ButtonLink>
            <ButtonLink size="sm" href="/guides/new">
              <FilePlus2 /> New guide
            </ButtonLink>
          </>
        }
        howItWorks={
          <>
            Guides are stored in Supabase and only you can see them. The filter box here matches words; the <strong>Search</strong> page adds meaning-based matching and official AutoCount sources. <strong>Verified</strong> means you’ve confirmed the fix works.
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by words, error text or tag" aria-label="Filter guides" className="h-8 w-full bg-card sm:w-72" />
        <FilterSelect
          label="Product"
          allLabel="All products"
          value={product}
          onChange={(v) => {
            setProduct(v);
            setModule(ALL);
          }}
          options={PRODUCTS.map((p) => ({ value: p, label: shortProduct(p) }))}
        />
        <FilterSelect label="Module" allLabel="All modules" value={module} onChange={setModule} options={modules.map((m) => ({ value: m, label: m }))} />
        <FilterSelect label="Category" allLabel="All categories" value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
        <FilterSelect
          label="Status"
          allLabel="Verified or not"
          value={verified}
          onChange={setVerified}
          options={[
            { value: "yes", label: "Verified" },
            { value: "no", label: "Unverified" },
          ]}
        />
        {filtered && (
          <Button variant="ghost" size="sm" onClick={clear}>
            <X /> Clear
          </Button>
        )}
      </div>

      {guides.length === 0 ? (
        <EmptyState
          icon={BookText}
          title="No guides yet"
          action={
            <>
              <ButtonLink href="/guides/new">
                <FilePlus2 /> Write a guide
              </ButtonLink>
              <ButtonLink variant="outline" href="/guides/import">
                <Upload /> Import from Excel
              </ButtonLink>
            </>
          }
        >
          Write up a fix you’ve already done, or import your old Excel log in one go.
        </EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState icon={SearchX} title="No guides match these filters" action={<Button variant="outline" onClick={clear}>Clear filters</Button>}>
          Try fewer words, or search official AutoCount sources on the Search page.
        </EmptyState>
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            {rows.length} guide{rows.length === 1 ? "" : "s"}
          </p>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">ID</TableHead>
                  <TableHead>Guide</TableHead>
                  <TableHead className="w-44">Product · module</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-16 text-right">Used</TableHead>
                  <TableHead className="w-28">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((g) => (
                  <TableRow key={g.id} className="group relative">
                    <TableCell className="font-mono text-xs text-muted-foreground">{g.id}</TableCell>
                    <TableCell className="max-w-0 whitespace-normal">
                      <Link href={`/guides/${g.id}`} className="font-medium after:absolute after:inset-0 group-hover:underline">
                        {g.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {g.tags.slice(0, 3).map((t) => (
                          <Tag key={t}>{t}</Tag>
                        ))}
                        {g.attachments.length > 0 && (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                            <Paperclip className="size-3" /> {g.attachments.length}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm whitespace-normal">
                      {shortProduct(g.product)}
                      <span className="block text-xs text-muted-foreground">{g.module}</span>
                    </TableCell>
                    <TableCell>
                      <VerifiedBadge verified={g.verified} />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{g.uses}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(g.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {/* Phone list */}
          <ul className="space-y-2 md:hidden">
            {rows.map((g) => (
              <li key={g.id}>
                <Link href={`/guides/${g.id}`} className="block rounded-lg border bg-card p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{g.id}</span>
                    <span>
                      {shortProduct(g.product)} · {g.module}
                    </span>
                    <VerifiedBadge verified={g.verified} className="ml-auto" />
                  </div>
                  <p className="mt-1 font-medium">{g.title}</p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
