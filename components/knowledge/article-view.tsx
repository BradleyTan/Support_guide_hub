"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, Copy, ExternalLink, Loader2, MapPin, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsOwner } from "@/components/shell/team-context";
import { NeedsVerification } from "@/components/shared/badges";
import { ReviewedBadge } from "@/components/knowledge/reviewed-badge";
import { deleteArticle, restoreArticle, setArticleReviewed, setStepsVerified, updateFromStarter } from "@/app/(app)/knowledge/actions";
import { NOT_FOUND_STEPS, type KnowledgeArticle } from "@/lib/knowledge/model";
import { formatDate } from "@/lib/format";

export type RelatedLink = { title: string; id: string | null };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Steps({ label, steps, verified }: { label: "Desktop" | "Cloud"; steps: string | null; verified: boolean }) {
  return (
    <div role="group" aria-label={label} className="rounded-lg border bg-card p-3">
      <p className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
        {label === "Desktop" ? "Desktop (AutoCount Accounting)" : "Cloud (AutoCount Cloud Accounting)"}
        {steps && !verified && <NeedsVerification />}
      </p>
      {steps ? <p className="text-sm break-words whitespace-pre-line">{steps}</p> : <p className="text-sm text-muted-foreground italic">{NOT_FOUND_STEPS}</p>}
    </div>
  );
}

export function ArticleView({ article: a, related, newerAvailable }: { article: KnowledgeArticle; related: RelatedLink[]; newerAvailable: boolean }) {
  const router = useRouter();
  const isOwner = useIsOwner();
  const [busy, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    start(async () => {
      const res = await action();
      if (!res.ok) return void toast.error(res.error);
      if (success) toast.success(success);
      router.refresh();
    });
  }

  function remove() {
    start(async () => {
      const res = await deleteArticle(a.id);
      if (!res.ok) return void toast.error(res.error);
      setConfirmDelete(false);
      toast.success(`“${a.title}” moved to the bin`, {
        description: "You can restore it from Settings within 30 days.",
        action: {
          label: "Undo",
          onClick: async () => {
            const back = await restoreArticle(a.id);
            if (back.ok) router.push(`/knowledge/${a.id}`);
            else toast.error(back.error);
          },
        },
      });
      router.push("/knowledge");
    });
  }

  return (
    <>
      <Link href="/knowledge" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Knowledge hub
      </Link>
      <header className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{a.category}</span>
          <ReviewedBadge reviewed={a.reviewed} />
          <span>· updated {formatDate(a.updatedAt)}</span>
          {a.starterSlug && <span>· starter article{a.edited ? ", edited" : ""}</span>}
        </div>
        <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">{a.title}</h1>
        <div className="flex flex-wrap gap-2">
          {isOwner && (
            <Button size="sm" variant={a.reviewed ? "outline" : "default"} disabled={busy} onClick={() => run(() => setArticleReviewed(a.id, !a.reviewed))}>
              <BadgeCheck /> {a.reviewed ? "Reviewed" : "Mark as reviewed"}
            </Button>
          )}
          <ButtonLink size="sm" variant="outline" href={`/knowledge/${a.id}/edit`}>
            <Pencil /> Edit
          </ButtonLink>
          {isOwner && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Delete
            </Button>
          )}
        </div>
        {a.updatedByName && <p className="text-xs text-muted-foreground">Last edited by {a.updatedByName}</p>}
        {newerAvailable && (
          <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-info/25 bg-info/[0.06] p-3 text-sm">
            <span className="flex-1">Newer version available: the starter text for this article has been corrected or improved since you added it.</span>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => updateFromStarter(a.id), "Article updated to the newer version")}>
              {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Update
            </Button>
          </div>
        )}
      </header>

      <div className="flex min-w-0 max-w-[75ch] flex-col gap-7">
        <section aria-labelledby="tell" className="rounded-xl border-2 border-primary/30 bg-primary/[0.04] p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 id="tell" className="font-medium">
              Tell the customer
            </h2>
            <Button
              size="sm"
              variant="outline"
              aria-label="Copy for the customer"
              onClick={() => {
                navigator.clipboard?.writeText(a.tellCustomer);
                toast.success("Copied", { description: "Paste it into your reply or read it out." });
              }}
            >
              <Copy /> Copy
            </Button>
          </div>
          <p className="text-[15px] leading-relaxed break-words">{a.tellCustomer}</p>
        </section>

        {a.whatItIs && (
          <Section title="What it is">
            <p className="text-sm leading-relaxed break-words whitespace-pre-line">{a.whatItIs}</p>
          </Section>
        )}
        {a.example && (
          <Section title="Example">
            <p className="rounded-lg bg-muted/60 p-3 text-sm leading-relaxed break-words whitespace-pre-line">{a.example}</p>
          </Section>
        )}

        <Section title="In AutoCount">
          <div className="grid gap-3 sm:grid-cols-2">
            <Steps label="Desktop" steps={a.desktopSteps} verified={a.stepsVerified} />
            <Steps label="Cloud" steps={a.cloudSteps} verified={a.stepsVerified} />
          </div>
          {isOwner && (a.desktopSteps || a.cloudSteps) && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => setStepsVerified(a.id, !a.stepsVerified))}>
              <MapPin /> {a.stepsVerified ? "Menu paths confirmed — undo" : "I’ve checked these menu paths"}
            </Button>
          )}
        </Section>

        {a.mistakes.length > 0 && (
          <Section title="Common mistakes">
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed break-words">
              {a.mistakes.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </Section>
        )}

        {related.length > 0 && (
          <Section title="Related topics">
            <ul className="flex flex-wrap gap-2">
              {related.map((r) => (
                <li key={r.title}>
                  {r.id ? (
                    <Link href={`/knowledge/${r.id}`} className="inline-flex h-7 items-center rounded-md border bg-card px-2.5 text-sm hover:border-primary/50">
                      {r.title}
                    </Link>
                  ) : (
                    <span className="inline-flex h-7 items-center rounded-md border border-dashed px-2.5 text-sm text-muted-foreground" title="Not added yet: use Add starter articles">
                      {r.title}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {a.sources.length > 0 && (
          <Section title="Sources">
            <ul className="space-y-1.5 text-sm">
              {a.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 break-words text-primary hover:underline">
                    {s.label} <ExternalLink className="mt-1 size-3 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move “{a.title}” to the bin?</DialogTitle>
            <DialogDescription>You can restore it from Settings within 30 days. A deleted starter article isn’t offered again by Add starter articles while it’s in the bin.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={remove} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Move to bin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
