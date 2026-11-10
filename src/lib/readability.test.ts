import { describe, expect, it } from "vitest";
import { parseReadabilityPrefs, textSizeScale } from "./readability";

describe("parseReadabilityPrefs", () => {
  it("übernimmt gültige Textgrößen", () => {
    expect(parseReadabilityPrefs({ textSize: "large" })).toEqual({ textSize: "large" });
    expect(parseReadabilityPrefs({ textSize: "x-large", extra: 1 })).toEqual({ textSize: "x-large" });
  });

  it("fällt bei unbekannten Werten auf Standard zurück", () => {
    for (const value of [undefined, null, "large", 42, {}, { textSize: "huge" }, { textSize: 1.5 }]) {
      expect(parseReadabilityPrefs(value)).toEqual({ textSize: "standard" });
    }
  });
});

describe("textSizeScale", () => {
  it("lässt Standard unverändert und steigt monoton", () => {
    expect(textSizeScale("standard")).toBe(1);
    expect(textSizeScale("large")).toBeGreaterThan(1);
    expect(textSizeScale("x-large")).toBeGreaterThan(textSizeScale("large"));
  });
});
