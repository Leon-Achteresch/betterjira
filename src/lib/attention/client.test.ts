import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AttentionError, readAttention, serveAttention, triggerAttention } from "./client";
import { attentionPrompt } from "./prompt";

const { invoke, attentionContext } = vi.hoisted(() => ({ invoke: vi.fn(), attentionContext: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("./context", () => ({ attentionContext }));

const input = { runId: "run-1", siteUrl: "https://jira.test", me: { accountId: "me", displayName: "Leon" } };
const context = { requestedAt: "2026-11-09T10:00:00Z", me: input.me, issues: [] };

beforeEach(() => {
  invoke.mockReset();
  attentionContext.mockReset().mockReturnValue(Effect.succeed(context));
});

describe("Briefing-Rückkanal", () => {
  it.each([8743, 49152])("sendet den tatsächlichen Port %s an die Automation und verwendet ihn im Prompt", async (port) => {
    invoke.mockResolvedValueOnce(port).mockResolvedValueOnce(null);
    const actualPort = await Effect.runPromise(serveAttention("test-token"));
    await Effect.runPromise(triggerAttention("https://automation.test/hook", input, actualPort));

    const callbackUrl = `http://127.0.0.1:${port}/attention`;
    const body = { runId: input.runId, context, callbackUrl };
    expect(invoke).toHaveBeenNthCalledWith(1, "attention_serve", { token: "test-token" });
    expect(invoke).toHaveBeenNthCalledWith(2, "attention_trigger", {
      url: "https://automation.test/hook",
      body: JSON.stringify(body),
    });
    const prompt = attentionPrompt("test-token").replaceAll("{{body.callbackUrl}}", callbackUrl);
    expect(prompt).toContain(`curl -sS --fail-with-body -X POST "${callbackUrl}"`);
    expect(prompt).toContain('Authorization: Bearer test-token');
    expect(attentionPrompt("test-token")).not.toContain("8743");
  });

  it.each([0, -1, 65536, 8743.5, "8743", null])("weist ungültige Port-Antworten zurück: %s", async (port) => {
    invoke.mockResolvedValue(port);
    await expect(Effect.runPromise(serveAttention("token"))).rejects.toThrow("ungültigen Port");
  });

  it("erhält die Fehlermeldung des Backends, wenn der Endpunkt nicht starten kann", async () => {
    invoke.mockRejectedValue("Lokaler Briefing-Endpunkt konnte nicht gestartet werden: Zugriff verweigert");
    await expect(Effect.runPromise(serveAttention("token"))).rejects.toThrow("Zugriff verweigert");
  });

  it("meldet einen fehlgeschlagenen Webhook als AttentionError", async () => {
    invoke.mockRejectedValue("Webhook nicht erreichbar");
    const error = await Effect.runPromise(triggerAttention("https://automation.test/hook", input, 49152)).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(AttentionError);
    expect(error).toMatchObject({ message: "Webhook nicht erreichbar" });
  });

  it("liest ein noch nicht vorhandenes Briefing", async () => {
    invoke.mockResolvedValue(null);
    expect(await Effect.runPromise(readAttention)).toBeNull();
  });
});
