import { format, isSameDay, roundToNearestMinutes } from "date-fns";

const MAX_DELAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = "(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)";
const LONG_DAY = "(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)";
const MONTH = `(${MONTHS.join("|")})`;
const TIME = "(\\d{2}):(\\d{2}):(\\d{2})";
const IMF_FIXDATE = new RegExp(`^${DAY}, (\\d{2}) ${MONTH} (\\d{4}) ${TIME} GMT$`);
const RFC850_DATE = new RegExp(`^${LONG_DAY}, (\\d{2})-${MONTH}-(\\d{2}) ${TIME} GMT$`);
const ASCTIME_DATE = new RegExp(`^${DAY} ${MONTH} ([ \\d]\\d) ${TIME} (\\d{4})$`);

type DateParts = { day: string; month: string; year: number; hour: string; minute: string; second: string };

const fullYear = (twoDigits: string, now: number) => {
  const current = new Date(now).getUTCFullYear();
  const year = Math.floor(current / 100) * 100 + Number(twoDigits);
  return year > current + 50 ? year - 100 : year;
};

const dateParts = (value: string, now: number): DateParts | undefined => {
  const imf = IMF_FIXDATE.exec(value);
  if (imf) return { day: imf[1], month: imf[2], year: Number(imf[3]), hour: imf[4], minute: imf[5], second: imf[6] };
  const rfc850 = RFC850_DATE.exec(value);
  if (rfc850)
    return { day: rfc850[1], month: rfc850[2], year: fullYear(rfc850[3], now), hour: rfc850[4], minute: rfc850[5], second: rfc850[6] };
  const asctime = ASCTIME_DATE.exec(value);
  if (asctime)
    return { day: asctime[2], month: asctime[1], year: Number(asctime[6]), hour: asctime[3], minute: asctime[4], second: asctime[5] };
  return undefined;
};

export const parseHttpDate = (value: string, now: number) => {
  const parts = dateParts(value, now);
  if (!parts) return undefined;
  const month = MONTHS.indexOf(parts.month);
  const [day, hour, minute, second] = [parts.day, parts.hour, parts.minute, parts.second].map(Number);
  if (hour > 23 || minute > 59 || second > 60) return undefined;
  const date = new Date(Date.UTC(parts.year, month, day));
  if (date.getUTCMonth() !== month || date.getUTCDate() !== day) return undefined;
  return date.getTime() + ((hour * 60 + minute) * 60 + second) * 1000;
};

export const retryAtFrom = (header: string | null, now: number) => {
  if (header === null) return undefined;
  const value = header.trim();
  const target = /^\d+$/.test(value) ? now + Number(value) * 1000 : parseHttpDate(value, now);
  if (target === undefined) return undefined;
  const delay = target - now;
  return delay > 0 && delay <= MAX_DELAY_MS ? target : undefined;
};

export const rateLimitMessage = (retryAt: number | undefined, now: number) => {
  const intro = "Jira begrenzt gerade die Anzahl der Anfragen.";
  if (retryAt === undefined || retryAt <= now) return `${intro} Bitte später erneut versuchen.`;
  const earliest = roundToNearestMinutes(retryAt, { roundingMethod: "ceil" });
  const time = format(earliest, isSameDay(earliest, now) ? "HH:mm" : "dd.MM., HH:mm");
  return `${intro} Bitte frühestens ab ${time} Uhr erneut versuchen.`;
};
