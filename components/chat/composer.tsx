"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EyeOff, Loader2, ScanEye, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { autoMask, hideSelection, type MaskMap } from "@/lib/accountant/core/mask";
import { appendText, ocrTextToLines } from "@/lib/ocr-text";
import { ScreenshotButton, useScreenshotReader } from "@/components/search/screenshot-reader";

const SCENARIO_MAX = 4000;

/** Masks the typed scenario, shows exactly what will be sent, and lets the user hide anything else first. */
export function maskScenario(text: string, hidden: string[], map: MaskMap): { text: string; map: MaskMap } {
  let r = autoMask(text, map);
  for (const h of hidden) r = hideSelection(r.text, h, r.map);
  return r;
}

export function Composer({
  text,
  onText,
  mask,
  busy,
  error,
  onSend,
}: {
  text: string;
  onText: (t: string) => void;
  mask: MaskMap;
  busy: boolean;
  error: string | null;
  onSend: (masked: string, map: MaskMap) => void;
}) {
  const [previewing, setPreviewing] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const previewRef = useRef<HTMLPreElement>(null);
  const masked = useMemo(() => maskScenario(text, hidden, mask), [text, hidden, mask]);
  const tooLong = text.length > SCENARIO_MAX;
  // A pasted or chosen screenshot's text goes into the box, never straight to Groq: the preview step still applies.
  // Reading takes a few seconds; the latest typed text is used, so nothing typed meanwhile is lost.
  const latestText = useRef(text);
  useEffect(() => {
    latestText.current = text;
  }, [text]);
  const screenshot = useScreenshotReader(
    (read) => {
      onText(appendText(latestText.current, read, SCENARIO_MAX));
      setPreviewing(false);
      toast.success("Text from the screenshot added. Check it, then preview what’s sent.");
    },
    // Paused while an answer is on its way: the box is cleared when it arrives, so added text would be lost.
    { format: (raw) => ocrTextToLines(raw, SCENARIO_MAX), disabled: busy },
  );

  function hidePicked() {
    const sel = window.getSelection();
    const picked = sel?.toString().trim() ?? "";
    if (!picked || !previewRef.current?.contains(sel?.anchorNode ?? null)) return;
    // Hide names and short details, not whole paragraphs (each hidden item must stay under 200 characters).
    if (picked.length > 200) return void toast.error("Select a shorter piece of text to hide, such as a name.");
    setHidden((h) => (h.includes(picked) ? h : [...h, picked]));
    sel?.removeAllRanges();
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="space-y-1.5">
        <Label htmlFor="scenario">Customer’s scenario</Label>
        <Textarea
          id="scenario"
          value={text}
          onChange={(e) => {
            onText(e.target.value);
            setPreviewing(false);
          }}
          rows={4}
          placeholder="e.g. Customer paid a RM5,000 deposit 2 years ago that was never keyed in as an AR deposit. Now they want to knock it off against last month’s invoice."
          className="bg-background"
          aria-invalid={tooLong}
        />
        <p className={tooLong ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {tooLong
            ? `Keep it under 4,000 characters (${text.length.toLocaleString()} now).`
            : "IC, bank, phone, email and company names are hidden automatically before anything is sent. Got a screenshot? Paste it (Ctrl+V) and its text is added here."}
        </p>
      </div>

      {!previewing ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setPreviewing(true)} disabled={!text.trim() || tooLong || busy}>
            <ScanEye /> Preview what’s sent
          </Button>
          <ScreenshotButton reading={screenshot.reading} disabled={busy} onFile={screenshot.read} label="Add text from a screenshot" />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium" id="preview-label">
            What Groq will receive
          </p>
          <pre ref={previewRef} aria-labelledby="preview-label" className="max-h-60 overflow-auto rounded-lg border bg-muted/50 p-3 text-sm break-words whitespace-pre-wrap">
            {masked.text}
          </pre>
          <p className="text-xs text-muted-foreground">Select a person’s name or anything else in the box above, then press Hide selected text. Matching guides are masked by the same rules.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onMouseDown={(e) => e.preventDefault()} onClick={hidePicked} disabled={busy}>
              <EyeOff /> Hide selected text
            </Button>
            <Button onClick={() => onSend(masked.text, masked.map)} disabled={busy || !text.trim() || tooLong}>
              {busy ? <Loader2 className="animate-spin" /> : <Send />} {busy ? "Thinking…" : "Send"}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
