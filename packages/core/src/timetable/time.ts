import type { ClockTime, ISODate, Weekday } from "../model/types";

/**
 * Time-zone aware helpers built on Intl only (no dependencies).
 * University-local wall-clock time is the source of truth for schedules.
 */

export interface ZonedNow {
  date: ISODate;
  time: ClockTime;
  weekday: Weekday;
  minutes: number; // minutes since local midnight
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(timeZone: string): Intl.DateTimeFormat {
  let f = dtfCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    });
    dtfCache.set(timeZone, f);
  }
  return f;
}

const WEEKDAYS: Record<string, Weekday> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedNow(instant: Date, timeZone: string): ZonedNow {
  const parts = Object.fromEntries(dtf(timeZone).formatToParts(instant).map((p) => [p.type, p.value]));
  const hour = parts.hour === "24" ? "00" : parts.hour!;
  const time = `${hour}:${parts.minute}`;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time,
    weekday: WEEKDAYS[parts.weekday!]!,
    minutes: toMinutes(time),
  };
}

export function toMinutes(t: ClockTime): number {
  const [h, m] = t.split(":").map(Number);
  return h! * 60 + m!;
}

export function fromMinutes(min: number): ClockTime {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Weekday of a calendar date (calendar dates have no zone). */
export function weekdayOf(date: ISODate): Weekday {
  return new Date(`${date}T12:00:00Z`).getUTCDay() as Weekday;
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Dates of the week containing `date`, starting at `weekStart` (default Saturday, common in Kurdistan/Iraq). */
export function weekDates(date: ISODate, weekStart: Weekday = 6): ISODate[] {
  const offset = (weekdayOf(date) - weekStart + 7) % 7;
  const first = addDays(date, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

export function isWeekend(date: ISODate, weekendDays: Weekday[]): boolean {
  return weekendDays.includes(weekdayOf(date));
}

/** The first working day after a university's weekend, used as the week start. */
export function weekStartFor(weekendDays: Weekday[]): Weekday {
  if (weekendDays.length === 0) return 1;
  for (let d = 0; d < 7; d++) {
    const day = d as Weekday;
    const prev = ((d + 6) % 7) as Weekday;
    if (!weekendDays.includes(day) && weekendDays.includes(prev)) return day;
  }
  return 1;
}

/** Convert a university-local date+time to a UTC instant. Handles DST by iteration. */
export function zonedToInstant(date: ISODate, time: ClockTime, timeZone: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  let guess = Date.UTC(y!, mo! - 1, d!, h!, mi!);
  for (let i = 0; i < 3; i++) {
    const z = zonedNow(new Date(guess), timeZone);
    const [zy, zmo, zd] = z.date.split("-").map(Number);
    const zUtc = Date.UTC(zy!, zmo! - 1, zd!, Math.floor(z.minutes / 60), z.minutes % 60);
    const target = Date.UTC(y!, mo! - 1, d!, h!, mi!);
    const diff = target - zUtc;
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess);
}
