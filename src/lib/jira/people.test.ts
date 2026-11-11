import { describe, expect, it } from "vitest";
import { MENTION_SUGGESTION_LIMIT, issueParticipants, rankMentionCandidates, toPeople, type JiraPerson } from "./people";

const avatar = { "48x48": "a.png" };
const person = (accountId: string, displayName: string, extra: Partial<JiraPerson> = {}): JiraPerson => ({
  accountId,
  displayName,
  avatarUrls: avatar,
  accountType: "atlassian",
  active: true,
  ...extra,
});
const candidate = (accountId: string, displayName: string) => ({ accountId, displayName, avatarUrls: avatar });

describe("Personen für Erwähnungen", () => {
  it("liest Personen tolerant und verwirft unlesbare Einträge", () => {
    expect(toPeople([person("a", "Anna"), { displayName: 3 }, null]).map((entry) => entry.accountId)).toEqual(["a"]);
  });

  it("nimmt Bearbeiter, Melder und Kommentarautoren neueste zuerst ohne Doppelte", () => {
    const fields = { assignee: person("a", "Anna"), reporter: person("b", "Ben") };
    const comments = [{ author: person("c", "Cleo") }, { author: person("a", "Anna") }, { author: person("d", "Dana") }];
    expect(issueParticipants(fields, comments).map((entry) => entry.accountId)).toEqual(["a", "b", "d", "c"]);
  });

  it("schlägt keine Apps, Kunden, unbekannte, deaktivierte oder kontolose Konten vor", () => {
    const fields = { assignee: person("app", "Bot", { accountType: "app" }), reporter: person("old", "Alt", { active: false }) };
    const comments = [
      { author: person("cus", "Kundin", { accountType: "customer" }) },
      { author: person("unk", "Unbekannt", { accountType: "unknown" }) },
      { author: { displayName: "Ohne Konto", avatarUrls: avatar } },
      { author: person("ok", "Okay") },
    ];
    expect(issueParticipants(fields, comments).map((entry) => entry.accountId)).toEqual(["ok"]);
  });

  it("zeigt bei leerer Abfrage nur Beteiligte", () => {
    expect(rankMentionCandidates("", [candidate("a", "Anna")], [person("x", "Xaver")]).map((entry) => entry.accountId)).toEqual(["a"]);
  });

  it("stellt passende Beteiligte vor Suchtreffer und entfernt Doppelte", () => {
    const participants = [candidate("a", "Anna Berg"), candidate("b", "Ben")];
    const found = [person("x", "Annika"), person("a", "Anna Berg"), person("bot", "Annabot", { accountType: "app" })];
    expect(rankMentionCandidates("  ANN ", participants, found).map((entry) => entry.accountId)).toEqual(["a", "x"]);
  });

  it("zeigt höchstens acht Vorschläge", () => {
    const found = Array.from({ length: 12 }, (_, index) => person(`u${index}`, `Nutzer ${index}`));
    expect(MENTION_SUGGESTION_LIMIT).toBe(8);
    expect(rankMentionCandidates("nutzer", [], found)).toHaveLength(8);
  });

  it("trägt keine E-Mail-Adresse in einen Vorschlag", () => {
    const [first] = issueParticipants({ assignee: { ...person("a", "Anna"), emailAddress: "anna@example.com" } }, []);
    expect(first).toEqual(candidate("a", "Anna"));
  });
});
