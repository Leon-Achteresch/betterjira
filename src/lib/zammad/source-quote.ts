import DOMPurify from "dompurify";
import type { Article } from "./model";

export const SOURCE_QUOTE_LIMIT = 2000;
const plainText = (value: string) =>
  value
    .replace(/\r\n?/g, "\n")
    .replace(
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,
      "",
    );
const blockTags = new Set([
  "P",
  "DIV",
  "BLOCKQUOTE",
  "PRE",
  "TABLE",
  "TR",
  "LI",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
]);

export function articleQuoteText(
  article: Pick<Article, "body" | "content_type">,
) {
  const type = (article.content_type ?? "text/plain")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (type === "text/plain") return plainText(article.body).trim();
  if (type !== "text/html") return null;
  const fragment = DOMPurify.sanitize(article.body, {
    RETURN_DOM_FRAGMENT: true,
    FORBID_TAGS: [
      "img",
      "style",
      "script",
      "form",
      "iframe",
      "video",
      "audio",
      "svg",
      "math",
      "object",
      "embed",
      "template",
    ],
  });
  fragment
    .querySelectorAll('[hidden], [aria-hidden="true"], [style]')
    .forEach((node) => {
      if (
        node.hasAttribute("hidden") ||
        node.getAttribute("aria-hidden") === "true" ||
        /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(
          node.getAttribute("style") ?? "",
        )
      )
        node.remove();
    });
  const read = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    const tag = node instanceof Element ? node.tagName : "";
    if (tag === "BR") return "\n";
    const text = Array.from(node.childNodes, read).join("");
    return tag === "TD" || tag === "TH"
      ? `${text}\t`
      : blockTags.has(tag)
        ? `\n${text}\n`
        : text;
  };
  return plainText(read(fragment))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function quoteSourceTime(raw: string) {
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:?\d{2})$/.exec(
      raw,
    );
  if (!match || !Number.isFinite(Date.parse(raw))) return null;
  const [hour, minute, second] = match[2].split(":").map(Number);
  if (hour > 23 || minute > 59 || second > 59) return null;
  const date = new Date(`${match[1]}T00:00:00Z`);
  if (date.toISOString().slice(0, 10) !== match[1]) return null;
  return raw;
}

export function sourceQuote(article: Article) {
  const text = articleQuoteText(article);
  if (!text) return null;
  const characters = Array.from(text);
  const clipped = characters.length > SOURCE_QUOTE_LIMIT;
  const excerpt = characters.slice(0, SOURCE_QUOTE_LIMIT).join("");
  const authorCharacters = Array.from(
    plainText(article.from ?? "")
      .replace(/\s+/g, " ")
      .trim(),
  );
  const author = authorCharacters.length
    ? `${authorCharacters.slice(0, 200).join("")}${authorCharacters.length > 200 ? "…" : ""}`
    : "Autor unbekannt";
  const time = quoteSourceTime(article.created_at) ?? "Quellzeit unbekannt";
  return {
    author,
    time,
    excerpt,
    clipped,
    block: [
      `Zitat von ${author} · ${time}`,
      ...excerpt.split("\n").map((line) => `> ${line}`),
      ...(clipped ? ["[Zitat auf 2.000 Zeichen gekürzt]"] : []),
    ].join("\n"),
  };
}

export const sourceFingerprint = (article: Article) =>
  JSON.stringify([
    article.id,
    article.ticket_id,
    article.body,
    article.content_type,
    article.from,
    article.created_at,
    article.internal,
  ]);

export function appendSourceQuote(
  body: string,
  sources: readonly number[],
  sourceId: number,
  block: string,
) {
  return sources.includes(sourceId)
    ? null
    : {
        body: body ? `${body}\n\n${block}\n\n` : `${block}\n\n`,
        quotedSources: [...sources, sourceId],
        kind: "internal",
        reply: null,
        recipient: null,
        cc: "",
      };
}
