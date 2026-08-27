import { Application, QUIET_AFTER_DAYS, statusMeta } from "./types";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Dates in this app are calendar days, not instants. Parsing "2026-08-24" with
 * `new Date(string)` would read it as UTC midnight and shift a day for anyone
 * west of Greenwich, so the parts are pulled apart by hand into a local date.
 */
export function parseDay(iso: string): Date | null {
  const parts = iso?.split("-");
  if (!parts || parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function daysSince(iso: string, now = new Date()): number | null {
  const then = parseDay(iso);
  if (!then) return null;
  return Math.round(
    (startOfDay(now).getTime() - startOfDay(then).getTime()) / 86_400_000,
  );
}

export function shortDate(iso: string): string {
  const d = parseDay(iso);
  return d ? `${MONTHS[d.getMonth()]} ${d.getDate()}` : "—";
}

export function agoWords(days: number | null): string {
  if (days === null) return "";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 60) return "a month ago";
  return `${Math.round(days / 30)} months ago`;
}

/** An application nobody ever answered: explicitly ghosted, or silent too long. */
export function isQuiet(app: Application, now = new Date()): boolean {
  if (app.status === "ghosted") return true;
  if (app.status !== "applied") return false;
  return (daysSince(app.applied_on, now) ?? 0) >= QUIET_AFTER_DAYS;
}

export type Stats = {
  total: number;
  thisWeek: number;
  waiting: number;
  replies: number;
  quiet: number;
  responseRate: number | null;
  mostRecent: number | null;
};

export function computeStats(apps: Application[], now = new Date()): Stats {
  let thisWeek = 0;
  let waiting = 0;
  let replies = 0;
  let quiet = 0;
  let mostRecent: number | null = null;

  for (const app of apps) {
    const days = daysSince(app.applied_on, now);
    if (days !== null && days <= 6) thisWeek++;
    if (app.status === "applied") waiting++;
    if (statusMeta(app.status).replied) replies++;
    if (isQuiet(app, now)) quiet++;
    if (days !== null && (mostRecent === null || days < mostRecent)) {
      mostRecent = days;
    }
  }

  return {
    total: apps.length,
    thisWeek,
    waiting,
    replies,
    quiet,
    responseRate: apps.length ? Math.round((replies / apps.length) * 100) : null,
    mostRecent,
  };
}

export type Week = { label: string; count: number; start: Date; end: Date };

/** Application counts for the last `weeks` seven-day windows, oldest first. */
export function weeklyCounts(
  apps: Application[],
  weeks = 8,
  now = new Date(),
): Week[] {
  const today = startOfDay(now);
  const buckets: Week[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const end = new Date(today);
    end.setDate(end.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    buckets.push({
      start,
      end,
      count: 0,
      label: `${start.getMonth() + 1}/${start.getDate()}`,
    });
  }

  for (const app of apps) {
    const day = parseDay(app.applied_on);
    if (!day) continue;
    const bucket = buckets.find((b) => day >= b.start && day <= b.end);
    if (bucket) bucket.count++;
  }

  return buckets;
}

export function sortByAppliedDesc(apps: Application[]): Application[] {
  return [...apps].sort((a, b) =>
    a.applied_on === b.applied_on
      ? a.id.localeCompare(b.id)
      : a.applied_on < b.applied_on
        ? 1
        : -1,
  );
}
