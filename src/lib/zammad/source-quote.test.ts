import { describe, expect, it } from "vitest";
import {
  appendSourceQuote,
  articleQuoteText,
  quoteSourceTime,
  sourceFingerprint,
  sourceQuote,
  SOURCE_QUOTE_LIMIT,
} from "./source-quote";
import type { Article } from "./model";

const article: Article = {
  id: 11,
  ticket_id: 41,
  body: "Erste Aussage.\nZweite Aussage.",
  content_type: "text/plain",
  internal: false,
  from: "Sam Kunde <sam@example.com>",
  created_at: "2026-11-09T10:00:00+01:00",
};

describe("internal source quote", () => {
  it("bounds author metadata without splitting Unicode characters or inserting extra attribution lines", () => {
    const quote = sourceQuote({
      ...article,
      from: `Sam\r\n\u202e${"😀".repeat(220)}`,
    })!;
    expect(quote.author).not.toContain("\n");
    expect(quote.author).not.toContain("\u202e");
    expect(Array.from(quote.author)).toHaveLength(201);
    expect(quote.author.endsWith("😀…")).toBe(true);
  });
  it("quotes evidenced author and original offset, with source IDs outside customer text", () => {
    const quote = sourceQuote(article)!;
    expect(quote.block).toBe(
      "Zitat von Sam Kunde <sam@example.com> · 2026-11-09T10:00:00+01:00\n> Erste Aussage.\n> Zweite Aussage.",
    );
    expect(quote).toMatchObject({ clipped: false, excerpt: article.body });
  });
  it("does not attribute guessed roles or an inferred creation time", () => {
    expect(
      sourceQuote({
        ...article,
        from: " \n",
        created_at: "not-a-date",
        created_by_id: 3,
      }),
    ).toMatchObject({ author: "Autor unbekannt", time: "Quellzeit unbekannt" });
  });
  it.each([
    "",
    "2026-02-30T09:00:00Z",
    "2026-11-09T24:00:00Z",
    "2026-11-09T09:00:00",
    "yesterday",
  ])("does not infer a timezone or repair invalid time %s", (time) =>
    expect(quoteSourceTime(time)).toBeNull(),
  );
  it.each([
    "2026-11-09T09:00:00Z",
    "2026-11-09T10:00:00.123+0100",
    "2026-11-09T03:30:00-05:30",
  ])("retains original source time %s", (time) =>
    expect(quoteSourceTime(time)).toBe(time),
  );
  it("limits by Unicode characters without cutting a surrogate pair and says it clipped", () => {
    const quote = sourceQuote({
      ...article,
      body: "😀".repeat(SOURCE_QUOTE_LIMIT + 1),
    })!;
    expect(Array.from(quote.excerpt)).toHaveLength(SOURCE_QUOTE_LIMIT);
    expect(quote.excerpt.endsWith("😀")).toBe(true);
    expect(quote.block).toContain("[Zitat auf 2.000 Zeichen gekürzt]");
  });
  it("treats plain text literally, removes directional/control characters, and rejects unsupported rich formats", () => {
    expect(
      articleQuoteText({
        body: " <b>Text</b>\r\n\u202eA\u0000 ",
        content_type: "text/plain; charset=utf-8",
      }),
    ).toBe("<b>Text</b>\nA");
    expect(
      sourceQuote({
        ...article,
        body: '{"type":"doc"}',
        content_type: "application/json",
      }),
    ).toBeNull();
    expect(sourceQuote({ ...article, body: "  " })).toBeNull();
  });
  it("appends to the latest draft exactly once and forces internal note fields", () => {
    const first = appendSourceQuote("Meine neueste Eingabe", [], 11, "Zitat")!;
    expect(first).toEqual({
      body: "Meine neueste Eingabe\n\nZitat\n\n",
      quotedSources: [11],
      kind: "internal",
      reply: null,
      recipient: null,
      cc: "",
    });
    expect(
      appendSourceQuote(first.body, first.quotedSources, 11, "Zitat"),
    ).toBeNull();
    const second = appendSourceQuote(
      `${first.body}Neue Antwort`,
      first.quotedSources,
      12,
      "Noch ein Zitat",
    )!;
    expect(second.body).toBe(`${first.body}Neue Antwort\n\nNoch ein Zitat\n\n`);
  });
  it("invalidates source identity on a content, author, time, visibility or ticket change", () => {
    for (const patch of [
      { body: "neu" },
      { from: "Anderer Autor" },
      { created_at: "" },
      { internal: true },
      { ticket_id: 42 },
    ])
      expect(sourceFingerprint({ ...article, ...patch })).not.toBe(
        sourceFingerprint(article),
      );
  });
});
