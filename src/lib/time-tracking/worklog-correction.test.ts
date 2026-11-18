import { describe, expect, it } from "vitest";
import { correctionText, exactWorklogTarget } from "./worklog-correction";

describe("Zeitbuchungskorrektur", () => {
  it("akzeptiert einen begrenzten exakten Jira-Schlüssel ohne URL, Suche oder ID", () => {
    expect(exactWorklogTarget(" de_mo2-91 ")).toBe("DE_MO2-91");
    for (const value of ["", "91", "DEMO", "DEMO-1 DEMO-2", "DEMO-1/extra", "https://team.test/browse/DEMO-1", `${"A".repeat(80)}-1`])
      expect(exactWorklogTarget(value)).toBeUndefined();
  });

  it("behält Klartext und textuelles ADF einschließlich Leerraum und Umbrüchen", () => {
    const plain = "  Erste Zeile\nZweite Zeile  ";
    expect(correctionText(plain)).toEqual({ kind: "text", text: plain });
    expect(correctionText({ type: "doc", version: 1, content: [
      { type: "paragraph", content: [{ type: "text", text: "  Alpha" }, { type: "hardBreak" }, { type: "text", text: "Beta " }] },
      { type: "paragraph" },
      { type: "paragraph", content: [{ type: "text", text: "Ende" }] },
    ] })).toEqual({ kind: "text", text: "  Alpha\nBeta \n\nEnde" });
    expect(correctionText(null)).toEqual({ kind: "empty" });
  });

  it("kennzeichnet unbekannte oder formatierte Inhalte ohne Text- oder Linkübernahme", () => {
    for (const inline of [
      { type: "inlineCard", attrs: { url: "https://synthetic.invalid" } },
      { type: "text", text: "Link", marks: [{ type: "link", attrs: { href: "https://synthetic.invalid" } }] },
      { type: "hardBreak", attrs: { future: true } },
      { type: "text" },
    ]) expect(correctionText({ type: "doc", version: 1, content: [{ type: "paragraph", content: [inline] }] })).toEqual({ kind: "unsupported" });
    expect(correctionText({ type: "doc", version: 1, content: "unexpected" })).toEqual({ kind: "unsupported" });
  });
});
