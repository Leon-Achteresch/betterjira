import { describe, expect, it } from "vitest";
import { subtaskState, summarizeSubtasks } from "./subtask-overview";

const subtask = (key: string, category: string, name = "Status") => ({
  key,
  fields: { status: { name, statusCategory: { key: category } } },
});

describe("subtaskState", () => {
  it("leitet erledigt nur aus der Statuskategorie ab, nicht aus dem Namen", () => {
    expect(subtaskState(subtask("A-1", "done", "Offen"))).toBe("done");
    expect(subtaskState(subtask("A-2", "indeterminate", "Erledigt"))).toBe("open");
    expect(subtaskState(subtask("A-3", "new", "Done"))).toBe("open");
  });

  it("behandelt unbekannte oder fehlende Kategorien als unbekannt", () => {
    expect(subtaskState(subtask("A-1", "undefined", "Erledigt"))).toBe("unknown");
    expect(subtaskState(subtask("A-2", "", "Done"))).toBe("unknown");
    expect(subtaskState(subtask("A-3", "DONE"))).toBe("unknown");
  });
});

describe("summarizeSubtasks", () => {
  const list = [subtask("A-1", "done"), subtask("A-2", "new"), subtask("A-3", "undefined"), subtask("A-4", "indeterminate")];

  it("zählt erledigt, offen und unbekannt gegenüber allen geladenen", () => {
    const result = summarizeSubtasks(list, "all");
    expect([result.total, result.done, result.open, result.unknown]).toEqual([4, 1, 2, 1]);
    expect(result.visible.map(({ key }) => key)).toEqual(["A-1", "A-2", "A-3", "A-4"]);
    expect(result.hiddenUnknown).toBe(0);
  });

  it("zeigt im Filter Offen nur sicher offene und meldet ausgeblendete unbekannte", () => {
    const result = summarizeSubtasks(list, "open");
    expect(result.visible.map(({ key }) => key)).toEqual(["A-2", "A-4"]);
    expect(result.hiddenUnknown).toBe(1);
  });

  it("liefert leere Ergebnisse für leere Listen und wenn alles erledigt ist", () => {
    expect(summarizeSubtasks([], "all")).toEqual({ total: 0, done: 0, open: 0, unknown: 0, visible: [], hiddenUnknown: 0 });
    const allDone = summarizeSubtasks([subtask("A-1", "done")], "open");
    expect(allDone.visible).toEqual([]);
    expect(allDone.done).toBe(1);
  });
});
