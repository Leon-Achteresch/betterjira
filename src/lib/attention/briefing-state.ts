export const ATTENTION_TIMEOUT_MS = 15 * 60_000;
export const BRIEFING_PREVIEW_LIMIT = 3;

export type BriefingStatusKind =
  "unconfigured" | "paused" | "loading" | "running" | "failed" | "timed-out" | "ready" | "empty";

export type BriefingStatus = {
  kind: BriefingStatusKind;
  label: string;
  message: string;
};

export type BriefingStatusInput = {
  enabled: boolean;
  hasWebhook: boolean;
  loading: boolean;
  sending: boolean;
  pendingRunId: string | null;
  lastTriggeredAt: number | null;
  resultRunId: string | null;
  resultCount: number;
  error: string | null;
  unrecognizedResult: boolean;
  now: number;
};

export const attentionScope = (cloudId: string, accountId: string) => JSON.stringify([cloudId, accountId]);

export const scopedBriefingResult = <T extends { runId: string }>(
  result: T | null | undefined,
  scope: string | undefined,
  owners: Readonly<Record<string, string>>,
): T | null => (result && scope && owners[result.runId] === scope ? result : null);

export const isAttentionPending = (
  pendingRunId: string | null,
  lastTriggeredAt: number | null,
  resultRunId: string | null,
  now: number,
) =>
  pendingRunId !== null &&
  pendingRunId !== resultRunId &&
  lastTriggeredAt !== null &&
  now - lastTriggeredAt < ATTENTION_TIMEOUT_MS;

export const isAttentionWebhook = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

export const briefingStatus = (input: BriefingStatusInput): BriefingStatus => {
  if (!input.hasWebhook)
    return { kind: "unconfigured", label: "Optional", message: "KI kann dir die nächsten Schritte vorschlagen." };
  if (input.loading) return { kind: "loading", label: "Wird geladen", message: "Der letzte Stand wird geladen." };
  const unfinished = input.pendingRunId !== null && input.pendingRunId !== input.resultRunId;
  if (unfinished && input.lastTriggeredAt !== null && input.now - input.lastTriggeredAt >= ATTENTION_TIMEOUT_MS) {
    return {
      kind: "timed-out",
      label: "Antwort ausstehend",
      message: "Seit 15 Minuten ist kein Ergebnis angekommen. Du kannst die Analyse erneut starten.",
    };
  }
  if (input.sending || isAttentionPending(input.pendingRunId, input.lastTriggeredAt, input.resultRunId, input.now)) {
    return {
      kind: "running",
      label: "Analyse läuft",
      message: input.resultRunId
        ? "Der letzte Stand bleibt sichtbar, bis das neue Briefing ankommt."
        : "Der Agent prüft deine Tickets. Du kannst währenddessen weiterarbeiten.",
    };
  }
  if (input.error) return { kind: "failed", label: "Nicht aktualisiert", message: input.error };
  if (!input.enabled) return { kind: "paused", label: "Pausiert", message: "Automatische Analysen sind pausiert." };
  if (input.unrecognizedResult)
    return {
      kind: "empty",
      label: "Neuer Stand nötig",
      message:
        "Das gespeicherte Briefing ist diesem Konto nicht zugeordnet. Erstelle ein neues Briefing für dieses Konto.",
    };
  if (!input.resultRunId)
    return { kind: "empty", label: "Bereit", message: "Starte deine erste Analyse, wenn du einen Überblick brauchst." };
  return {
    kind: "ready",
    label: input.resultCount ? `${input.resultCount} Vorschläge` : "Alles im Blick",
    message: input.resultCount
      ? "KI-Vorschläge zum Prüfen. Öffne einen Vorgang, um selbst weiterzuarbeiten."
      : "In den analysierten Tickets wurde kein nächster Schritt für dich gefunden.",
  };
};
