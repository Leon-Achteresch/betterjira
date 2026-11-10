import { describe, expect, it } from "vitest";
import {
  attachmentHitsFromHtml,
  countedMediaNodes,
  hasMediaNodes,
  isAdfNode,
  isImageAttachment,
  matchMediaAttachments,
  mediaSingleBox,
  mediaThumbnailBox,
  needsRenderedFields,
} from "./adf-media";

const SITE = "https://example.atlassian.net";
const img = (id: string, name = "x.png") => `<img src="${SITE}/rest/api/3/attachment/content/${id}" alt="${name}" width="760">`;
const known = new Set(["46883", "46884", "46885", "46886"]);
const ids = (html: string) => attachmentHitsFromHtml(html, known).map((hit) => hit.id);
const media = (attrs: Record<string, unknown>) => ({ type: "media", attrs: { type: "file", id: "uuid", collection: "", ...attrs } });
const single = (attrs: Record<string, unknown>, child: unknown) => ({ type: "mediaSingle", attrs, content: [child] });
const doc = (...content: unknown[]) => ({ type: "doc", version: 1, content });
const plain = doc({ type: "paragraph", content: [{ type: "text", text: "x" }] });
const files = [
  { id: "46883", filename: "a.png", mimeType: "image/png" },
  { id: "46884", filename: "b.png", mimeType: "image/png" },
  { id: "46885", filename: "c.png", mimeType: "image/png" },
  { id: "46886", filename: "Angebot.pdf", mimeType: "application/pdf" },
];

describe("attachmentHitsFromHtml", () => {
  it("liest IDs in Dokumentreihenfolge wie bei HELP-522, nicht sortiert", () => {
    expect(ids(`<p>${img("46883", "a.png")}</p><p>${img("46885", "c.png")}</p><p>${img("46884", "b.png")}</p>`)).toEqual(["46883", "46885", "46884"]);
  });
  it("erkennt beide Pfadformen in a und img", () => {
    expect(ids(`<a href="${SITE}/secure/attachment/46886/Angebot.pdf">Angebot</a><img src='/rest/api/3/attachment/content/46883'>`)).toEqual(["46886", "46883"]);
  });
  it("trifft absolute und relative Pfade, aber keine Anhangspfade mitten in fremden URLs", () => {
    const html = `<a href="/rest/api/3/attachment/content/46883">a</a><img src="/secure/attachment/46884/b.png"><img src="https://example.com/proxy?u=/rest/api/3/attachment/content/46885"><img src="${SITE}/rest/api/3/attachment/content/46886?redirect=false">`;
    expect(ids(html)).toEqual(["46883", "46884", "46886"]);
  });
  it("zählt ein a mit eingeschlossenem img derselben ID einmal", () => {
    expect(ids(`<a href="${SITE}/secure/attachment/46885/c.png">${img("46885")}</a>${img("46885")}`)).toEqual(["46885", "46885"]);
  });
  it("zählt a und img mit verschiedenen IDs getrennt", () => {
    expect(ids(`<a href="${SITE}/secure/attachment/46886/x">${img("46883")}</a>`)).toEqual(["46886", "46883"]);
  });
  it("liest data-media-services-id je Treffer und überspringt das rendericon", () => {
    const html = `<a href="/rest/api/3/attachment/content/46886" data-media-services-type="file" data-media-services-id="uuid-1">Angebot.pdf<sup><img class="rendericon" src="/images/icons/link_attachment_7.gif" alt=""></sup></a>${img("46883")}`;
    expect(attachmentHitsFromHtml(html, known)).toEqual([{ id: "46886", mediaId: "uuid-1" }, { id: "46883" }]);
  });
  it("ignoriert fremde IDs, externe URLs, data-src, abbr und Skript-Attribute", () => {
    const html = `${img("99999")}<img src="https://example.com/bild.png" onerror="alert(1)"><img data-src="/rest/api/3/attachment/content/46883"><abbr href="/secure/attachment/46884/x">x</abbr><script>window.x=1</script>`;
    expect(attachmentHitsFromHtml(html, known)).toEqual([]);
  });
});

describe("Media-Knoten", () => {
  it("erkennt ADF-Knoten an einem type-Text", () => {
    expect(isAdfNode({ type: "doc" })).toBe(true);
    expect(isAdfNode({ text: "x" })).toBe(false);
    expect(isAdfNode(null)).toBe(false);
  });
  it("zählt file-media und mediaInline, aber keine externen", () => {
    const value = doc(
      single({}, media({})),
      single({}, { type: "media", attrs: { type: "external", url: "https://example.com/x.png" } }),
      { type: "paragraph", content: [{ type: "mediaInline", attrs: { id: "i", type: "file" } }] },
    );
    expect(countedMediaNodes(value)).toHaveLength(2);
    expect(hasMediaNodes(value)).toBe(true);
  });
  it("erkennt Dokumente ohne Media", () => {
    expect(hasMediaNodes(plain)).toBe(false);
    expect(hasMediaNodes(null)).toBe(false);
  });
  it("braucht die gerenderte Fassung bei Media in Beschreibung oder eingebettetem Kommentar", () => {
    const withMedia = doc(single({}, media({})));
    expect(needsRenderedFields(withMedia, [])).toBe(true);
    expect(needsRenderedFields(plain, [{ body: withMedia }])).toBe(true);
    expect(needsRenderedFields(plain, [{ body: plain }])).toBe(false);
    expect(needsRenderedFields(null, [])).toBe(false);
  });
});

describe("matchMediaAttachments", () => {
  it("ordnet bei gleicher Zahl paarweise in Dokumentreihenfolge zu", () => {
    const first = media({});
    const second = media({});
    const inline = { type: "mediaInline", attrs: { type: "file" } };
    const html = `${img("46884")}${img("46883")}<a href="/secure/attachment/46886/Angebot.pdf">Angebot</a>`;
    const matches = matchMediaAttachments(doc(single({}, first), single({}, second), { type: "paragraph", content: [inline] }), html, files);
    expect(matches.get(first)?.id).toBe("46884");
    expect(matches.get(second)?.id).toBe("46883");
    expect(matches.get(inline)?.id).toBe("46886");
  });
  it("ordnet zuerst über data-media-services-id zu und die übrigen in Reihenfolge", () => {
    const a = media({ id: "uuid-1" });
    const b = media({ id: "uuid-2" });
    const c = media({ id: "uuid-3" });
    const html = `<a href="/rest/api/3/attachment/content/46884" data-media-services-id="uuid-3">b</a>${img("46883")}${img("46885")}`;
    const matches = matchMediaAttachments(doc(single({}, a), single({}, b), single({}, c)), html, files);
    expect(matches.get(c)?.id).toBe("46884");
    expect(matches.get(a)?.id).toBe("46883");
    expect(matches.get(b)?.id).toBe("46885");
  });
  it("fällt nach der Media-ID bei abweichender Zahl auf den Dateinamen zurück", () => {
    const byUuid = media({ id: "uuid-1" });
    const named = media({ id: "uuid-2", alt: "Angebot.pdf" });
    const unnamed = media({ id: "uuid-3" });
    const html = `<a href="/rest/api/3/attachment/content/46883" data-media-services-id="uuid-1">a</a>${img("46884")}`;
    const matches = matchMediaAttachments(doc(single({}, byUuid), single({}, named), single({}, unnamed)), html, files);
    expect(matches.get(byUuid)?.id).toBe("46883");
    expect(matches.get(named)?.id).toBe("46886");
    expect(matches.has(unnamed)).toBe(false);
  });
  it("ordnet bei abweichender Zahl nur über einen eindeutigen Dateinamen zu", () => {
    const named = media({ alt: "Angebot.pdf" });
    const unnamed = media({});
    const matches = matchMediaAttachments(doc(single({}, named), single({}, unnamed)), img("46883"), files);
    expect(matches.get(named)?.id).toBe("46886");
    expect(matches.has(unnamed)).toBe(false);
  });
  it("ordnet bei mehrdeutigem Dateinamen nicht zu", () => {
    const node = media({ alt: "a.png" });
    const twins = [...files, { id: "46890", filename: "a.png", mimeType: "image/png" }];
    expect(matchMediaAttachments(doc(single({}, node), single({}, media({}))), "", twins).has(node)).toBe(false);
  });
  it("lässt ohne Treffer alles unzugeordnet", () => {
    expect(matchMediaAttachments(doc(single({}, media({}))), "<p>leer</p>", files).size).toBe(0);
  });
});

describe("Maße", () => {
  it("nimmt die Pixelbreite aus mediaSingle", () => {
    expect(mediaSingleBox({ width: 480, widthType: "pixel" }, { width: 1200, height: 600 })).toEqual({ width: "480px", aspectRatio: "1200 / 600", height: undefined });
  });
  it("liest die Breite ohne widthType als Prozent der Spalte", () => {
    expect(mediaSingleBox({ width: 50 }, { width: 800, height: 400 }).width).toBe("50%");
  });
  it("fällt auf media.attrs.width zurück", () => {
    expect(mediaSingleBox({ layout: "center" }, { width: 640, height: 320 }).width).toBe("640px");
  });
  it("reserviert ohne Maße 12rem Höhe", () => {
    expect(mediaSingleBox(undefined, {})).toEqual({ width: undefined, aspectRatio: undefined, height: "12rem" });
  });
  it("gibt Vorschaubildern 8rem Höhe im Seitenverhältnis", () => {
    expect(mediaThumbnailBox({ width: 300, height: 200 })).toEqual({ height: "8rem", aspectRatio: "300 / 200", width: undefined });
    expect(mediaThumbnailBox({})).toEqual({ height: "8rem", aspectRatio: undefined, width: "8rem" });
  });
  it("erkennt Bilder am MIME-Typ", () => {
    expect(isImageAttachment({ mimeType: "image/png" })).toBe(true);
    expect(isImageAttachment({ mimeType: "application/pdf" })).toBe(false);
  });
});
