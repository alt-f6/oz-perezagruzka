// 152-ФЗ boundary for the admin API. Everything served from /api/admin/v1 and
// /api/mcp can end up in a third-party LLM context outside Russia, so personal
// data is minimized here, at the single choke point, rather than trusted to
// each caller: names are shortened to "Имя Ф." and contact/financial fields are
// redacted from any free-form JSON (audit before/after snapshots).

export const SAFE_NAME_FALLBACK = "Ученик";
export const REDACTED = "[скрыто]";

const MAX_NAME_PART_LENGTH = 40;

// A name token that carries digits or '@' is not a name (operators sometimes
// paste "Иван +7 999 …" into the name field) -- drop it rather than leak it.
function isNameToken(token: string): boolean {
  return !/[\d@]/.test(token) && /\p{L}/u.test(token);
}

function initialOf(token: string): string {
  const letter = token.match(/\p{L}/u)?.[0];
  return letter ? `${letter.toLocaleUpperCase("ru-RU")}.` : "";
}

/**
 * Russian CRM convention is "Фамилия Имя [Отчество]". Returns "Имя Ф.":
 *   null / ""               -> "Ученик"
 *   "Марат"                 -> "Марат"
 *   "Алиев Марат К."        -> "Марат А."
 *   "Римская-Корсакова Анна" -> "Анна Р."
 */
export function formatSafeStudentName(fullName: string | null | undefined): string {
  if (typeof fullName !== "string") return SAFE_NAME_FALLBACK;
  const tokens = fullName
    .normalize("NFC")
    .split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}]+|[^\p{L}.]+$/gu, ""))
    .filter((t) => t.length > 0 && isNameToken(t));

  if (tokens.length === 0) return SAFE_NAME_FALLBACK;
  if (tokens.length === 1) return tokens[0].slice(0, MAX_NAME_PART_LENGTH);

  const [surname, firstName] = tokens;
  const initial = initialOf(surname);
  const given = firstName.slice(0, MAX_NAME_PART_LENGTH);
  return initial ? `${given} ${initial}` : given;
}

// Keys are compared after lowercasing and dropping "_"/"-", and match when the
// key CONTAINS a marker, so "parentPhone", "phone_number", "totalBalance",
// "tokenHash", "clientSecret" are all caught.
const SENSITIVE_KEY_MARKERS = [
  "email",
  "phone",
  "parentphone",
  "parentname",
  "balance",
  "passwordhash",
  "password",
  "token",
  "secret",
  "birth", // birthDate, dateOfBirth, birthday
  "telegram",
  "passport",
  "address",
  "authid",
  "apikey",
  "authorization",
  "cookie",
];

// Full names in snapshots are shortened, not dropped, so an audit entry still
// says who it was about. Bare "name"/"title" are NOT here: they also carry
// group and course titles, which must stay intact.
const NAME_KEYS = new Set(["fullname", "studentname", "username"]);

export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[_-]/g, "");
  return SENSITIVE_KEY_MARKERS.some((marker) => normalized.includes(marker));
}

const EMAIL_RE = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu;
// Russian-format phone numbers (+7/8 and 10 more digits, any separators), plus
// any other "+<country>" international number. Guarded against word chars and
// hyphens on both sides so UUID segments and ISO dates are left alone.
const PHONE_RE =
  /(?<![\p{L}\p{N}_-])(?:\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}(?![\p{L}\p{N}_-])|(?<![\p{L}\p{N}_-])\+\d[\d\s()-]{8,}\d(?![\p{L}\p{N}_-])/gu;

export function scrubPiiFromString(value: string): string {
  return value.replace(EMAIL_RE, REDACTED).replace(PHONE_RE, REDACTED);
}

const MAX_DEPTH = 32;

/**
 * Deep-copies `data`, redacting values under sensitive keys, shortening full
 * names, and masking e-mails/phone numbers embedded in any string. Never
 * mutates the input; cycles and excessive depth are cut with REDACTED.
 */
export function scrubPiiFromPayload(data: unknown): unknown {
  const seen = new WeakSet<object>();

  const walk = (value: unknown, depth: number): unknown => {
    if (value === null || value === undefined) return value;
    if (typeof value === "string") return scrubPiiFromString(value);
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (typeof value === "bigint") return value.toString();
    if (value instanceof Date) return value.toISOString();
    if (typeof value !== "object") return undefined; // functions, symbols
    if (depth >= MAX_DEPTH || seen.has(value)) return REDACTED;
    seen.add(value);

    if (Array.isArray(value)) return value.map((item) => walk(item, depth + 1));

    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        out[key] = child === null || child === undefined ? child : REDACTED;
      } else if (NAME_KEYS.has(key.toLowerCase()) && typeof child === "string") {
        out[key] = formatSafeStudentName(child);
      } else {
        out[key] = walk(child, depth + 1);
      }
    }
    return out;
  };

  return walk(data, 0);
}
