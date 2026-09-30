"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, BookOpenCheck, Copy, FileText, Image as ImageIcon, MessageSquareText, Pencil, Pin, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { HowThisWorks } from "@/components/shared/page-header";
import { ProductLabel, Tag, VerifiedBadge } from "@/components/shared/badges";
import { searchGuides, shortProduct } from "@/lib/guide-utils";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Guide } from "@/lib/types";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function GuideDetail({ guide: g, allGuides }: { guide: Guide; allGuides: Guide[] }) {
  const [verified, setVerified] = useState(g.verified);
  const similar = searchGuides(allGuides, `${g.title} ${g.tags.join(" ")}`)
    .filter((r) => r.guide.id !== g.id)
    .slice(0, 3);

  const back = (
    <Link href="/guides" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> Guide library
    </Link>
  );

  return (
    <>
      {back}
      <header className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono text-xs text-muted-foreground">{g.id}</span>
          <ProductLabel product={g.product} />
          <span className="text-xs text-muted-foreground">
            · {g.module} · v{g.version}
          </span>
          <VerifiedBadge verified={verified} />
        </div>
        <h1 className="max-w-[40ch] text-xl font-semibold tracking-tight sm:text-2xl">{g.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={verified ? "outline" : "default"}
            onClick={() => {
              setVerified(!verified);
              toast(verified ? "Marked as unverified" : "Marked as verified", { description: "Saved to the edit history." });
            }}
          >
            <BadgeCheck /> {verified ? "Mark unverified" : "Mark verified"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => toast("Edit mode is mocked", { description: "The real version edits in place and records a revision." })}>
            <Pencil /> Edit
          </Button>
          <ButtonLink size="sm" variant="outline" href={`/replies?guide=${g.id}`}>
            <MessageSquareText /> Draft client reply
          </ButtonLink>
          <ButtonLink size="sm" variant="outline" href={`/sop?guide=${g.id}`}>
            <BookOpenCheck /> Turn into SOP
          </ButtonLink>
        </div>
      </header>

      <HowThisWorks>
        Everything here is editable, and every change is saved to the <strong>edit history</strong>. Deleting a guide moves it to a bin for 30 days. Official links you pin from Search appear on the right.
      </HowThisWorks>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article className="flex max-w-[75ch] flex-col gap-6">
          <Block title="Symptom">
            <p>{g.symptom}</p>
          </Block>
          {g.errorMessage && (
            <Block title="Error message">
              <div className="group relative rounded-md border bg-muted/60 p-3 pr-10 font-mono text-[13px] leading-relaxed">
                {g.errorMessage}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-2 right-2"
                  aria-label="Copy error message"
                  onClick={() => {
                    navigator.clipboard?.writeText(g.errorMessage!);
                    toast("Error message copied");
                  }}
                >
                  <Copy />
                </Button>
              </div>
            </Block>
          )}
          {g.cause && (
            <Block title="Cause">
              <p>{g.cause}</p>
            </Block>
          )}
          <Block title="Fix">
            <ol className="space-y-3">
              {g.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="num flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          </Block>
          {g.prevention && (
            <Block title="Prevention">
              <p>{g.prevention}</p>
            </Block>
          )}
          {g.attachments.length > 0 && (
            <Block title="Attachments">
              <ul className="flex flex-wrap gap-2">
                {g.attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm">
                    {a.kind === "image" ? <ImageIcon className="size-4 text-muted-foreground" /> : a.kind === "pdf" ? <FileText className="size-4 text-muted-foreground" /> : <ScrollText className="size-4 text-muted-foreground" />}
                    {a.name}
                    <span className="text-xs text-muted-foreground">{a.sizeKb} KB</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">Stored privately. Links expire after 10 minutes.</p>
            </Block>
          )}
        </article>

        <aside className="flex flex-col gap-6 text-sm">
          <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 rounded-lg border bg-card p-4">
            <dt className="text-muted-foreground">Product</dt>
            <dd>{shortProduct(g.product)}</dd>
            <dt className="text-muted-foreground">Versions</dt>
            <dd>{g.version}</dd>
            <dt className="text-muted-foreground">Module</dt>
            <dd>{g.module}</dd>
            <dt className="text-muted-foreground">Category</dt>
            <dd>{g.category}</dd>
            <dt className="text-muted-foreground">Used</dt>
            <dd className="num">{g.uses} times</dd>
            <dt className="text-muted-foreground">Tags</dt>
            <dd className="flex flex-wrap gap-1">
              {g.tags.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </dd>
          </dl>

          <section className="space-y-2">
            <h2 className="flex items-center gap-1.5 font-medium">
              <Pin className="size-3.5" /> Pinned official sources
            </h2>
            <p className="text-xs text-muted-foreground">
              None yet. Pin useful AutoCount pages from{" "}
              <Link href={`/search?q=${encodeURIComponent(g.title)}`} className="text-primary hover:underline">
                Search
              </Link>{" "}
              and they appear here.
            </p>
          </section>

          {similar.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-medium">Similar guides</h2>
              <ul className="space-y-1.5">
                {similar.map(({ guide }) => (
                  <li key={guide.id}>
                    <Link href={`/guides/${guide.id}`} className="hover:underline">
                      <span className="font-mono text-xs text-muted-foreground">{guide.id}</span> {guide.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="font-medium">Edit history</h2>
            <ol className="space-y-2 border-l pl-3">
              {g.revisions.map((r) => (
                <li key={r.at}>
                  <span className="block text-xs text-muted-foreground">{formatDateTime(r.at)}</span>
                  {r.summary}
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">Created {formatDate(g.createdAt)}</p>
          </section>
        </aside>
      </div>
    </>
  );
}
