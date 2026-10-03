"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, BookOpenCheck, Copy, ExternalLink, Loader2, MessageSquareText, Pencil, Pin, Trash2, X } from "lucide-react";
import { unpin } from "@/app/(app)/search/actions";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProductLabel, Tag, VerifiedBadge } from "@/components/shared/badges";
import { AttachmentList } from "@/components/guides/attachments";
import { deleteGuide, restoreGuide, setVerified } from "@/app/(app)/guides/actions";
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

export function GuideDetail({ guide: g, allGuides, userId }: { guide: Guide; allGuides: Guide[]; userId: string }) {
  const router = useRouter();
  const [verifying, startVerify] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const similar = searchGuides(allGuides, `${g.title} ${g.tags.join(" ")}`)
    .filter((r) => r.guide.id !== g.id)
    .slice(0, 3);

  function toggleVerified() {
    startVerify(async () => {
      const res = await setVerified(g.id, !g.verified);
      if (res.ok) {
        toast.success(g.verified ? "Marked as unverified" : "Marked as verified");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function remove() {
    startDelete(async () => {
      const res = await deleteGuide(g.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setConfirmOpen(false);
      toast.success(`${g.id} moved to the bin`, {
        description: "You can restore it from Settings within 30 days.",
        action: {
          label: "Undo",
          onClick: async () => {
            const back = await restoreGuide(g.id);
            if (back.ok) {
              toast.success(`${g.id} restored`);
              router.push(`/guides/${g.id}`);
            } else toast.error(back.error);
          },
        },
      });
      router.push("/guides");
    });
  }

  return (
    <>
      <Link href="/guides" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Guide library
      </Link>
      <header className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono text-xs text-muted-foreground">{g.id}</span>
          <ProductLabel product={g.product} />
          {(g.module || g.version) && (
            <span className="text-xs text-muted-foreground">
              {g.module && `· ${g.module}`} {g.version && `· v${g.version}`}
            </span>
          )}
          <VerifiedBadge verified={g.verified} />
        </div>
        <h1 className="max-w-[40ch] text-xl font-semibold tracking-tight sm:text-2xl">{g.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={g.verified ? "outline" : "default"} onClick={toggleVerified} disabled={verifying}>
            {verifying ? <Loader2 className="animate-spin" /> : <BadgeCheck />} {g.verified ? "Mark unverified" : "Mark verified"}
          </Button>
          <ButtonLink size="sm" variant="outline" href={`/guides/${g.id}/edit`}>
            <Pencil /> Edit
          </ButtonLink>
          <ButtonLink size="sm" variant="outline" href={`/replies?guide=${g.id}`}>
            <MessageSquareText /> Draft client reply
          </ButtonLink>
          <ButtonLink size="sm" variant="outline" href={`/sop/new?guide=${g.id}`}>
            <BookOpenCheck /> Turn into SOP
          </ButtonLink>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmOpen(true)}>
            <Trash2 /> Delete
          </Button>
        </div>
      </header>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {g.id} to the bin?</DialogTitle>
            <DialogDescription>It disappears from the library and search. You can restore it from Settings → Deleted guides within 30 days.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={remove} disabled={deleting}>
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />} Move to bin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article className="flex max-w-[75ch] flex-col gap-6">
          {g.symptom && (
            <Block title="Symptom">
              <p className="whitespace-pre-line">{g.symptom}</p>
            </Block>
          )}
          {g.errorMessage && (
            <Block title="Error message">
              <div className="group relative rounded-md border bg-muted/60 p-3 pr-10 font-mono text-[13px] leading-relaxed whitespace-pre-wrap">
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
              <p className="whitespace-pre-line">{g.cause}</p>
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
              <p className="whitespace-pre-line">{g.prevention}</p>
            </Block>
          )}
          <Block title="Attachments">
            {g.dbId ? <AttachmentList code={g.id} guideDbId={g.dbId} userId={userId} attachments={g.attachments} /> : null}
          </Block>
        </article>

        <aside className="flex flex-col gap-6 text-sm">
          <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 rounded-lg border bg-card p-4">
            <dt className="text-muted-foreground">Product</dt>
            <dd>{shortProduct(g.product)}</dd>
            <dt className="text-muted-foreground">Versions</dt>
            <dd>{g.version || "—"}</dd>
            <dt className="text-muted-foreground">Module</dt>
            <dd>{g.module || "—"}</dd>
            <dt className="text-muted-foreground">Category</dt>
            <dd>{g.category ?? "—"}</dd>
            <dt className="text-muted-foreground">Used</dt>
            <dd className="num">
              {g.uses} time{g.uses === 1 ? "" : "s"}
            </dd>
            <dt className="text-muted-foreground">Tags</dt>
            <dd className="flex flex-wrap gap-1">{g.tags.length ? g.tags.map((t) => <Tag key={t}>{t}</Tag>) : "—"}</dd>
          </dl>

          <section className="space-y-2">
            <h2 className="flex items-center gap-1.5 font-medium">
              <Pin className="size-3.5" /> Pinned official sources
            </h2>
            {g.pins?.length ? (
              <ul className="space-y-2">
                {g.pins.map((p) => (
                  <li key={p.id} className="group flex items-start gap-1.5">
                    <div className="min-w-0 flex-1">
                      <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-primary hover:underline">
                        {p.title} <ExternalLink className="mt-0.5 size-3 shrink-0" />
                      </a>
                      <span className="block text-xs text-muted-foreground">{p.site}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Unpin ${p.title}`}
                      onClick={async () => {
                        const res = await unpin(p.id);
                        if (res.ok) router.refresh();
                        else toast.error(res.error);
                      }}
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                None yet. Pin useful AutoCount pages from{" "}
                <Link href={`/search?q=${encodeURIComponent(g.title)}`} className="text-primary hover:underline">
                  Search
                </Link>{" "}
                and they appear here.
              </p>
            )}
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
              {[...g.revisions].reverse().map((r, i) => (
                <li key={`${r.at}-${i}`}>
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
