import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { Article } from "./model";
import {
  appendSourceCc,
  findSourceCcArticle,
  sourceCcAddresses,
  sourceCcIdentity,
} from "./source-cc";

const source = {
  id: 11,
  ticket_id: 41,
  type: "email",
  sender: "Customer",
  subject: "synthetisch",
  body: "hidden@example.test",
  from: "Sam <sam@example.test>",
  to: "support@example.test",
  internal: false,
  created_at: "2026-11-18T10:00:00Z",
};

describe("Zammad-Quellmail-CC", () => {
  it("liest gültige Komma-Mailboxen und dedupliziert ohne Beachtung der Großschreibung", () => {
    expect(
      sourceCcAddresses(
        String.raw`"Muster, \"A\"" <First@Example.test>, first@example.test, ungültig, valid+1@example.test, a..b@example.test, bad@-domain.test`,
      ),
    ).toEqual(["first@example.test", "valid+1@example.test"]);
  });

  it.each([
    undefined,
    null,
    [],
    { cc: "valid@example.test" },
    ["valid@example.test"],
    "",
    "-",
    "bad, not an address",
    "Gruppe: valid@example.test, other@example.test;",
    "bad <one@example.test, two@example.test, invalid>",
    "valid@example.test\r\nBcc: bad@example.test",
    '"offen, valid@example.test',
  ])("übernimmt keinen Empfänger aus %j", (cc) => {
    const article = Schema.decodeUnknownSync(Article)({ ...source, cc });
    expect(sourceCcAddresses(article.cc)).toEqual([]);
  });

  it("hängt nur neue Adressen an und erhält die Eingabe bytegenau", () => {
    const current = '"Team, Nord" <TEAM@example.test>,  Second@example.test  ';
    expect(
      appendSourceCc(current, "primary@example.test", [
        "team@example.test",
        "second@example.test",
        "primary@example.test",
        "added@example.test",
      ]),
    ).toBe(`${current}, added@example.test`);
    expect(
      appendSourceCc("TEAM@example.test, ", null, ["other@example.test"]),
    ).toBe("TEAM@example.test, other@example.test");
    expect(appendSourceCc(current, null, ["team@example.test"])).toBe(current);
    expect(
      appendSourceCc("Halbfertige Adresse <", null, ["other@example.test"]),
    ).toBeNull();
  });

  it("bindet eine eindeutige öffentliche E-Mail an Ticket, Artikel und Mailidentität", () => {
    const identity = sourceCcIdentity(source, 41);
    expect(identity).toBeTruthy();
    for (const other of [
      { ...source, internal: true },
      { ...source, type: "web" },
      { ...source, sender: "System" },
      { ...source, ticket_id: 42 },
      { ...source, sender: undefined },
      { ...source, id: -1 },
    ])
      expect(sourceCcIdentity(other, 41)).toBeNull();
    if (!identity) throw new Error("Quellidentität fehlt");
    expect(findSourceCcArticle([source], 41, 11, identity)).toBe(source);
    expect(
      findSourceCcArticle([source, source], 41, 11, identity),
    ).toBeUndefined();
    expect(
      findSourceCcArticle(
        [{ ...source, message_id: "other@example.test" }],
        41,
        11,
        identity,
      ),
    ).toBeUndefined();
  });
});
