// Pure rules for Enrollment.accessThroughModule (the monthly-abonement
// cursor: "first N modules of the course"; null = whole course).

export type AccessThrough = number | null;

/**
 * Validates an incoming access value against the course's module count.
 * Accepts null/"all" (whole course) or an integer 0..moduleCount.
 */
export function parseAccessThrough(value: unknown, moduleCount: number): { ok: true; value: AccessThrough } | { ok: false } {
  if (value === null || value === "all") return { ok: true, value: null };
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > moduleCount) return { ok: false };
  return { ok: true, value: n };
}

/** Re-enrolling never takes paid access away: keep the wider of the two. */
export function mergeAccess(existing: AccessThrough, incoming: AccessThrough): AccessThrough {
  if (existing === null || incoming === null) return null;
  return Math.max(existing, incoming);
}

/** "+1 месяц": opens the next module, capped at the course length. */
export function advanceAccess(current: AccessThrough, moduleCount: number, by = 1): AccessThrough {
  if (current === null) return null;
  return Math.min(Math.max(current + by, 0), moduleCount);
}

export function describeAccess(current: AccessThrough, moduleCount: number): string {
  if (current === null || current >= moduleCount) return "Весь курс";
  if (current === 0) return "Нет доступа к модулям";
  return `${current} из ${moduleCount}`;
}
