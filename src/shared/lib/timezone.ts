/**
 * Single source of truth for the school's business timezone.
 *
 * The whole product operates in Europe/Moscow (UTC+3, no DST since 2014). Every
 * lesson wall-clock the operator types is a Moscow wall-clock, and every
 * schedule/calendar view must render Moscow wall-clock — regardless of the
 * timezone of the Node server (typically UTC in Docker) or the operator's
 * browser.
 *
 * Historically both sides floated on the ambient timezone: the `createLesson`
 * server action built `scheduledAt` with `Date#setHours` (server-local), while
 * views formatted with `Intl.DateTimeFormat` and no `timeZone` (browser-local).
 * When the two zones differed (UTC server + Moscow browser) a 11:00 selection
 * persisted as 11:00Z and rendered as 14:00 (TIME-02), and near midnight the
 * calendar day slipped by one (TIME-01). Pinning both parse and format to
 * Europe/Moscow here makes the round-trip deterministic and TZ-invariant.
 */
export const BUSINESS_TIMEZONE = "Europe/Moscow";

/**
 * Human-readable label for `BUSINESS_TIMEZONE`, for display next to times so
 * operators outside Moscow (e.g. Khanty-Mansiysk UTC+5, Baku UTC+4) have an
 * explicit visual confirmation of which timezone the shown times belong to.
 */
export const BUSINESS_TIMEZONE_LABEL = "МСК, UTC+3";

export const CRM_DISPLAY_TZ_COOKIE = "crm_display_tz";

export interface CrmTimezoneOption {
  value: string;
  cityLabel: string;
  utcOffsetLabel: string;
}

/** The 4 timezones CRM staff may choose as their display/entry zone. */
export const CRM_TIMEZONES: CrmTimezoneOption[] = [
  { value: "Europe/Moscow", cityLabel: "Москва / Санкт-Петербург", utcOffsetLabel: "UTC+3" },
  { value: "Asia/Baku", cityLabel: "Баку / Самара", utcOffsetLabel: "UTC+4" },
  { value: "Asia/Yekaterinburg", cityLabel: "Ханты-Мансийск / Екатеринбург", utcOffsetLabel: "UTC+5" },
  { value: "Asia/Novosibirsk", cityLabel: "Красноярск / Новосибирск", utcOffsetLabel: "UTC+7" },
];

export function isCrmTimezone(value: string): boolean {
  return CRM_TIMEZONES.some((tz) => tz.value === value);
}

/**
 * The offset (localTime − UTC), in milliseconds, that `timeZone` was at the
 * given instant. Positive east of UTC (Moscow → +3h). Computed from the
 * instant's rendered wall-clock in that zone, so it honors historical/DST
 * transitions even though Moscow itself no longer observes DST.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - instant.getTime();
}

/**
 * Converts a wall-clock (year/month/day/hour/minute) interpreted in `timeZone`
 * into the corresponding UTC instant. Two correction passes settle any DST
 * boundary; for a fixed-offset zone like Moscow the first pass already lands.
 *
 * `month` is 1-based (1 = January) to match how humans and `YYYY-MM-DD` keys
 * read, not JS's 0-based month.
 */
export function zonedWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string = BUSINESS_TIMEZONE,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let ts = utcGuess - zoneOffsetMs(new Date(utcGuess), timeZone);
  ts = utcGuess - zoneOffsetMs(new Date(ts), timeZone);
  return new Date(ts);
}

/**
 * Builds the UTC instant for a `YYYY-MM-DD` date key + `HH:MM` time, both read
 * as wall-clock in `timeZone` (defaulting to Moscow). Generalization of
 * moscowDateTimeToUtc, which now delegates here.
 */
export function zonedDateTimeToUtc(
  dateKey: string,
  time: string,
  timeZone: string = BUSINESS_TIMEZONE,
): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return zonedWallClockToUtc(y, m || 1, d || 1, hh || 0, mm || 0, timeZone);
}

/**
 * Builds the UTC instant for a `YYYY-MM-DD` date key + `HH:MM` time, both read
 * as Moscow wall-clock. This is the inverse of the Moscow formatters below and
 * the canonical way the CRM turns a picked date+time into a `scheduledAt`.
 */
export function moscowDateTimeToUtc(dateKey: string, time: string): Date {
  return zonedDateTimeToUtc(dateKey, time, BUSINESS_TIMEZONE);
}

/**
 * Converts a Date carrying the intended wall-clock in its *local* calendar
 * fields (as produced by the CRM's `parseDateKey` + cursor walking) into the
 * UTC instant for that same wall-clock in Moscow. Reads the fields with the
 * local getters that match how the Date was constructed, so it is itself
 * TZ-invariant.
 */
export function localWallClockToMoscowUtc(local: Date): Date {
  return zonedWallClockToUtc(
    local.getFullYear(),
    local.getMonth() + 1,
    local.getDate(),
    local.getHours(),
    local.getMinutes(),
    BUSINESS_TIMEZONE,
  );
}

const moscowDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `HH:MM` wall-clock of `instant` in Moscow. */
export function formatMoscowTime(instant: Date | string): string {
  return formatTimeInZone(instant, BUSINESS_TIMEZONE);
}

/** `DD.MM.YYYY` calendar date of `instant` in Moscow. */
export function formatMoscowDate(instant: Date | string): string {
  return moscowDateFormatter.format(new Date(instant));
}

const moscowDateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** `DD.MM.YYYY, HH:mm` calendar date + wall-clock time of `instant` in Moscow. */
export function formatMoscowDateTime(instant: Date | string): string {
  return moscowDateTimeFormatter.format(new Date(instant));
}

function dateKeyInZone(instant: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}

/** `YYYY-MM-DD` Moscow calendar-day key of `instant` (stable across views). */
export function moscowDateKey(instant: Date | string): string {
  return dateKeyInZone(instant, BUSINESS_TIMEZONE);
}

/** `HH:MM` wall-clock of `instant` in the given zone. */
export function formatTimeInZone(instant: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(instant));
}

/**
 * The wall-clock parts of an instant in an arbitrary zone. Generalization of
 * moscowWallClock, which now delegates here with Europe/Moscow.
 */
export function wallClockInZone(
  instant: Date | string,
  timeZone: string,
): { dateKey: string; hour: number; minute: number; weekdayMon0: number } {
  const d = new Date(instant);
  const dateKey = dateKeyInZone(d, timeZone);
  const [hh, mm] = formatTimeInZone(d, timeZone).split(":").map(Number);
  const jsDay = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  return {
    dateKey,
    hour: hh,
    minute: mm,
    weekdayMon0: (jsDay + 6) % 7,
  };
}

/**
 * The Moscow wall-clock parts of an instant, TZ-invariantly.
 *
 * `weekdayMon0` is the day of week with Monday=0 .. Sunday=6 (the convention
 * the availability grid and week keys use), NOT JS's Sunday=0 `getDay()`. It is
 * derived from the Moscow calendar-day key parsed at UTC midnight, so it never
 * drifts with the server/browser timezone.
 */
export function moscowWallClock(instant: Date | string): {
  dateKey: string;
  hour: number;
  minute: number;
  weekdayMon0: number;
} {
  return wallClockInZone(instant, BUSINESS_TIMEZONE);
}

/** UTC instant of the Europe/Moscow midnight (00:00) for the calendar day containing `instant`. */
export function moscowStartOfDay(instant: Date | string = new Date()): Date {
  const [y, m, d] = moscowDateKey(instant).split("-").map(Number);
  return zonedWallClockToUtc(y, m, d, 0, 0, BUSINESS_TIMEZONE);
}

/**
 * UTC instant exactly one calendar day after `moscowStartOfDay(instant)` -- an
 * exclusive upper bound for a "that MSK day" range filter. Moscow has been a
 * fixed UTC+3 offset with no DST since 2014, so a flat 24h addition is safe.
 */
export function moscowStartOfNextDay(instant: Date | string = new Date()): Date {
  return new Date(moscowStartOfDay(instant).getTime() + 24 * 60 * 60 * 1000);
}

/** UTC instant of the Moscow Monday 00:00 that starts the week containing `instant`. */
export function moscowStartOfWeek(instant: Date | string = new Date()): Date {
  const { weekdayMon0 } = moscowWallClock(instant);
  return new Date(moscowStartOfDay(instant).getTime() - weekdayMon0 * 24 * 60 * 60 * 1000);
}

/** UTC instant of the Moscow Monday 00:00 that starts the week after `instant`'s -- an exclusive upper bound. */
export function moscowStartOfNextWeek(instant: Date | string = new Date()): Date {
  return new Date(moscowStartOfWeek(instant).getTime() + 7 * 24 * 60 * 60 * 1000);
}

/** Shifts `instant` forward (or back, for a negative `days`) by whole 24h days. */
export function addMoscowDays(instant: Date | string, days: number): Date {
  return new Date(new Date(instant).getTime() + days * 24 * 60 * 60 * 1000);
}
