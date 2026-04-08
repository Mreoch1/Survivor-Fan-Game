/**
 * All user-facing lock times and admin lock editing use US Eastern (America/New_York),
 * including EST/EDT. Database stores timestamptz (absolute instants).
 */

export const EASTERN_TZ = "America/New_York";

const easternHmParts = new Intl.DateTimeFormat("en-US", {
  timeZone: EASTERN_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function partsToMap(utc: Date): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of easternHmParts.formatToParts(utc)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return map;
}

function easternCalendarAndClock(utc: Date): { y: number; m: number; d: number; h: number; min: number } {
  const map = partsToMap(utc);
  let h = parseInt(map.hour, 10);
  if (map.hour === "24") h = 0;
  return {
    y: parseInt(map.year, 10),
    m: parseInt(map.month, 10),
    d: parseInt(map.day, 10),
    h,
    min: parseInt(map.minute, 10),
  };
}

/** Human-readable lock line for picks UI, always Eastern. */
export function formatInstantInEastern(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "shortGeneric",
  }).format(d);
}

/**
 * Value for admin lock field: YYYY-MM-DDTHH:mm as wall clock in Eastern (not browser local).
 */
export function formatInstantAsEasternDatetimeValue(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
  const map = partsToMap(d);
  let hour = map.hour;
  if (hour === "24") hour = "00";
  const y = map.year;
  const m = map.month.padStart(2, "0");
  const day = map.day.padStart(2, "0");
  const h = hour.padStart(2, "0");
  const min = map.minute.padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

/** Split Eastern wall-clock string into date + time controls. */
export function formatInstantAsEasternDateAndTime(
  isoOrDate: string | Date
): { date: string; time: string } {
  const dt = formatInstantAsEasternDatetimeValue(isoOrDate);
  if (!dt.includes("T")) return { date: "", time: "" };
  const [date, time] = dt.split("T");
  return { date, time };
}

/**
 * Parse admin input (YYYY-MM-DDTHH:mm or space) as Eastern wall time → UTC ISO string for DB.
 * Returns null if invalid or non-existent local time (spring-forward gap).
 */
export function parseEasternDatetimeValueToIso(input: string): string | null {
  const trimmed = input.trim().replace(" ", "T");
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  const h = parseInt(m[4], 10);
  const mi = parseInt(m[5], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const ymd = y * 10_000 + mo * 100 + d;
  const start = Date.UTC(y, mo - 1, d) - 24 * 3600 * 1000;
  const end = Date.UTC(y, mo - 1, d) + 48 * 3600 * 1000;
  for (let t = start; t <= end; t += 60 * 1000) {
    const p = easternCalendarAndClock(new Date(t));
    if (p.y * 10_000 + p.m * 100 + p.d === ymd && p.h === h && p.min === mi) {
      return new Date(t).toISOString();
    }
  }
  return null;
}
