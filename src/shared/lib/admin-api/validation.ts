import { invalidParam, notFound } from "./errors";

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

/** Accepts undefined (-> default) or an integer 1..max; anything else is a 400. */
export function normalizeLimit(value: unknown, max = MAX_LIMIT, fallback = DEFAULT_LIMIT): number {
  if (value === undefined || value === null || value === "") return fallback;
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > max) {
    throw invalidParam("limit", `Параметр limit должен быть целым числом от 1 до ${max}`);
  }
  return n;
}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Entity ids are uuid TEXT columns. Anything that can't be an id is reported
 * as "not found" rather than reaching the query -- same answer either way.
 */
export function requireId(value: unknown, what: string): string {
  if (typeof value !== "string" || !ID_RE.test(value)) throw notFound(what);
  return value;
}

export function optionalCursor(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !ID_RE.test(value)) {
    throw invalidParam(field, `Некорректное значение параметра ${field}`);
  }
  return value;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** `rows` fetched with take: limit + 1; the extra row only signals "has more". */
export function toPage<T, R extends { id: string }>(rows: R[], limit: number, map: (row: R) => T): Page<T> {
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  return { items: slice.map(map), nextCursor: hasMore ? slice[slice.length - 1].id : null };
}
