import existing from "./due-date-shift.json" with { type: "json" };

export const shiftDates: Record<string, string | null> = {
  ...Object.fromEntries(existing.issues.map(({ key, fields }) => [key, fields.duedate])),
  "DEMO-7": "2026-12-31",
  "DEMO-8": "2026-02-28",
};

export const staleDate = "2027-01-02";

export const mixedShiftWrites = [
  { key: "DEMO-1", date: "2026-03-29", status: 204 },
  { key: "DEMO-2", date: "2026-10-25", status: 403 },
  { key: "DEMO-5", date: "2026-11-17", status: 503 },
  { key: "DEMO-6", date: "2026-11-18", status: 204 },
] as const;
