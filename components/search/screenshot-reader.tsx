"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ImageUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { imageFromClipboard, ocrTextToQuery, SCREENSHOT_TYPES, validateScreenshot } from "@/lib/ocr-text";

/**
 * Search by screenshot: reads the text in a pasted or chosen image and hands it over as a search. Pasting an image
 * anywhere on the page works while this is mounted; pasted text is left alone.
 */
export function useScreenshotReader(onQuery: (query: string) => void) {
  const [reading, setReading] = useState(false);

  async function read(file: File) {
    if (reading) return;
    const problem = validateScreenshot(file);
    if (problem) return void toast.error(problem);
    setReading(true);
    try {
      const { readScreenshotText } = await import("@/lib/ocr");
      const query = ocrTextToQuery(await readScreenshotText(file));
      if (query) onQuery(query);
      else toast.error("Couldn’t find any text in that screenshot. Try a clearer or larger one.");
    } catch {
      toast.error("Couldn’t read the screenshot. Please try again.");
    } finally {
      setReading(false);
    }
  }

  const onPaste = useEffectEvent((e: ClipboardEvent) => {
    const image = imageFromClipboard(e.clipboardData?.items);
    if (!image) return;
    e.preventDefault();
    void read(image);
  });

  useEffect(() => {
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  return { reading, read };
}

export function ScreenshotButton({ reading, onFile, className }: { reading: boolean; onFile: (file: File) => void; className?: string }) {
  const picker = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={picker}
        type="file"
        accept={SCREENSHOT_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-label="Screenshot to search with"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared so choosing the same file again still triggers a read.
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      <Button type="button" variant="outline" className={cn(className)} disabled={reading} aria-label="Search by screenshot" title="Read the text in a screenshot. It stays in your browser." onClick={() => picker.current?.click()}>
        {reading ? <Loader2 className="animate-spin" /> : <ImageUp />}
        <span className="hidden sm:inline" aria-live="polite">
          {reading ? "Reading…" : "Screenshot"}
        </span>
      </Button>
    </>
  );
}
