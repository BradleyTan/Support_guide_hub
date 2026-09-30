"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText, Image as ImageIcon, ImagePlus, Loader2, ScrollText, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addAttachment, attachmentUrl, removeAttachment } from "@/app/(app)/guides/actions";
import { ACCEPTED_TYPES, MAX_FILES, validateFile } from "@/lib/files";
import { uploadAttachment } from "@/lib/upload";
import type { Attachment } from "@/lib/types";

/** Attachments on a saved guide: open (private 10-minute link), remove, and upload more. */
export function AttachmentList({ code, guideDbId, userId, attachments, compact = false }: { code: string; guideDbId: string; userId: string; attachments: Attachment[]; compact?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, start] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);

  async function open(id: string) {
    // Open the tab synchronously so pop-up blockers allow it, then point it at the signed link.
    const tab = window.open("about:blank", "_blank");
    const res = await attachmentUrl(id);
    if (res.ok && tab) tab.location.href = res.data.url;
    else {
      tab?.close();
      toast.error(res.ok ? "Allow pop-ups to open attachments." : res.error);
    }
  }

  function upload(list: FileList | null) {
    const picked = Array.from(list ?? []);
    const errs = picked.map(validateFile).filter((x): x is string => !!x);
    const ok = picked.filter((f) => !validateFile(f)).slice(0, Math.max(0, MAX_FILES * 2 - attachments.length));
    setErrors(errs);
    if (!ok.length) return;
    start(async () => {
      let done = 0;
      for (const file of ok) {
        try {
          const res = await addAttachment(code, await uploadAttachment(userId, guideDbId, file));
          if (res.ok) done++;
          else setErrors((e) => [...e, `${file.name}: ${res.error}`]);
        } catch {
          setErrors((e) => [...e, `${file.name}: upload failed. Check your connection and try again.`]);
        }
      }
      if (done) toast.success(`Attached ${done} file${done > 1 ? "s" : ""}`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {attachments.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm">
              {a.kind === "image" ? <ImageIcon className="size-4 shrink-0 text-muted-foreground" /> : a.kind === "pdf" ? <FileText className="size-4 shrink-0 text-muted-foreground" /> : <ScrollText className="size-4 shrink-0 text-muted-foreground" />}
              <button type="button" onClick={() => open(a.id)} className="min-w-0 flex-1 truncate text-left hover:underline" title={`Open ${a.name}`}>
                {a.name}
              </button>
              <span className="shrink-0 text-xs text-muted-foreground">{a.sizeKb} KB</span>
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`Open ${a.name}`} onClick={() => open(a.id)}>
                <ExternalLink />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${a.name}`}
                disabled={removing === a.id}
                onClick={async () => {
                  if (!window.confirm(`Remove ${a.name} from this guide? The file is deleted.`)) return;
                  setRemoving(a.id);
                  const res = await removeAttachment(a.id);
                  setRemoving(null);
                  if (res.ok) {
                    toast.success(`Removed ${a.name}`);
                    router.refresh();
                  } else toast.error(res.error);
                }}
              >
                {removing === a.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        !compact && <p className="text-sm text-muted-foreground">No attachments yet.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />} {busy ? "Uploading…" : "Add screenshot or PDF"}
        </Button>
        {!compact && <span className="text-xs text-muted-foreground">Stored privately. Links expire after 10 minutes.</span>}
      </div>
      <input ref={input} type="file" hidden multiple accept={ACCEPTED_TYPES.join(",")} onChange={(e) => (upload(e.target.files), (e.target.value = ""))} />
      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 text-sm text-destructive">
          {errors.map((m) => (
            <li key={m} className="flex items-start gap-1.5">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
