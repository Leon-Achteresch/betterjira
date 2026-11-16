import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { jiraKeys } from "./keys";
import { patchBulkSearches, rollbackBulkSearches } from "./bulk-edit-cache";

it("rollback einer Teiländerung bewahrt erfolgreiche und neuere Änderungen", () => {
  const client = new QueryClient();
  const key = jiraKeys.search("project = DEMO", ["labels"], 50);
  const data = {
    pages: [
      {
        issues: [
          { id: "1", key: "DEMO-1", fields: { labels: ["old"] } },
          { id: "2", key: "DEMO-2", fields: { labels: [] } },
        ],
      },
    ],
    pageParams: [undefined],
  };
  client.setQueryData(key, data);
  const patches = patchBulkSearches(
    client,
    ["DEMO-1", "DEMO-2"],
    { kind: "add-labels", labels: ["new"] },
    undefined,
  );
  rollbackBulkSearches(client, patches, ["DEMO-2"]);
  expect(
    client
      .getQueryData<typeof data>(key)
      ?.pages[0]?.issues.map((issue) => issue.fields.labels),
  ).toEqual([["old", "new"], []]);
  client.setQueryData<typeof data>(
    key,
    (current) =>
      current && {
        ...current,
        pages: [
          {
            issues: current.pages[0]!.issues.map((issue) => ({
              ...issue,
              fields: { labels: ["newer"] },
            })),
          },
        ],
      },
  );
  rollbackBulkSearches(client, patches);
  expect(
    client
      .getQueryData<typeof data>(key)
      ?.pages[0]?.issues.map((issue) => issue.fields.labels),
  ).toEqual([["newer"], ["newer"]]);
  client.clear();
});

it("behandelt Datums-Rollback ausschliesslich als lokalen Cacheausgleich und erhaelt neuere Termine", () => {
  const client = new QueryClient();
  const key = jiraKeys.search("project = DEMO", ["duedate"], 50);
  const data = { pages: [{ issues: [{ id: "1", key: "DEMO-1", fields: { duedate: "2026-03-28" } }] }], pageParams: [undefined] };
  client.setQueryData(key, data);
  const patches = patchBulkSearches(client, ["DEMO-1"], { kind: "due-date", value: "2026-03-30" }, undefined);
  expect(client.getQueryData<typeof data>(key)?.pages[0].issues[0].fields.duedate).toBe("2026-03-30");
  rollbackBulkSearches(client, patches);
  expect(client.getQueryData<typeof data>(key)?.pages[0].issues[0].fields.duedate).toBe("2026-03-28");
  const second = patchBulkSearches(client, ["DEMO-1"], { kind: "due-date", value: "2026-03-30" }, undefined);
  client.setQueryData(key, { ...data, pages: [{ issues: [{ ...data.pages[0].issues[0], fields: { duedate: "2026-04-01" } }] }] });
  rollbackBulkSearches(client, second);
  expect(client.getQueryData<typeof data>(key)?.pages[0].issues[0].fields.duedate).toBe("2026-04-01");
  client.clear();
});
