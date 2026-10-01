"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Plus, Save, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveManualJournal } from "@/app/(app)/analyst/actions";
import { toSen } from "@/lib/scenarios/money";
import { formatAmount } from "@/lib/format";

interface Line {
  account: string;
  dr: string;
  cr: string;
}

const blankLine = (): Line => ({ account: "", dr: "", cr: "" });
const amount = (s: string) => {
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

/** Build your own journal entry, with a live Dr = Cr check; saved to history once it balances. */
export function ManualJournal({ onSaved }: { onSaved: (code: string) => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine(), blankLine()]);
  const [saving, start] = useTransition();

  const parsed = lines.map((l) => ({ account: l.account.trim(), dr: l.dr ? amount(l.dr) : 0, cr: l.cr ? amount(l.cr) : 0 }));
  const invalid = parsed.some((l) => Number.isNaN(l.dr) || Number.isNaN(l.cr) || (l.dr > 0 && l.cr > 0));
  const drSen = parsed.reduce((s, l) => s + (Number.isNaN(l.dr) ? 0 : toSen(l.dr)), 0);
  const crSen = parsed.reduce((s, l) => s + (Number.isNaN(l.cr) ? 0 : toSen(l.cr)), 0);
  const used = parsed.filter((l) => l.dr || l.cr);
  const balanced = !invalid && drSen === crSen && drSen > 0;
  const ready = balanced && title.trim() && used.length >= 2 && used.every((l) => l.account);

  const set = (i: number, k: keyof Line, v: string) => setLines((p) => p.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <div className="flex flex-col gap-1">
          <Label htmlFor="mj-title" className="text-xs">
            Title
          </Label>
          <Input id="mj-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Reclassify rental deposit" className="bg-card" maxLength={200} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="mj-date" className="text-xs">
            Date
          </Label>
          <Input id="mj-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-card" />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="mj-desc" className="text-xs">
          Description
        </Label>
        <Input id="mj-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="bg-card" maxLength={300} />
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Account</th>
              <th className="w-32 px-3 py-2 text-right font-medium">Dr (RM)</th>
              <th className="w-32 px-3 py-2 text-right font-medium">Cr (RM)</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const p = parsed[i];
              const bad = Number.isNaN(p.dr) || Number.isNaN(p.cr) || (p.dr > 0 && p.cr > 0);
              return (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="px-2 py-1.5">
                    <Input aria-label={`Line ${i + 1} account`} value={l.account} onChange={(e) => set(i, "account", e.target.value)} className="h-8" maxLength={120} />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input aria-label={`Line ${i + 1} debit`} inputMode="decimal" value={l.dr} onChange={(e) => set(i, "dr", e.target.value)} aria-invalid={bad} className="num h-8 text-right" />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input aria-label={`Line ${i + 1} credit`} inputMode="decimal" value={l.cr} onChange={(e) => set(i, "cr", e.target.value)} aria-invalid={bad} className="num h-8 text-right" />
                  </td>
                  <td className="px-1">
                    <Button variant="ghost" size="icon-xs" aria-label={`Remove line ${i + 1}`} disabled={lines.length <= 2} onClick={() => setLines((p) => p.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/40 font-medium">
              <td className="px-3 py-2">
                <span className={cn("inline-flex items-center gap-1 text-xs", balanced ? "text-success" : "text-destructive")} role="status">
                  {balanced ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                  {invalid ? "A line has an invalid amount, or both Dr and Cr" : balanced ? "Dr = Cr" : `Out of balance by RM ${formatAmount(Math.abs(drSen - crSen) / 100)}`}
                </span>
              </td>
              <td className="num px-3 py-2 text-right">{formatAmount(drSen / 100)}</td>
              <td className="num px-3 py-2 text-right">{formatAmount(crSen / 100)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <Button variant="outline" size="sm" className="w-fit" onClick={() => setLines((p) => [...p, blankLine()])} disabled={lines.length >= 50}>
        <Plus /> Add line
      </Button>

      <div className="flex flex-col gap-1">
        <Label htmlFor="mj-notes" className="text-xs">
          Notes (why this entry, references)
        </Label>
        <Textarea id="mj-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-card" />
      </div>

      <Button
        className="w-fit"
        disabled={!ready || saving}
        onClick={() =>
          start(async () => {
            const res = await saveManualJournal({ title, date, description, notes, lines: used.map((l) => ({ account: l.account, dr: l.dr, cr: l.cr })) });
            if (res.ok) {
              toast.success(`Saved as ${res.data.code}`);
              onSaved(res.data.code);
            } else toast.error(res.error);
          })
        }
      >
        {saving ? <Loader2 className="animate-spin" /> : <Save />} Save to history
      </Button>
    </div>
  );
}
