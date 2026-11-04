import { describe, expect, it } from "vitest";
import {
  ATTENTION_TIMEOUT_MS,
  attentionScope,
  briefingStatus,
  isAttentionPending,
  isAttentionWebhook,
  scopedBriefingResult,
  type BriefingStatusInput,
} from "./briefing-state";

const input: BriefingStatusInput = {
  enabled: true,
  hasWebhook: true,
  loading: false,
  sending: false,
  pendingRunId: null,
  lastTriggeredAt: null,
  resultRunId: null,
  resultCount: 0,
  error: null,
  unrecognizedResult: false,
  now: 1_000_000,
};

describe("Briefing-Status", () => {
  it("erklärt eine fehlende Einrichtung ruhig als optional", () => {
    expect(briefingStatus({ ...input, hasWebhook: false }).kind).toBe("unconfigured");
  });

  it("kennzeichnet pausierte Automatik", () => {
    expect(briefingStatus({ ...input, enabled: false }).kind).toBe("paused");
  });

  it("zeigt eine manuell gestartete Analyse auch bei pausierter Automatik", () => {
    expect(briefingStatus({ ...input, enabled: false, sending: true }).kind).toBe("running");
  });

  it("zeigt während einer neuen Analyse den laufenden Zustand statt eines alten Lesefehlers", () => {
    expect(briefingStatus({ ...input, sending: true, error: "Altes Ergebnis war ungültig" }).kind).toBe("running");
  });

  it("zeigt den noch ausstehenden Agentenlauf auch nach Abschluss des Webhook-Aufrufs", () => {
    expect(briefingStatus({ ...input, pendingRunId: "run-1", lastTriggeredAt: 999_000 }).kind).toBe("running");
  });

  it("bleibt mit dem vorherigen Ergebnis im laufenden Zustand", () => {
    expect(
      briefingStatus({ ...input, pendingRunId: "neu", resultRunId: "alt", lastTriggeredAt: 999_000 }).message,
    ).toContain("letzte Stand");
  });

  it("erkennt Timeout am exakten Ablauf und ermöglicht einen neuen Versuch", () => {
    const status = briefingStatus({
      ...input,
      pendingRunId: "run-1",
      lastTriggeredAt: input.now - ATTENTION_TIMEOUT_MS,
    });
    expect(status.kind).toBe("timed-out");
    expect(status.message).toContain("erneut starten");
  });

  it("beendet das Warten bei passender Run-ID auch nach dem Timeout", () => {
    expect(
      briefingStatus({ ...input, pendingRunId: "run-1", resultRunId: "run-1", lastTriggeredAt: 0, resultCount: 4 })
        .kind,
    ).toBe("ready");
  });

  it("zeigt bei einem Startfehler eine bleibende Fehlermeldung", () => {
    expect(briefingStatus({ ...input, error: "Webhook ist nicht erreichbar" })).toEqual({
      kind: "failed",
      label: "Nicht aktualisiert",
      message: "Webhook ist nicht erreichbar",
    });
  });

  it("stellt ein leeres Ergebnis nicht als fehlendes Briefing dar", () => {
    expect(briefingStatus({ ...input, resultRunId: "done" }).label).toBe("Alles im Blick");
  });

  it("erklärt ein Ergebnis ohne bekannte Kontozuordnung", () => {
    const status = briefingStatus({ ...input, unrecognizedResult: true });
    expect(status.kind).toBe("empty");
    expect(status.message).toContain("diesem Konto nicht zugeordnet");
  });

  it("zeigt einen vorhandenen Stand weiterhin als Vorschläge", () => {
    expect(briefingStatus({ ...input, resultRunId: "done", resultCount: 12 }).label).toBe("12 Vorschläge");
  });
});

describe("laufende Analyse", () => {
  it("verhindert parallele Starts bis ein Ergebnis vorliegt oder das Zeitlimit abläuft", () => {
    expect(isAttentionPending("new", 0, "old", ATTENTION_TIMEOUT_MS - 1)).toBe(true);
    expect(isAttentionPending("new", 0, "new", ATTENTION_TIMEOUT_MS - 1)).toBe(false);
    expect(isAttentionPending("new", 0, null, ATTENTION_TIMEOUT_MS)).toBe(false);
  });

  it("behandelt unvollständige oder fehlende Triggerdaten", () => {
    expect(isAttentionPending(null, 0, null, 5)).toBe(false);
    expect(isAttentionPending("new", null, null, 5)).toBe(false);
  });
});

describe("Kontozuordnung und Webhook", () => {
  it("zeigt ausschließlich Ergebnisse mit bekannter Zuordnung zum aktuellen Konto", () => {
    const result = { runId: "run-1", summary: "Privates Briefing" };
    expect(scopedBriefingResult(result, "konto-1", { "run-1": "konto-1" })).toBe(result);
    expect(scopedBriefingResult(result, "konto-2", { "run-1": "konto-1" })).toBeNull();
    expect(scopedBriefingResult(result, "konto-1", {})).toBeNull();
    expect(scopedBriefingResult(result, undefined, { "run-1": "konto-1" })).toBeNull();
  });
  it("trennt Konten und Jira-Instanzen eindeutig", () => {
    expect(attentionScope("a", "b:c")).not.toBe(attentionScope("a:b", "c"));
    expect(attentionScope("a", "user-1")).not.toBe(attentionScope("a", "user-2"));
  });

  it.each(["https://example.test/hook", "http://localhost:1234/hook"])("akzeptiert HTTP-Webhooks: %s", (url) => {
    expect(isAttentionWebhook(url)).toBe(true);
  });

  it.each(["", "kein-link", "javascript:alert(1)", "file:///tmp/test"])(
    "weist ungeeignete Webhooks zurück: %s",
    (url) => {
      expect(isAttentionWebhook(url)).toBe(false);
    },
  );
});
