import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { deduplicateMutation } from "./deduplicate-mutation";

describe("deduplicateMutation", () => {
  it("gibt einem zweiten gleichzeitigen identischen Kommentar denselben angelegten Kommentar zurück", async () => {
    const client = new QueryClient();
    const key = JSON.stringify(["DEMO-1", "comment", { type: "doc", version: 1, content: [] }]);
    let resolve!: (comment: { id: string }) => void;
    const post = vi.fn(() => new Promise<{ id: string }>((done) => { resolve = done; }));
    const first = deduplicateMutation(client, key, post);
    const second = deduplicateMutation(client, key, post);
    resolve({ id: "c9" });
    expect(await first).toEqual({ id: "c9" });
    expect(await second).toBe(await first);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("trennt Kommentare mit anderem Text oder Ticket", async () => {
    const client = new QueryClient();
    const post = vi.fn(async () => ({ id: "c1" }));
    await Promise.all([
      deduplicateMutation(client, JSON.stringify(["DEMO-1", "comment", "a"]), post),
      deduplicateMutation(client, JSON.stringify(["DEMO-1", "comment", "b"]), post),
      deduplicateMutation(client, JSON.stringify(["DEMO-2", "comment", "a"]), post),
    ]);
    expect(post).toHaveBeenCalledTimes(3);
  });
});
