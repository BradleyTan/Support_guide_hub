"use client";

import { ArrowLeft, Printer } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { Sop, SopImage } from "@/lib/sop";

/** The printable SOP. App menus are hidden when printing, so the browser's "Save as PDF" gives a clean document. */
export function SopDocument({ sop, images }: { sop: Sop; images: SopImage[] }) {
  const url = new Map(images.map((im) => [im.id, im.url]));
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-2 print:hidden">
        <ButtonLink size="sm" variant="ghost" href={`/sop/${sop.id}`}>
          <ArrowLeft /> Back to editing
        </ButtonLink>
        <Button size="sm" className="ml-auto" onClick={() => window.print()}>
          <Printer /> Print / Save as PDF
        </Button>
        <p className="w-full text-xs text-muted-foreground">In the print window, choose “Save as PDF” as the printer. Screenshot links last 10 minutes; reload this page if images are missing.</p>
      </div>

      <article className="mx-auto max-w-[48rem] rounded-lg border bg-white p-8 text-[15px] leading-relaxed text-neutral-900 print:max-w-none print:rounded-none print:border-0 print:p-0">
        <header className="border-b border-neutral-300 pb-4">
          <p className="text-xs tracking-wide text-neutral-500 uppercase">Standard operating procedure · {sop.id}</p>
          <h1 className="mt-1 text-2xl font-semibold">{sop.title}</h1>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {sop.scope && (
              <>
                <dt className="text-neutral-500">Applies to</dt>
                <dd>{sop.scope}</dd>
              </>
            )}
            {sop.version && (
              <>
                <dt className="text-neutral-500">Version</dt>
                <dd>{sop.version}</dd>
              </>
            )}
            <dt className="text-neutral-500">Updated</dt>
            <dd>{formatDate(sop.updatedAt)}</dd>
          </dl>
        </header>

        {sop.purpose && (
          <section className="mt-5">
            <h2 className="text-base font-semibold">Purpose</h2>
            <p className="mt-1 whitespace-pre-line">{sop.purpose}</p>
          </section>
        )}

        <section className="mt-5">
          <h2 className="text-base font-semibold">Steps</h2>
          <ol className="mt-2 flex flex-col gap-4">
            {sop.steps.map((s, i) => (
              <li key={i} className="flex gap-3 break-inside-avoid">
                <span className="num flex size-6 shrink-0 items-center justify-center rounded-full border border-neutral-400 text-xs font-semibold">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-line">{s.text}</p>
                  {s.attachmentId && url.get(s.attachmentId) && (
                    // eslint-disable-next-line @next/next/no-img-element -- private, short-lived storage link
                    <img src={url.get(s.attachmentId)!} alt={`Screenshot for step ${i + 1}`} className="mt-2 max-h-[22rem] max-w-full rounded border border-neutral-300 object-contain" />
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {sop.checks.length > 0 && (
          <section className="mt-6 break-inside-avoid">
            <h2 className="text-base font-semibold">Checks</h2>
            <ul className="mt-2 flex flex-col gap-1.5">
              {sop.checks.map((c, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="mt-1 inline-block size-3.5 shrink-0 rounded-sm border border-neutral-500" />
                  {c}
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </>
  );
}
