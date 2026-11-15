"use client";

import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";
import { ImageUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { imageFromClipboard, ocrTextToQuery, SCREENSHOT_TYPES, validateScreenshot } from "@/lib/ocr-text";

type ReaderOptions = {
  /** Shapes the raw OCR output for where it's going. Defaults to one search query. */
  format?: (raw: string) => string;
  /** Only images pasted inside this element are read. Without it, pasting anywhere on the page works. */
  scope?: RefObject<HTMLElement | null>;
  /** While true, pasted images are ignored (pasting works normally) and nothing is read. */
  disabled?: boolean;
};

/**
 * Reads the text in a pasted or chosen image and hands it over (as a search by default). Pasted text is left alone.
 */
export function useScreenshotReader(onText: (text: string) => void, { format = ocrTextToQuery, scope, disabled = false }: ReaderOptions = {}) {
  const [reading, setReading] = useState(false);

  async function read(file: File) {
    if (reading || disabled) return;
    const problem = validateScreenshot(file);
    if (problem) return void toast.error(problem);
    setReading(true);
    try {
      const { readScreenshotText } = await import("@/lib/ocr");
      const text = format(await readScreenshotText(file));
      if (text) onText(text);
      else toast.error("Couldn’t find any text in that screenshot. Try a clearer or larger one.");
    } catch {
      toast.error("Couldn’t read the screenshot. Please try again.");
    } finally {
      setReading(false);
    }
  }

  const onPaste = useEffectEvent((e: ClipboardEvent) => {
    if (disabled) return;
    const image = imageFromClipboard(e.clipboardData?.items);
    if (!image) return;
    e.preventDefault();
    void read(image);
  });

  useEffect(() => {
    const target: HTMLElement | Document | null = scope ? scope.current : document;
    if (!target) return;
    const listener = (e: Event) => onPaste(e as ClipboardEvent);
    target.addEventListener("paste", listener);
    return () => target.removeEventListener("paste", listener);
  }, [scope]);

  return { reading, read };
}

export function ScreenshotButton({
  reading,
  disabled = false,
  onFile,
  className,
  label = "Search by screenshot",
}: {
  reading: boolean;
  disabled?: boolean;
  onFile: (file: File) => void;
  className?: string;
  label?: string;
}) {
  const picker = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={picker}
        type="file"
        accept={SCREENSHOT_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-label={`${label}: choose an image`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared so choosing the same file again still triggers a read.
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      <Button type="button" variant="outline" className={cn(className)} disabled={reading || disabled} aria-label={label} title="Read the text in a screenshot. It stays in your browser." onClick={() => picker.current?.click()}>
        {reading ? <Loader2 className="animate-spin" /> : <ImageUp />}
        <span className="hidden sm:inline" aria-live="polite">
          {reading ? "Reading…" : "Screenshot"}
        </span>
      </Button>
    </>
  );
}
