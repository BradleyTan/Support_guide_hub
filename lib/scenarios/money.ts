import type { JournalEntry, JournalLine } from "@/lib/types";

/**
 * All scenario arithmetic is done in sen (integer cents) so rounding can never unbalance an entry.
 * Inputs arrive in RM (or foreign currency) with up to 2 decimals.
 */

/** RM (or foreign) amount → sen. Inputs are validated to at most 2 decimals. */
export function toSen(amount: number) {
  return Math.round(amount * 100);
}

export function fromSen(sen: number) {
  return sen / 100;
}

/** Foreign amount (in its cents) × exchange rate → RM sen, rounded to the nearest sen. */
export function convert(foreignCents: number, rate: number) {
  return Math.round(foreignCents * rate);
}

/** pct% of an amount in sen, rounded to the nearest sen. */
export function percentOf(sen: number, pct: number) {
  return Math.round((sen * pct) / 100);
}

/** Malaysia's cash rounding mechanism: total rounded to the nearest 5 sen. */
export function roundToFiveSen(sen: number) {
  return Math.round(sen / 5) * 5;
}

export interface SenLine {
  account: string;
  dr?: number;
  cr?: number;
}

/**
 * Builds a journal entry from sen amounts. Zero lines are dropped, and it throws if Dr ≠ Cr,
 * so a scenario can never return an unbalanced entry.
 */
export function entry(date: string, description: string, lines: SenLine[]): JournalEntry {
  const kept = lines.filter((l) => (l.dr ?? 0) !== 0 || (l.cr ?? 0) !== 0);
  for (const l of kept) {
    if ((l.dr ?? 0) < 0 || (l.cr ?? 0) < 0) throw new Error(`Negative amount on ${l.account}`);
  }
  const dr = kept.reduce((s, l) => s + (l.dr ?? 0), 0);
  const cr = kept.reduce((s, l) => s + (l.cr ?? 0), 0);
  if (dr !== cr) throw new Error(`Unbalanced entry "${description}": Dr ${dr} ≠ Cr ${cr} sen`);
  return {
    date,
    description,
    lines: kept.map((l): JournalLine => ({ account: l.account, ...(l.dr ? { dr: fromSen(l.dr) } : {}), ...(l.cr ? { cr: fromSen(l.cr) } : {}) })),
  };
}

/** "RM 1,234.50" for narrative text. */
export function rm(sen: number) {
  return `RM ${new Intl.NumberFormat("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(fromSen(sen))}`;
}

/** "USD 1,000.00" for narrative text. */
export function fc(cents: number, currency: string) {
  return `${currency} ${new Intl.NumberFormat("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(fromSen(cents))}`;
}

/** A gain/loss line pair: positive difference = gain (Cr), negative = loss (Dr). */
export function gainOrLoss(diffSen: number, gainAccount: string, lossAccount: string): SenLine[] {
  if (diffSen > 0) return [{ account: gainAccount, cr: diffSen }];
  if (diffSen < 0) return [{ account: lossAccount, dr: -diffSen }];
  return [];
}
