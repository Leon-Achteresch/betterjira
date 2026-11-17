import { describe, expect, it } from "vitest";
import fixture from "../../tests/jira/fixtures/description-conflict.json";
import { adoptableDescription, descriptionBasis, sameDescription } from "./description-comparison";

describe("originalgetreuer Beschreibungsvergleich", () => {
  it("ignoriert Objektschlüsselreihenfolge, erhält Rohwerte und verändert nichts", () => {
    const before = JSON.stringify(fixture.base);
    const reversed = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(reversed);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reversed(child)]));
      return value;
    };
    const basis = descriptionBasis("adf", fixture.base)!;
    expect(sameDescription(basis, descriptionBasis("adf", reversed(fixture.base))!)).toBe(true);
    expect(basis.value).toBe(fixture.base);
    expect(JSON.stringify(fixture.base)).toBe(before);
  });

  it("beachtet Knotenreihenfolge sowie Medien-, Mention- und Tabellenattribute", () => {
    const base = descriptionBasis("adf", fixture.base)!;
    const variants = [
      { ...fixture.base, content: [...fixture.base.content].reverse() },
      JSON.parse(JSON.stringify(fixture.base).replace("media-1", "media-2")),
      JSON.parse(JSON.stringify(fixture.base).replace("account-a", "account-b")),
      JSON.parse(JSON.stringify(fixture.base).replace('"colspan":1', '"colspan":2')),
    ];
    for (const value of variants) expect(sameDescription(base, descriptionBasis("adf", value)!)).toBe(false);
  });

  it("vergleicht Wiki exakt einschließlich Leerraum, Zeilenumbrüchen und Syntax", () => {
    const base = descriptionBasis("wiki", fixture.wiki.base)!;
    expect(sameDescription(base, descriptionBasis("wiki", fixture.wiki.base)!)).toBe(true);
    for (const value of [fixture.wiki.remote, `${fixture.wiki.base}\n`, fixture.wiki.base.replace("||", "|")]) {
      expect(sameDescription(base, descriptionBasis("wiki", value)!)).toBe(false);
    }
  });

  it("setzt null, leeren Text und leeres ADF nicht gleich und trennt Repräsentationen", () => {
    expect(sameDescription(descriptionBasis("wiki", null)!, descriptionBasis("wiki", "")!)).toBe(false);
    expect(sameDescription(descriptionBasis("adf", null)!, descriptionBasis("adf", { type: "doc", version: 1, content: [] })!)).toBe(false);
    expect(sameDescription(descriptionBasis("wiki", "Text")!, descriptionBasis("text", "Text")!)).toBe(false);
  });

  it("erfindet bei fehlenden, nicht vergleichbaren oder ungültigen Rohwerten keine Basis", () => {
    for (const value of [undefined, 42, "gerenderter Text", { type: "paragraph" }, { type: "doc", attrs: { bad: undefined } }]) {
      expect(descriptionBasis("adf", value)).toBeUndefined();
    }
    expect(descriptionBasis("wiki", fixture.base)).toBeUndefined();
  });
});

describe("bewusste lokale Übernahme der Jira-Fassung", () => {
  it("übernimmt Wiki-Rohtext und ADF-Struktur exakt, null-Wiki als leeren Text", () => {
    const wiki = "h1. Titel\n\n  eingerückt  ";
    expect(adoptableDescription({ version: 1, format: "wiki", value: wiki })).toBe(wiki);
    expect(adoptableDescription({ version: 1, format: "wiki", value: null })).toBe("");
    const adf = descriptionBasis("adf", fixture.remote)!;
    expect(JSON.parse(adoptableDescription(adf)!)).toEqual(fixture.remote);
  });

  it("bietet leere oder nicht editierbare ADF-Fassungen nicht zur Übernahme an", () => {
    expect(adoptableDescription({ version: 1, format: "adf", value: null })).toBeUndefined();
    expect(adoptableDescription({ version: 1, format: "adf", value: { type: "doc", version: 1, content: [{ type: "text", text: "lose" }] } })).toBeUndefined();
  });
});
