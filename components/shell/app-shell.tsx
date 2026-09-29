"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Menu, Moon, MoreHorizontal, Search, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CommandPalette } from "@/components/shell/command-palette";
import { DemoStateProvider, useDemoState, type DemoState } from "@/components/shell/demo-state";
import { isActive, navGroups, settingsItem, type NavItem } from "@/components/shell/nav";

function Mark() {
  // Two ruled ledger columns: the Dr / Cr page every consultant reads all day.
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-6 shrink-0">
      <rect x="2" y="3" width="20" height="18" rx="3" className="fill-primary" />
      <path d="M12 6v12M5 9h4M5 12h4M5 15h3M15 9h4M15 12h3M15 15h4" className="stroke-primary-foreground" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors duration-150",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <item.icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
      {item.label}
    </Link>
  );
}

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {navGroups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className="px-2.5 pb-1 text-xs font-medium text-muted-foreground">{group.label}</p>
          {group.items.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
      <div className="mt-auto flex flex-col gap-0.5">
        <NavLink item={settingsItem} pathname={pathname} onNavigate={onNavigate} />
      </div>
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex h-14 items-center gap-2.5 px-5">
      <Mark />
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">Support Desk</span>
        <span className="text-xs text-muted-foreground">for AutoCount</span>
      </span>
    </Link>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Label must not depend on the theme: the server can't know it, which would break hydration.
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon" aria-label="Toggle dark mode" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} />}
      >
        <Sun className="hidden dark:block" />
        <Moon className="dark:hidden" />
      </TooltipTrigger>
      <TooltipContent>Toggle dark mode</TooltipContent>
    </Tooltip>
  );
}

const stateLabels: Record<DemoState, string> = {
  populated: "With data",
  empty: "Empty",
  loading: "Loading",
  error: "Error",
};

function StateSwitcher() {
  const { state, setState } = useDemoState();
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-muted-foreground xl:inline">Preview state</span>
      <Select value={state} onValueChange={(v) => setState(v as DemoState)}>
        <SelectTrigger size="sm" aria-label="Preview state (prototype only)" className="w-[7.5rem]">
          <SelectValue>{(v: DemoState) => stateLabels[v]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(stateLabels) as DemoState[]).map((s) => (
            <SelectItem key={s} value={s}>
              {stateLabels[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const mobileTabs = [navGroups[0].items[0], navGroups[0].items[1], navGroups[0].items[2], navGroups[0].items[3]];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <DemoStateProvider pathname={pathname}>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
          <Brand />
          <SidebarNav pathname={pathname} />
          <p className="border-t border-sidebar-border px-5 py-3 text-xs text-muted-foreground">Prototype · sample data only</p>
        </aside>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>All screens</SheetDescription>
            </SheetHeader>
            <Brand />
            <SidebarNav pathname={pathname} onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur supports-backdrop-filter:bg-background/75 sm:px-6">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>
              <Menu />
            </Button>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border bg-card px-2.5 text-sm text-muted-foreground transition-colors hover:border-ring/60 sm:max-w-md"
            >
              <Search className="size-4 shrink-0" />
              <span className="truncate">Jump to a guide, screen or action</span>
              <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[11px] sm:inline">Ctrl K</kbd>
            </button>
            <div className="ml-auto flex items-center gap-1">
              <StateSwitcher />
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pb-10">{children}</main>
        </div>

        <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          {mobileTabs.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex h-14 flex-col items-center justify-center gap-1 text-[11px]", active ? "text-primary" : "text-muted-foreground")}
              >
                <item.icon className="size-5" />
                {item.short ?? item.label}
              </Link>
            );
          })}
          <button type="button" onClick={() => setMenuOpen(true)} className="flex h-14 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground">
            <MoreHorizontal className="size-5" />
            More
          </button>
        </nav>

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </DemoStateProvider>
  );
}
