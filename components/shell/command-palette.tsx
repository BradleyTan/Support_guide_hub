"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Calculator, FilePlus2, Moon, Sun, Upload } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { allNavItems, teamItem } from "@/components/shell/nav";
import { useIsOwner } from "@/components/shell/team-context";

export interface PaletteGuide {
  id: string;
  title: string;
  errorMessage?: string;
}

function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}

export type PaletteArticle = { id: string; title: string; category: string };

export function CommandPalette({ open, onOpenChange, guides, articles = [] }: { open: boolean; onOpenChange: (open: boolean) => void; guides: PaletteGuide[]; articles?: PaletteArticle[] }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const owner = useIsOwner();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === "/" && !isTyping(e.target) && !open) {
        e.preventDefault();
        router.push("/search");
      } else if (e.key.toLowerCase() === "n" && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target) && !open) {
        e.preventDefault();
        router.push("/guides/new");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange, router]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command palette" description="Jump to a screen, guide or action">
      {/* CommandDialog is only the dialog; cmdk's input and list need the Command root around them. */}
      <Command>
      <CommandInput placeholder="Type a screen, guide number or action…" />
      <CommandList>
        <CommandEmpty>No match. Try a guide number like G-1051.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/guides/new")}>
            <FilePlus2 /> New guide
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("/analyst")}>
            <Calculator /> Analyse a scenario
          </CommandItem>
          <CommandItem onSelect={() => go("/guides/import")}>
            <Upload /> Import guides (Excel, CSV, PDF, text)
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setTheme(resolvedTheme === "dark" ? "light" : "dark");
              onOpenChange(false);
            }}
          >
            {resolvedTheme === "dark" ? <Sun /> : <Moon />} Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {(owner ? [...allNavItems, teamItem] : allNavItems).map((item) => (
            <CommandItem key={item.href} onSelect={() => go(item.href)}>
              <item.icon /> {item.label}
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Guides">
          {guides.map((c) => (
            <CommandItem key={c.id} value={`${c.id} ${c.title} ${c.errorMessage ?? ""}`} onSelect={() => go(`/guides/${c.id}`)}>
              <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
              <span className="truncate">{c.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        {articles.length > 0 && (
          <CommandGroup heading="Knowledge hub">
            {articles.map((a) => (
              <CommandItem key={a.id} value={`knowledge ${a.title} ${a.category}`} onSelect={() => go(`/knowledge/${a.id}`)}>
                <span className="truncate">{a.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">{a.category}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
      </Command>
    </CommandDialog>
  );
}
