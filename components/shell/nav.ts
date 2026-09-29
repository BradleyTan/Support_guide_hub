import {
  BookOpenCheck,
  BookText,
  Calculator,
  FileStack,
  History,
  LayoutDashboard,
  MessageSquareText,
  Search,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  short?: string; // label on the phone tab bar
  icon: LucideIcon;
  shortcut?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Guidelines",
    items: [
      { href: "/", label: "Home", icon: LayoutDashboard },
      { href: "/guides", label: "Guide library", short: "Guides", icon: BookText },
      { href: "/search", label: "Search", icon: Search, shortcut: "/" },
      { href: "/analyst", label: "Accounting analyst", short: "Analyst", icon: Calculator },
    ],
  },
  {
    label: "Write",
    items: [
      { href: "/replies", label: "Reply generator", icon: MessageSquareText },
      { href: "/sop", label: "SOP builder", icon: BookOpenCheck },
      { href: "/templates", label: "Templates & snippets", icon: FileStack },
      { href: "/releases", label: "Versions & releases", icon: History },
    ],
  },
];

export const settingsItem: NavItem = { href: "/settings", label: "Settings", icon: Settings };

export const allNavItems = [...navGroups.flatMap((g) => g.items), settingsItem];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
