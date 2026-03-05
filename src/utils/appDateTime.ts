/**
 * App default timezone: US Eastern (market time).
 * Use this for ALL date/time display and day-boundary logic so the app is consistent.
 */
export const APP_TIMEZONE = "America/New_York";

const enUS = "en-US";

function formatter(options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(enUS, { ...options, timeZone: APP_TIMEZONE });
}

/** Format a date in app timezone with custom Intl options. */
export function formatInAppTz(
  date: Date,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(enUS, { ...options, timeZone: APP_TIMEZONE }).format(date);
}

/** Date only in ET, e.g. "Mar 5, 2026". */
export function formatAppDate(date: Date): string {
  return formatInAppTz(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Date and time short in ET, e.g. "Mar 5, 2026, 9:30 AM". */
export function formatAppDateTime(date: Date): string {
  return formatInAppTz(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Date and time with seconds in ET, e.g. "Mar 5, 2026 09:30:00". */
export function formatAppDateTimeLong(date: Date): string {
  const p = formatter({
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => p.find((x) => x.type === type)?.value ?? "";
  return `${get("month")} ${get("day")}, ${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/** Date and time ISO-style in ET, e.g. "2026-03-05 14:30:00". */
export function formatAppDateTimeISO(date: Date): string {
  const p = formatter({
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => p.find((x) => x.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/** Day number in ET, e.g. "5". */
export function formatAppDayNum(date: Date): string {
  return formatInAppTz(date, { day: "numeric" });
}

/** Month and year in ET, e.g. "March, 2026". */
export function formatAppMonthYear(date: Date): string {
  return formatInAppTz(date, { month: "long", year: "numeric" });
}

/**
 * Return "YYYY-MM-DD" for the given instant in app timezone.
 * Use for daily buckets (PnL by day, trade count by day).
 */
export function getAppDateKey(date: Date): string {
  const p = formatter({
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => p.find((x) => x.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Year, month, day, hour in app timezone (for filters). month/day/hour are zero-padded. */
export function getAppDateParts(date: Date): { year: string; month: string; day: string; hour: string } {
  const p = formatter({
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => p.find((x) => x.type === type)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
}

/** Format a date key (YYYY-MM-DD) for display in ET, e.g. "May 05, 2025". */
export function formatAppDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return dateKey;
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return formatInAppTz(date, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

/** Today's date key in ET. */
export function getTodayAppDateKey(): string {
  return getAppDateKey(new Date());
}

/** Previous calendar day in ET. Input must be "YYYY-MM-DD". */
export function getPreviousAppDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return dateKey;
  const prev = new Date(y, m - 1, d - 1);
  const py = prev.getFullYear();
  const pm = prev.getMonth() + 1;
  const pd = prev.getDate();
  return `${py}-${String(pm).padStart(2, "0")}-${String(pd).padStart(2, "0")}`;
}

/**
 * All date keys (YYYY-MM-DD) in a month. month is 0-indexed (0 = January).
 * Use for calendar grids keyed by ET date.
 */
export function getMonthDaysAppKeys(year: number, month: number): string[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const m = String(month + 1).padStart(2, "0");
  return Array.from({ length: daysInMonth }, (_, i) =>
    `${year}-${m}-${String(i + 1).padStart(2, "0")}`
  );
}
