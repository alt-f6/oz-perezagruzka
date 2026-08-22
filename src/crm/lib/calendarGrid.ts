export function toDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
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
