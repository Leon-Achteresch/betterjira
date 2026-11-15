import { Effect } from "effect";
import { expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn());
vi.mock("@/lib/jira/client", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/jira/client")>();
  return { ...actual, jiraSend: send };
});
import { addWorklog } from "@/lib/jira/issue";

it("sends an explicit remaining estimate as query parameters, not as a worklog body field", async () => {
  send.mockReturnValue(Effect.void);
  await Effect.runPromise(addWorklog("DEMO-1", { timeSpent: "1h", started: "2026-11-15T09:00:00.000+0100", remainingEstimate: "0m" }));
  expect(send).toHaveBeenLastCalledWith("/issue/DEMO-1/worklog?adjustEstimate=new&newEstimate=0m", { method: "POST", body: JSON.stringify({ timeSpent: "1h", started: "2026-11-15T09:00:00.000+0100" }) }, "api/2");
  send.mockClear();
  await expect(Effect.runPromise(addWorklog("DEMO-1", { timeSpent: "1h", started: "2026-11-15T09:00:00.000+0100", remainingEstimate: "bad" }))).rejects.toThrow();
  expect(send).not.toHaveBeenCalled();
});
