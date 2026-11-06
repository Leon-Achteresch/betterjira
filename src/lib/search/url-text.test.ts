import { describe, expect, it } from "vitest";
import { initialUrlText, syncUrlText, typeUrlText } from "./url-text";

describe("url text", () => {
  it("übernimmt fremde URL-Änderungen wie Zurück", () => {
    const typed = typeUrlText(initialUrlText("alt"), "neu", "neu");
    expect(syncUrlText(syncUrlText(typed, "neu"), "alt")).toEqual(initialUrlText("alt"));
  });

  it("überschreibt beim Tippen nicht mit eigenen, älteren Schreibvorgängen", () => {
    let state = initialUrlText("");
    state = typeUrlText(state, "a", "a");
    state = typeUrlText(state, "ab", "ab");
    state = typeUrlText(state, "abc ", "abc");
    state = syncUrlText(state, "a");
    expect(state.text).toBe("abc ");
    state = syncUrlText(state, "abc");
    expect(state).toEqual({ text: "abc ", url: "abc", writes: [] });
  });

  it("merkt sich nichts, wenn die URL schon stimmt", () => {
    expect(typeUrlText(initialUrlText("a"), "a ", "a").writes).toEqual([]);
  });
});
