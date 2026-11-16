import { Effect, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";

const { jira } = vi.hoisted(() => ({ jira: vi.fn() }));
vi.mock("./client", async (original) => ({ ...await original<typeof import("./client")>(), jira }));
const { wikiField } = await import("./issue");

const respond = (fields: unknown) => jira.mockImplementation((_path: string, schema: Schema.Decoder<unknown>) => Schema.decodeUnknownEffect(schema)({ fields }));

describe("rohes Wiki-Feld", () => {
  it.each([null, "", "h2. Titel\n!bild.png!\n{code}  a\n b{code}"])("bewahrt den ursprünglichen Wert %j getrennt vom Editorstring", async (raw) => {
    respond({ description: raw });
    expect(await Effect.runPromise(wikiField("DEMO-1", "description"))).toEqual({ raw, text: raw ?? "" });
  });

  it.each([{}, { description: 42 }, { description: { type: "doc" } }])("ersetzt fehlende oder falsche Rohwerte nicht durch Leertext: %j", async (fields) => {
    respond(fields);
    await expect(Effect.runPromise(wikiField("DEMO-1", "description"))).rejects.toMatchObject({ _tag: "JiraApiError", status: 502 });
  });
});
