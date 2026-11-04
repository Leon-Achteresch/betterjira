export const WORKLOG_PRESETS = ["15m", "30m", "1h", "2h"] as const;

export const normalizeDuration = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  if (!/^(?:\d+\s*[wdhm]\s*)+$/.test(trimmed)) return undefined;
  const parts = [...trimmed.matchAll(/(\d+)\s*([wdhm])/g)];
  if (
    parts.some((part) => !Number.isSafeInteger(Number(part[1]))) ||
    parts.every((part) => Number(part[1]) === 0)
  )
    return undefined;
  const units = parts.map((part) => part[2]);
  if (new Set(units).size !== units.length) return undefined;
  return parts
    .filter((part) => Number(part[1]) > 0)
    .map((part) => `${Number(part[1])}${part[2]}`)
    .join(" ");
};

export const validateWorklog = (
  duration: string,
  started: string,
  now = Date.now(),
) => {
  if (!normalizeDuration(duration))
    return "Gib eine Dauer wie 30m oder 1h 30m ein (w, d, h, m).";
  const timestamp = Date.parse(started);
  if (!Number.isFinite(timestamp)) return "Wähle einen gültigen Beginn.";
  if (timestamp > now + 60_000)
    return "Der Beginn darf nicht in der Zukunft liegen.";
  return undefined;
};
