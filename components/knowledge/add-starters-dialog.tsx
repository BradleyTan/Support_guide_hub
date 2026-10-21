"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addStarterArticles } from "@/app/(app)/knowledge/actions";
import { KNOWLEDGE_CATEGORIES, type KnowledgeCategory } from "@/lib/knowledge/model";

export type StarterChoice = { slug: string; title: string; category: KnowledgeCategory };

/** Lets the user tick which starter articles to add. Nothing is added without ticking. */
export function AddStartersDialog({ missing, variant = "outline" }: { missing: StarterChoice[]; variant?: "default" | "outline" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [adding, start] = useTransition();
  if (!missing.length) return null;

  const toggle = (slug: string, on: boolean) => setChosen((c) => (on ? [...c, slug] : c.filter((s) => s !== slug)));

  function add() {
    start(async () => {
      const res = await addStarterArticles(chosen);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data.added === 1 ? "Added 1 article" : `Added ${res.data.added} articles`, { description: "They’re marked “Not reviewed yet” until you check them." });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant={variant}
        onClick={() => {
          setChosen(missing.map((m) => m.slug));
          setOpen(true);
        }}
      >
        <Plus /> Add starter articles ({missing.length})
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add starter articles</DialogTitle>
            <DialogDescription>Ready-made plain-English articles. Tick the ones you want; you can edit them afterwards. Articles you already have, including ones in the bin, aren’t listed.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setChosen(missing.map((m) => m.slug))}>
              Select all
            </Button>
            <Button size="sm" variant="outline" onClick={() => setChosen([])}>
              Select none
            </Button>
          </div>
          <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
            {KNOWLEDGE_CATEGORIES.filter((cat) => missing.some((m) => m.category === cat)).map((cat) => (
              <fieldset key={cat}>
                <legend className="mb-1 text-xs font-medium text-muted-foreground">{cat}</legend>
                <ul>
                  {missing
                    .filter((m) => m.category === cat)
                    .map((m) => (
                      <li key={m.slug}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                          <input type="checkbox" className="accent-(--primary)" checked={chosen.includes(m.slug)} onChange={(e) => toggle(m.slug, e.target.checked)} />
                          {m.title}
                        </label>
                      </li>
                    ))}
                </ul>
              </fieldset>
            ))}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={add} disabled={adding || chosen.length === 0}>
              {adding && <Loader2 className="animate-spin" />} Add {chosen.length} {chosen.length === 1 ? "article" : "articles"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
