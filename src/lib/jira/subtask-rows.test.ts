import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { parseSubtaskRows, previewSubtaskRows, submitSubtaskRows, type SubtaskRowsTarget } from "./subtask-rows";

const target: SubtaskRowsTarget = {
  scope: { cloudId: "qa-cloud", accountId: "qa-user" }, siteUrl: "https://example.atlassian.net",
  parent: { id: "10", key: "DEMO-1", summary: "Parent" }, project: { id: "1", key: "DEMO", name: "Demo" },
  type: { id: "2", name: "Unteraufgabe" },
};

describe("Unteraufgabenzeilen", () => {
  it("behält Zeilennummern, kürzt nur Außenabstände und erkennt doppelte oder ungeeignete Titel", () => {
    const result = parseSubtaskRows(" Bericht prüfen \r\n\r\nÜbernehmen\nU\u0308BERNEHMEN\nWert\tZusatz\n");
    expect(result.rows.map(({ line, title }) => [line, title])).toEqual([[1, "Bericht prüfen"], [2, ""], [3, "Übernehmen"], [4, "U\u0308BERNEHMEN"], [5, "Wert\tZusatz"]]);
    expect(result.rows.map(({ problem }) => problem)).toEqual([undefined, "Titel fehlt.", "Titel ist im Entwurf doppelt.", "Titel ist im Entwurf doppelt.", "Die Zeile enthält ein nicht unterstütztes Steuerzeichen."]);
  });

  it("meldet Grenzen ohne Teilvorschau oder gekürzte Titel", () => {
    expect(parseSubtaskRows("A\n".repeat(9))).toEqual({ rows: [], problem: expect.stringContaining("8 Zeilen") });
    expect(parseSubtaskRows("A".repeat(2049))).toEqual({ rows: [], problem: expect.stringContaining("2048 Zeichen") });
    expect(parseSubtaskRows("A".repeat(256)).rows[0]).toMatchObject({ title: "A".repeat(256), problem: expect.stringContaining("255 Zeichen") });
    expect(parseSubtaskRows("A".repeat(255)).rows[0]?.problem).toBeUndefined();
    expect(parseSubtaskRows("\r\n  \n").rows).toEqual([]);
  });

  it("verwendet für rein ungültige Eingabe keine Jira-Abfrage", async () => {
    const isCurrent = vi.fn(() => true);
    const preview = await Effect.runPromise(previewSubtaskRows("Doppelt\ndoppelt", target, { cloudId: "qa-cloud", isCurrent }));
    expect(preview.rows).toHaveLength(2);
    expect(preview.rows.every(({ problem }) => !!problem)).toBe(true);
    expect(isCurrent).not.toHaveBeenCalled();
  });

  it("sperrt auch direkt aufgerufene Abgaben im normalen Build", async () => {
    const onDispatch = vi.fn();
    const preview = { ...parseSubtaskRows("Bestätigt\nOffen"), target };
    const result = await Effect.runPromise(submitSubtaskRows(preview, [1], { cloudId: "qa-cloud", isCurrent: () => true, onDispatch }));
    expect(result.map(({ status }) => status)).toEqual(["blocked", "unselected"]);
    expect(onDispatch).not.toHaveBeenCalled();
  });
});
