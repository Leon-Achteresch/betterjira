export const parseDayOffset = (input: string) => {
  const text = input.trim();
  if (!/^[+-]?\d+$/.test(text)) return null;
  const days = Number(text);
  return Number.isSafeInteger(days) && days !== 0 ? days : null;
};

export const shiftCalendarDate = (value: string, days: number): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isSafeInteger(days)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || year > 9999) return null;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  date.setUTCDate(date.getUTCDate() + days);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) return null;
  return `${String(date.getUTCFullYear()).padStart(4, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
};
