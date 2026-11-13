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
