"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, EyeOff, FileText, ImagePlus, Loader2, ScanText, Sparkles, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { ACCEPTED_TYPES, COMPRESS_OVER_MB, MAX_FILE_MB, MAX_FILES, validateFile } from "@/lib/files";

export interface InputFile {
  id: string;
  name: string;
  type: string;
  sizeMb: number;
  url?: string;
  masked: boolean;
  sample?: boolean;
}

export interface ExtractedField {
  label: string;
  value: string;
  uncertain?: boolean;
}

type ReadState = "idle" | "reading" | "done" | "unclear";

export function SmartInput({
  label,
  placeholder,
  defaultText = "",
  rows = 5,
  extraction,
  onUseExtraction,
  submitLabel,
  onSubmit,
  compact = false,
  className,
}: {
  label: string;
  placeholder: string;
  defaultText?: string;
  rows?: number;
  /** Mock result shown after "Read image". */
  extraction?: ExtractedField[];
  onUseExtraction?: (fields: ExtractedField[]) => void;
  submitLabel?: string;
  onSubmit?: (text: string, files: InputFile[]) => void;
  compact?: boolean;
  className?: string;
}) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(defaultText);
  const [files, setFiles] = useState<InputFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [read, setRead] = useState<ReadState>("idle");
  const [fields, setFields] = useState<ExtractedField[]>(extraction ?? []);

  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  useEffect(() => () => filesRef.current.forEach((f) => f.url && URL.revokeObjectURL(f.url)), []);

  function removeFile(fileId: string) {
    const f = files.find((x) => x.id === fileId);
    if (f?.url) URL.revokeObjectURL(f.url);
    setFiles((p) => p.filter((x) => x.id !== fileId));
  }

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    const errs: string[] = [];
    const ok: InputFile[] = [];
    for (const f of incoming) {
      const err = validateFile(f);
      if (err) errs.push(err);
      else if (files.length + ok.length >= MAX_FILES) errs.push(`Only ${MAX_FILES} files per message. ${f.name} was not added.`);
      else
        ok.push({
          id: crypto.randomUUID(),
          name: f.name || "pasted-image.png",
          type: f.type,
          sizeMb: f.size / 1048576,
          url: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
          masked: false,
        });
    }
    setErrors(errs);
    if (ok.length) {
      setFiles((prev) => [...prev, ...ok]);
      setRead("idle");
    }
  }

  function addSample() {
    setFiles((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "sample-error-dialog.png", type: "image/png", sizeMb: 0.3, masked: false, sample: true },
    ]);
    setErrors([]);
    setRead("idle");
  }

  function readImages(unclear = false) {
    setRead("reading");
    setTimeout(() => {
      setRead(unclear ? "unclear" : "done");
      setFields(extraction ?? []);
    }, 1100);
  }

  const hasImages = files.length > 0;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-lg border bg-card transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
          dragging && "border-primary bg-accent/40",
        )}
      >
        <Label htmlFor={id} className={compact ? "sr-only" : "px-3 pt-3 text-sm font-medium"}>
          {label}
        </Label>
        <Textarea
          id={id}
          rows={rows}
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            if (e.clipboardData.files.length) {
              e.preventDefault();
              addFiles(e.clipboardData.files);
            }
          }}
          className="min-h-0 resize-y border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
        />

        {hasImages && (
          <ul className="flex flex-wrap gap-2 px-3 pb-2" aria-label="Attached files">
            {files.map((f) => (
              <li key={f.id} className="group relative flex w-28 flex-col overflow-hidden rounded-md border bg-muted/50">
                <div className="relative flex h-20 items-center justify-center overflow-hidden bg-muted">
                  {f.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                    <img src={f.url} alt={f.name} className="size-full object-cover" />
                  ) : f.type === "application/pdf" ? (
                    <FileText className="size-7 text-muted-foreground" />
                  ) : (
                    <SampleShot />
                  )}
                  {f.masked && (
                    <>
                      <span className="absolute top-3 left-2 h-2.5 w-14 rounded-sm bg-foreground" />
                      <span className="absolute bottom-4 left-5 h-2.5 w-16 rounded-sm bg-foreground" />
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1 p-1.5">
                  <span className="min-w-0 flex-1 truncate text-[11px]" title={f.name}>
                    {f.name}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => removeFile(f.id)}
                    className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setFiles((p) => p.map((x) => (x.id === f.id ? { ...x, masked: !x.masked } : x)))}
                  className={cn(
                    "flex items-center justify-center gap-1 border-t py-1 text-[11px] transition-colors",
                    f.masked ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-background hover:text-foreground",
                  )}
                >
                  <EyeOff className="size-3" /> {f.masked ? "2 areas masked" : "Mask sensitive"}
                </button>
                {f.sizeMb > COMPRESS_OVER_MB && (
                  <span className="border-t px-1.5 py-1 text-[10px] text-muted-foreground">Will compress from {f.sizeMb.toFixed(1)} MB</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-1 border-t px-2 py-1.5">
          <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
            <ImagePlus /> Add image or PDF
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => cameraRef.current?.click()} className="sm:hidden">
            <Camera /> Camera
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={addSample} className="text-muted-foreground">
            Use sample screenshot
          </Button>
          <span className="ml-auto hidden pr-1 text-xs text-muted-foreground md:inline">Paste, drop or upload · PNG, JPG, WEBP, PDF · max {MAX_FILE_MB} MB</span>
          {submitLabel && onSubmit && (
            <Button type="button" size="sm" className="md:ml-2" disabled={!text.trim() && !hasImages} onClick={() => onSubmit(text, files)}>
              <Sparkles /> {submitLabel}
            </Button>
          )}
        </div>
        <input ref={fileRef} type="file" hidden multiple accept={ACCEPTED_TYPES.join(",")} onChange={(e) => e.target.files && addFiles(e.target.files)} />
        <input ref={cameraRef} type="file" hidden accept="image/*" capture="environment" onChange={(e) => e.target.files && addFiles(e.target.files)} />
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 text-sm text-destructive">
          {errors.map((e) => (
            <li key={e} className="flex items-start gap-1.5">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {e}
            </li>
          ))}
        </ul>
      )}

      {hasImages && extraction && (
        <div className="rounded-lg border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
            <ScanText className="size-4 text-primary" />
            <p className="text-sm font-medium">What I read from the image</p>
            <span className="text-xs text-muted-foreground">Masked areas are never sent to the AI.</span>
            <div className="ml-auto flex gap-1">
              {read !== "reading" && (
                <>
                  <Button type="button" variant="ghost" size="xs" onClick={() => readImages(true)} className="text-muted-foreground">
                    Try a blurry image
                  </Button>
                  <Button type="button" variant="outline" size="xs" onClick={() => readImages()}>
                    {read === "idle" ? "Read image" : "Read again"}
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="p-3">
            {read === "idle" && <p className="text-sm text-muted-foreground">Select “Read image” to pull the error text, module and figures out of the screenshot. You can edit anything before it’s used.</p>}
            {read === "reading" && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Reading {files.length} file{files.length > 1 ? "s" : ""}…
              </p>
            )}
            {read === "unclear" && (
              <div className="flex gap-2 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                <p>
                  <span className="font-medium">I can’t read the error text reliably.</span>{" "}
                  <span className="text-muted-foreground">The dialog is blurred and the bottom line is cut off. Please send a sharper screenshot, or crop to just the error dialog. I won’t guess the missing words.</span>
                </p>
              </div>
            )}
            {read === "done" && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {fields.map((f, i) => (
                    <div key={f.label} className={cn("flex flex-col gap-1", f.value.length > 60 && "sm:col-span-2")}>
                      <Label htmlFor={`${id}-f${i}`} className="text-xs text-muted-foreground">
                        {f.label}
                        {f.uncertain && <span className="ml-1 text-[color-mix(in_oklch,var(--warning),var(--foreground)_35%)]">· unsure, please check</span>}
                      </Label>
                      <Input
                        id={`${id}-f${i}`}
                        value={f.value}
                        onChange={(e) => setFields((p) => p.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                        className={cn(f.uncertain && "border-warning/60")}
                      />
                    </div>
                  ))}
                </div>
                {onUseExtraction && (
                  <Button type="button" size="sm" onClick={() => onUseExtraction(fields)}>
                    Use these values
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Stand-in thumbnail for the bundled sample screenshot: a small error dialog. */
function SampleShot() {
  return (
    <svg viewBox="0 0 112 80" className="size-full" aria-hidden>
      <rect width="112" height="80" className="fill-muted" />
      <rect x="14" y="14" width="84" height="52" rx="3" className="fill-card stroke-border" />
      <rect x="14" y="14" width="84" height="10" rx="3" className="fill-info/70" />
      <circle cx="26" cy="38" r="6" className="fill-destructive/80" />
      <rect x="38" y="33" width="50" height="3" rx="1.5" className="fill-muted-foreground/60" />
      <rect x="38" y="40" width="40" height="3" rx="1.5" className="fill-muted-foreground/40" />
      <rect x="70" y="53" width="20" height="7" rx="2" className="fill-muted-foreground/30" />
    </svg>
  );
}
