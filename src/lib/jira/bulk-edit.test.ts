import { describe, expect, it } from "vitest";
import { Data, Effect } from "effect";
import {
  bulkEditBody,
  commonBulkOptions,
  parseBulkLabels,
  runBulkEdit,
  validBulkLabels,
} from "./bulk-edit";

const metadata = (ids: string[], required = false) => ({
  fields: {
    assignee: { operations: ["set"], required },
    priority: {
      operations: ["set"],
      allowedValues: ids.map((id) => ({ id, name: id })),
    },
    labels: { operations: ["add", "remove"] },
  },
});
class BulkTestError extends Data.TaggedError("BulkTestError")<{
  message: string;
}> {}

describe("Sammelbearbeitung", () => {
  it("bietet nur gemeinsame Optionen und respektiert Pflichtzuweisungen", () => {
    const common = commonBulkOptions([
      metadata(["1", "2"]),
      metadata(["2", "3"], true),
    ]);
    expect(common.priorities.map(({ id }) => id)).toEqual(["2"]);
    expect(common.assign).toBe(true);
    expect(common.unassign).toBe(false);
    expect(commonBulkOptions([metadata(["1"]), { fields: {} }]).assign).toBe(
      false,
    );
    expect(commonBulkOptions([]).addLabels).toBe(false);
  });
  it("ändert Labels atomar statt andere Labels zu überschreiben", () => {
    expect(bulkEditBody({ kind: "add-labels", labels: ["review"] })).toEqual({
      update: { labels: [{ add: "review" }] },
    });
    expect(bulkEditBody({ kind: "remove-labels", labels: ["old"] })).toEqual({
      update: { labels: [{ remove: "old" }] },
    });
    expect(parseBulkLabels("a, a, b, ")).toEqual(["a", "b"]);
    expect(validBulkLabels(["two words"])).toBe(false);
    expect(validBulkLabels([])).toBe(false);
  });
  it("liefert Teilergebnisse und wiederholt nur fehlgeschlagene eindeutige Tickets", async () => {
    const calls: string[] = [];
    const first = await Effect.runPromise(
      runBulkEdit(["A", "B", "A", "C"], (key) => {
        calls.push(key);
        return key === "B"
          ? Effect.fail(new BulkTestError({ message: "Kein Zugriff" }))
          : Effect.void;
      }),
    );
    expect(first).toEqual([
      { key: "A" },
      { key: "B", error: "Kein Zugriff" },
      { key: "C" },
    ]);
    await Effect.runPromise(
      runBulkEdit(
        first.filter(({ error }) => error).map(({ key }) => key),
        (key) => Effect.sync(() => calls.push(key)),
      ),
    );
    expect(calls).toEqual(["A", "B", "C", "B"]);
  });
  it("begrenzt gleichzeitige Änderungen", async () => {
    let active = 0;
    let peak = 0;
    await Effect.runPromise(
      runBulkEdit(
        Array.from({ length: 12 }, (_, i) => String(i)),
        () =>
          Effect.promise(async () => {
            active++;
            peak = Math.max(peak, active);
            await new Promise((resolve) => setTimeout(resolve, 2));
            active--;
          }),
      ),
    );
    expect(peak).toBe(3);
  });
});

it("bietet nur gemeinsame Statusziele ohne weitere Pflichtfelder", () => {
  const one = {
    fields: {},
    transitions: [
      { id: "11", to: { id: "done", name: "Erledigt" } },
      {
        id: "12",
        to: { id: "open", name: "Offen" },
        fields: { resolution: { required: true } },
      },
    ],
  };
  const two = {
    fields: {},
    transitions: [{ id: "99", to: { id: "done", name: "Erledigt" } }],
  };
  expect(commonBulkOptions([one, two]).statuses).toEqual([
    { id: "done", name: "Erledigt" },
  ]);
  expect(commonBulkOptions([one, { fields: {} }]).statuses).toEqual([]);
});
