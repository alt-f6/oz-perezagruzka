/**
 * Serializes a Date to a `YYYY-MM-DD` key using its LOCAL calendar fields.
 *
 * Using `toISOString()` here would convert to UTC first, shifting the day
 * backward for any positive-offset timezone (e.g. Moscow UTC+3): a local
 * midnight of the 31st becomes `...T21:00Z` → key "…-30". The whole CRM builds
 * day cells at local midnight, so local-field formatting is the only way to
 * round-trip the exact day the user sees. See parseDateKey for the inverse.
 */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parses a `YYYY-MM-DD` key into a LOCAL-midnight Date (inverse of toDateKey).
 * Avoids `new Date("YYYY-MM-DD")`, which parses as UTC midnight and shifts the
 * day for non-UTC timezones.
 */
export function parseDateKey(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Today's local calendar date as a `YYYY-MM-DD` key. */
export function todayKey(): string {
  return toDateKey(new Date());
}

export function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function buildMonthGrid(date: Date): Date[] {
  const gridStart = startOfWeekMonday(startOfMonth(date));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}
