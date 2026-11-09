import { beforeEach, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
import {
  articlePerson,
  canReplyToArticle,
  getAvatar,
  personFromAddress,
  personFromUser,
  replyRecipient,
} from "./people";
import type { Article } from "./model";
const article: Article = {
  id: 11,
  ticket_id: 41,
  body: "Hallo",
  internal: false,
  type: "email",
  sender: "Customer",
  from: "Sam Kunde <sam@example.com>",
  created_at: "2026-11-09T09:00:00Z",
  created_by_id: 7,
};
beforeEach(() => invoke.mockReset());
describe("Zammad people and communication", () => {
  it("uses names and initials, preserving email separately", () => {
    expect(personFromAddress(article.from ?? "", "Kunde")).toMatchObject({
      name: "Sam Kunde",
      email: "sam@example.com",
      initials: "SK",
    });
    expect(personFromAddress("-", "Nicht zugewiesen").name).toBe(
      "Nicht zugewiesen",
    );
  });
  it("does not offer replies to internal or system comments", () => {
    expect(canReplyToArticle(article)).toBe(true);
    expect(canReplyToArticle({ ...article, internal: true })).toBe(false);
    expect(canReplyToArticle({ ...article, sender: "System" })).toBe(false);
    expect(
      canReplyToArticle({ ...article, type: "note", sender: "Agent" }),
    ).toBe(false);
  });
  it("never assigns an agent's face to a mismatched sender address", () => {
    const agent = personFromUser(
      {
        id: 7,
        firstname: "Alex",
        lastname: "Support",
        email: "alex@example.com",
      },
      "data:image/jpeg;base64,abc",
    );
    expect(articlePerson(article, new Map([[7, agent]]))).toMatchObject({
      name: "Sam Kunde",
    });
    expect(
      articlePerson(article, new Map([[7, agent]])).avatarUrl,
    ).toBeUndefined();
  });
  it("loads images through the native connection and accepts only image MIME types", async () => {
    invoke.mockResolvedValueOnce({
      status: 200,
      data: [72, 105],
      content_type: "image/jpeg",
    });
    expect(await Effect.runPromise(getAvatar("aabbcc07"))).toBe(
      "data:image/jpeg;base64,SGk=",
    );
    expect(invoke).toHaveBeenCalledWith("zammad_request", {
      path: "/users/image/aabbcc07",
      method: "GET",
      body: null,
      binary: true,
    });
    invoke.mockResolvedValueOnce({
      status: 200,
      data: [72, 105],
      content_type: "text/html",
    });
    await expect(
      Effect.runPromise(getAvatar("aabbcc07")),
    ).rejects.toMatchObject({ _tag: "ZammadError" });
    invoke.mockReset();
    await expect(
      Effect.runPromise(getAvatar("../users/me")),
    ).rejects.toMatchObject({ _tag: "ZammadError" });
    expect(invoke).not.toHaveBeenCalled();
  });
});

it("continues outgoing email with its recipient rather than replying to the agent", () => {
  expect(
    replyRecipient({
      ...article,
      sender: "Agent",
      from: "Alex <support@example.com>",
      to: "Sam Kunde <sam@example.com>",
    }).email,
  ).toBe("sam@example.com");
});
