/**
 * Compares two strings using Russian collation rules: case-insensitive, and
 * treats "Ё" as adjacent to "Е" rather than sorting it after "Я". Postgres's
 * default collation doesn't guarantee either of these, and a plain `<`/`>`
 * or unqualified `localeCompare` doesn't either -- this is the one place
 * every CRM name list should sort through so student/teacher/group lists
 * read correctly for Russian-speaking staff.
 */
export function compareRu(a: string, b: string): number {
  return a.localeCompare(b, "ru", { sensitivity: "base" });
}

/**
 * Returns a new array sorted by `key(item)` using Russian collation. Only
 * safe for a fully-materialized list -- never apply this to a page of a
 * cursor-paginated query, since re-sorting one page in JS can desync from
 * the DB-side order the cursor is walking (see student-list.service.ts's
 * listStudents, which deliberately does NOT use this).
 */
export function sortByRu<T>(items: T[], key: (item: T) => string): T[] {
  return [...items].sort((a, b) => compareRu(key(a), key(b)));
}
