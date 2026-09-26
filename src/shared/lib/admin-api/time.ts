import { BUSINESS_TIMEZONE } from "@/shared/lib/timezone";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZoneName: "longOffset",
});

/**
 * ISO 8601 in Moscow wall-clock with an explicit offset, e.g.
 * "2026-09-26T15:04:05.123+03:00". Same instant as toISOString(), but readable
 * without timezone math by an operator (or an LLM) reading the payload.
 */
export function toMoscowIso(instant: Date): string {
  const parts: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(instant)) parts[p.type] = p.value;
  // "GMT+03:00" -> "+03:00"; a zero offset renders as bare "GMT".
  const offset = parts.timeZoneName === "GMT" ? "+00:00" : parts.timeZoneName.replace("GMT", "");
  const ms = String(instant.getUTCMilliseconds()).padStart(3, "0");
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${ms}${offset}`;
}

export function toMoscowIsoOrNull(instant: Date | null | undefined): string | null {
  return instant ? toMoscowIso(instant) : null;
}
