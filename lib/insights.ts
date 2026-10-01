import { PRODUCTS, type Guide, type Product } from "@/lib/types";

/** How far back the activity log goes (older rows are deleted nightly). */
export const ACTIVITY_DAYS = 90;
/** A guide not edited for this long may be out of date after AutoCount updates. */
export const STALE_DAYS = 365;
/** New guides aren't listed as "not opened" until they're this old. */
export const NOT_OPENED_MIN_AGE_DAYS = 30;

const DAY = 86_400_000;

export interface WeekActivity {
  weekStart: string; // yyyy-mm-dd, Monday (Malaysia time)
  opens: number;
  searches: number;
  unmatched: number; // searches that matched none of your guides
  added: number;
  edited: number;
}

export interface SearchGap {
  query: string;
  times: number;
  lastSearched: string;
  /** A guide that matches the words now (written since the last search), if any. */
  coveredBy?: { code: string; title: string };
}

export interface OpenedGuide {
  guide: Guide;
  opens: number;
  lastOpened: string;
}

export interface Insights {
  weeks: WeekActivity[];
  gaps: SearchGap[];
  topOpened: OpenedGuide[];
  notOpened: Guide[];
  health: LibraryHealth;
}

/** Missing the parts that make a guide reusable: the cause or the fix steps. */
export function isIncomplete(g: Guide) {
  return !g.cause?.trim() || g.steps.filter((s) => s.trim()).length === 0;
}

export function isStale(g: Guide, now = new Date()) {
  return now.getTime() - new Date(g.updatedAt).getTime() > STALE_DAYS * DAY;
}

export interface LibraryHealth {
  total: number;
  verified: number;
  unverified: Guide[];
  incomplete: Guide[];
  stale: Guide[];
  byProduct: { product: Product; count: number; verified: number }[];
}

/** Lists are oldest-edited first: those are the ones most likely to need attention. */
export function libraryHealth(guides: Guide[], now = new Date()): LibraryHealth {
  const byOldest = (a: Guide, b: Guide) => a.updatedAt.localeCompare(b.updatedAt);
  return {
    total: guides.length,
    verified: guides.filter((g) => g.verified).length,
    unverified: guides.filter((g) => !g.verified).sort(byOldest),
    incomplete: guides.filter(isIncomplete).sort(byOldest),
    stale: guides.filter((g) => isStale(g, now)).sort(byOldest),
    byProduct: PRODUCTS.map((product) => {
      const list = guides.filter((g) => g.product === product);
      return { product, count: list.length, verified: list.filter((g) => g.verified).length };
    }),
  };
}

/** Guides older than a month that weren't opened in the activity window: candidates to review or merge. */
export function notOpenedRecently(guides: Guide[], openedIds: Set<string>, now = new Date()) {
  return guides
    .filter((g) => g.dbId && !openedIds.has(g.dbId) && now.getTime() - new Date(g.createdAt).getTime() > NOT_OPENED_MIN_AGE_DAYS * DAY)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
}

export function activityTotals(weeks: WeekActivity[]) {
  const sum = (k: keyof Omit<WeekActivity, "weekStart">) => weeks.reduce((s, w) => s + w[k], 0);
  const searches = sum("searches");
  const unmatched = sum("unmatched");
  return {
    opens: sum("opens"),
    searches,
    unmatched,
    /** Whole-number percentage of searches that found none of your guides; null when there were no searches. */
    unmatchedPct: searches ? Math.round((unmatched / searches) * 100) : null,
    added: sum("added"),
    edited: sum("edited"),
  };
}

/** "6 Oct" style label for a week's Monday (dates are plain yyyy-mm-dd, so no time zone shift). */
export function weekLabel(weekStart: string) {
  const [y, m, d] = weekStart.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-MY", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Link to start a guide from a search that found nothing. */
export function newGuideHref(query: string) {
  return `/guides/new?title=${encodeURIComponent(query.trim().slice(0, 300))}`;
}
