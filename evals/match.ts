import type { CheckedAnswer } from "@/lib/accountant/core/answer";
import type { ExpectedLine } from "./scenarios";

type PoolLine = { type: string; side: "dr" | "cr"; sen: number; used: boolean };

/** Up to 4 unused lines of the same type and side that add up to the amount (a split such as RM990 + RM10). */
function findSum(pool: PoolLine[], x: ExpectedLine, target: number): PoolLine[] | null {
  const candidates = pool.filter((p) => !p.used && p.type === x.type && p.side === x.side && p.sen <= target);
  const search = (start: number, left: number, picked: PoolLine[]): PoolLine[] | null => {
    if (left === 0 && picked.length) return picked;
    if (picked.length === 4) return null;
    for (let i = start; i < candidates.length; i++) {
      if (candidates[i].sen > left) continue;
      const found = search(i + 1, left - candidates[i].sen, [...picked, candidates[i]]);
      if (found) return found;
    }
    return null;
  };
  return search(0, target, []);
}

/**
 * The expected lines not found in the answer's entries. Account names may differ; the type, side and amount must
 * match, either as one line or as up to four lines of that type and side that add up to it. Each line is used once.
 */
export function missingLines(c: CheckedAnswer, expected: ExpectedLine[]): ExpectedLine[] {
  const pool: PoolLine[] = c.answer.entries.flatMap((e) =>
    e.lines.map((l) => ({ type: l.accountType, side: l.dr !== null ? ("dr" as const) : ("cr" as const), sen: Math.round((l.dr ?? l.cr ?? 0) * 100), used: false })),
  );
  // Single exact matches first, so a split never takes a line another expectation needs whole.
  const left = expected.filter((x) => {
    const hit = pool.find((p) => !p.used && p.type === x.type && p.side === x.side && p.sen === Math.round(x.amount * 100));
    if (hit) hit.used = true;
    return !hit;
  });
  return left.filter((x) => {
    const parts = findSum(pool, x, Math.round(x.amount * 100));
    parts?.forEach((p) => (p.used = true));
    return !parts;
  });
}
