import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import {
  applyBulkCompletion, BULK_TRANSITION_LIMIT, completionStatuses, reviewBulkCompletion, validBulkTransitionTargets,
} from "./bulk-transition-comment";
import type { JiraTransition } from "./issue-transitions";

const working = { id: "3", name: "In Arbeit", statusCategory: { key: "indeterminate", colorName: "yellow" } };
const done = { id: "4", name: "Erledigt", statusCategory: { key: "done", colorName: "green" } };
const completion = { id: "31", name: "Abschließen", to: done, fields: {}, isAvailable: true } satisfies JiraTransition;
const ticket = (transitions: readonly JiraTransition[], current = working) => ({
  target: { key: "DEMO-1", id: "1" }, current, transitions, reason: undefined,
});

describe("Sammelabschluss mit Begründung", () => {
  it("verwendet Abschlusskategorie und Ziel-ID, ein geteilter Anzeigename reicht nicht", () => {
    const otherStatus = { ...done, id: "5" };
    const tickets = [ticket([completion, { ...completion, id: "32", to: otherStatus }, { ...completion, id: "33", to: working }])];
    expect(completionStatuses(tickets)).toEqual([{ id: "4", label: "Erledigt · ID 4" }, { id: "5", label: "Erledigt · ID 5" }]);
    expect(reviewBulkCompletion(tickets, "5")[0]?.eligible?.transition.id).toBe("32");
    expect(reviewBulkCompletion(tickets, "3")[0]?.eligible).toBeUndefined();
  });

  it("sperrt nicht verfügbare, bereits erreichte und unvollständige Ziele", () => {
    const tickets = [
      ticket([{ ...completion, isAvailable: false }]),
      ticket([completion], done),
      ticket([{ ...completion, id: " " }]),
      ticket([{ ...completion, fields: undefined }]),
    ];
    expect(reviewBulkCompletion(tickets, "4").map(({ reason }) => reason)).toEqual([
      "Kein verfügbarer Übergang in diesen Zielstatus.",
      "Vorgang ist bereits im Zielstatus.",
      "Übergangsmetadaten sind unvollständig.",
      "Übergangsmetadaten sind unvollständig.",
    ]);
  });

  it("zeigt Pflichtfelder anhand der Metadaten, bei fehlendem Namen anhand des Feldschlüssels", () => {
    const transition = { ...completion, fields: {
      resolution: { name: "Erledigungsgrund", required: true, schema: { type: "resolution" } },
      customfield_1: { name: " ", required: true, schema: { type: "unknown" } },
    } };
    expect(reviewBulkCompletion([ticket([transition])], "4")[0]).toMatchObject({
      reason: "Pflichtangaben im Einzelvorgang prüfen.",
      fields: [{ name: "Abschließen", required: ["Erledigungsgrund", "customfield_1"] }],
    });
  });

  it("begrenzt die Auswahl und sperrt leere oder doppelte Jira-Zuordnungen", () => {
    const targets = Array.from({ length: BULK_TRANSITION_LIMIT }, (_, index) => ({ key: `DEMO-${index + 1}`, id: String(index + 1) }));
    expect(validBulkTransitionTargets(targets)).toBe(true);
    expect(validBulkTransitionTargets([...targets, { key: "DEMO-21", id: "21" }])).toBe(false);
    expect(validBulkTransitionTargets([targets[0]!, { key: "DEMO-2", id: "1" }])).toBe(false);
    expect(validBulkTransitionTargets([targets[0]!, { key: "DEMO-1", id: "2" }])).toBe(false);
    expect(validBulkTransitionTargets([{ key: "DEMO-1", id: "" }])).toBe(false);
  });

  it("lässt die reguläre Capability auch für einen kopierten Fixture-Scope geschlossen", async () => {
    const rows = reviewBulkCompletion([ticket([completion])], "4");
    expect(rows[0]?.eligible).toBeDefined();
    const onResult = vi.fn();
    await Effect.runPromise(applyBulkCompletion(rows, "4", "Bestätigt", { cloudId: "qa-cloud", accountId: "qa-user" },
      "https://example.atlassian.net", { cloudId: "qa-cloud", isCurrent: () => true }, onResult));
    expect(onResult).toHaveBeenCalledExactlyOnceWith({
      key: "DEMO-1", status: "skipped", message: "Freigabe oder Auswahlkontext fehlt. Nichts gesendet.",
    });
  });
});
