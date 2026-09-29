/** Fixed "today" so the prototype's relative dates stay stable; replaced by real time in Phase 1. */
export const TODAY = new Date("2026-09-30T09:00:00+08:00");

const rm = new Intl.NumberFormat("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatAmount(n: number | undefined) {
  return n === undefined ? "" : rm.format(n);
}

export function formatRM(n: number) {
  return `RM ${rm.format(n)}`;
}

const dateFmt = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });
const dateTimeFmt = new Intl.DateTimeFormat("en-MY", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kuala_Lumpur",
});

export function formatDate(iso: string) {
  return dateFmt.format(new Date(iso));
}

export function formatDateTime(iso: string) {
  return dateTimeFmt.format(new Date(iso));
}

/** Whole days from `iso` to TODAY (positive = in the past). */
export function daysAgo(iso: string) {
  return Math.floor((TODAY.getTime() - new Date(iso).getTime()) / 86_400_000);
}

export function relativeDay(iso: string) {
  const d = daysAgo(iso);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d === -1) return "tomorrow";
  if (d < 0) return `in ${-d} days`;
  return `${d} days ago`;
}

export function formatMinutes(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
