// Display formatting for the LMS admin (Russian UI).

/** pluralRu(5, ["урок", "урока", "уроков"]) -> "уроков" */
export function pluralRu(n: number, forms: [one: string, few: string, many: string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

const BYTE_UNITS = ["Б", "КБ", "МБ", "ГБ", "ТБ"];

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 Б";
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1);
  const value = bytes / 1024 ** exp;
  const rounded = value >= 10 || exp === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${String(rounded).replace(".", ",")} ${BYTE_UNITS[exp]}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeRu(date: Date | string, now: Date = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = now.getTime() - d.getTime();

  if (diff < MINUTE) return "только что";
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return `${m} ${pluralRu(m, ["минуту", "минуты", "минут"])} назад`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `${h} ${pluralRu(h, ["час", "часа", "часов"])} назад`;
  }
  const days = Math.floor(diff / DAY);
  if (days === 1) return "вчера";
  if (days < 30) return `${days} ${pluralRu(days, ["день", "дня", "дней"])} назад`;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}
