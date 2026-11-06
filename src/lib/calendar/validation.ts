import type { RolloutDraft } from "./model";

export const ROLLOUT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const REMINDER_MINUTES = [0, 5, 15, 30, 60, 1440] as const;

export const isInstant = (value: string) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value));

export const validateRolloutDraft = (draft: RolloutDraft): string | undefined => {
  if (!draft.title.trim()) return "Bitte einen Titel eingeben.";
  if (draft.title.trim().length > 255) return "Der Titel darf höchstens 255 Zeichen enthalten.";
  if (!isInstant(draft.start) || !isInstant(draft.end)) return "Bitte einen gültigen Zeitraum mit Zeitzone eingeben.";
  if (Date.parse(draft.end) <= Date.parse(draft.start)) return "Das Ende muss nach dem Beginn liegen.";
  if (draft.notes.length > 20_000) return "Die Notizen dürfen höchstens 20.000 Zeichen enthalten.";
  if (!REMINDER_MINUTES.some((value) => value === draft.reminderMinutes)) return "Bitte eine gültige Erinnerung wählen.";
  if (draft.issues.some((issue) => !/^[A-Z][A-Z0-9_]*-[1-9]\d*$/.test(issue.key))) return "Ein Ticketschlüssel ist ungültig.";
  if (new Set(draft.issues.map((issue) => issue.key)).size !== draft.issues.length) return "Ein Ticket ist mehrfach verknüpft.";
  if (draft.siteUrl || draft.issues.length > 0) {
    try {
      const url = new URL(draft.siteUrl);
      if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) {
        return "Die Jira-Adresse ist ungültig.";
      }
    } catch {
      return "Bitte zuerst mit Jira verbinden, um Tickets zu verknüpfen.";
    }
  }
};

export const normalizeRolloutDraft = (draft: RolloutDraft): RolloutDraft => ({
  ...draft,
  title: draft.title.trim(),
  start: new Date(draft.start).toISOString(),
  end: new Date(draft.end).toISOString(),
  siteUrl: draft.siteUrl.replace(/\/+$/, ""),
});

export const rolloutBody = (draft: RolloutDraft) => {
  const tickets = draft.issues.map((issue) => `${issue.key} · ${issue.summary}\n${draft.siteUrl}/browse/${issue.key}`).join("\n\n");
  return [draft.notes, tickets && `Verknüpfte Tickets\n${tickets}`, "Geplant mit betterjira"].filter(Boolean).join("\n\n");
};
