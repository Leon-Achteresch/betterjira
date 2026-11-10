import { describe, expect, it } from "vitest";
import {
  attachmentHitsFromHtml,
  countedMediaNodes,
  createMediaMatchCache,
  hasMediaNodes,
  imageMediaSingle,
  isAdfNode,
  isImageAttachment,
  matchKnownMedia,
  matchMediaAttachments,
  mediaIdFromLocation,
  mediaIdIndex,
  pastedFileName,
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

describe("createMediaMatchCache", () => {
  it("behält beim Laden einer neuen Fassung die Zuordnung eines unveränderten Dokuments", () => {
    const resolve = createMediaMatchCache<(typeof files)[number]>();
    const node = media({ id: "u-1" });
    const description = doc(single({}, node));
    const ready = resolve(description, "ready", img("46884"), files);
    expect(ready.pending).toBe(false);
    expect(ready.matches.get(node)?.id).toBe("46884");
    const loading = resolve(description, "loading", undefined, files);
    expect(loading.pending).toBe(false);
    expect(loading.matches).toBe(ready.matches);
  });

  it("zeigt für ein geändertes Dokument den Ladezustand ohne Zuordnung", () => {
    const resolve = createMediaMatchCache<(typeof files)[number]>();
    const node = media({ id: "u-1" });
    resolve(doc(single({}, node)), "ready", img("46884"), files);
    const changed = doc(single({}, media({ id: "u-1" })));
    const loading = resolve(changed, "loading", undefined, files);
    expect(loading.pending).toBe(true);
    expect(loading.matches.size).toBe(0);
  });

  it("liefert bei einem Fehler keine Zuordnung, auch nicht die gemerkte", () => {
    const resolve = createMediaMatchCache<(typeof files)[number]>();
    const description = doc(single({}, media({ id: "u-1" })));
    resolve(description, "ready", img("46884"), files);
    const failed = resolve(description, "error", undefined, files);
    expect(failed).toEqual({ pending: false, matches: new Map() });
  });

  it("merkt nichts für ein fehlendes Dokument", () => {
    const resolve = createMediaMatchCache<(typeof files)[number]>();
    resolve(undefined, "ready", img("46884"), files);
    expect(resolve(undefined, "loading", undefined, files).pending).toBe(true);
  });
});

describe("Live-Formen", () => {
  const LIVE = "https://example.atlassian.net";
  const liveImg = (id: string, name: string, width: number) =>
    `<p><span class="image-wrap" style=""><img src="${LIVE}/rest/api/3/attachment/content/${id}" alt="${name}" width="${width}" style="border: 0px solid black" /></span></p>`;
  const liveNode = (id: string, extra: Record<string, unknown> = {}) => ({ type: "media", attrs: { id, type: "file", collection: "", ...extra } });
  const liveFile = (id: string, filename: string, mimeType: string) => ({ id, filename, mimeType });
  const FSI_472 =
    `<p><span class="nobr"><a href="/rest/api/3/attachment/content/46816" title="datei-1.xml attached to FSI-472" data-attachment-type="file" data-attachment-name="datei-1.xml" data-media-services-type="file" data-media-services-id="7a48faba-bcd8-40a6-990d-6376e29eb51c" rel="noreferrer">datei-1.xml<sup><img class="rendericon" src="/images/icons/link_attachment_7.gif" height="7" width="7" align="absmiddle" alt="" border="0"/></sup></a></span><br/>\n` +
    `<span class="nobr"><a href="/rest/api/3/attachment/content/46817" title="datei-2.xml attached to FSI-472" data-attachment-type="file" data-attachment-name="datei-2.xml" data-media-services-type="file" data-media-services-id="d2680320-9911-42c4-949b-41d025100839" rel="noreferrer">datei-2.xml<sup><img class="rendericon" src="/images/icons/link_attachment_7.gif" height="7" width="7" align="absmiddle" alt="" border="0"/></sup></a></span></p>`;
  const HELP_543 = `<p><a href="${LIVE}/secure/ViewProfile.jspa?accountId=000000000000000000000001" class="user-hover" rel="000000000000000000000001" data-account-id="000000000000000000000001" accountid="000000000000000000000001" rel="noreferrer">Person 1</a> Text</p>`;

  it("FSI-439 Beschreibung: ein img mit absolutem src ohne Media-ID, Zuordnung über die Reihenfolge", () => {
    const html = liveImg("44018", "datei-1.png", 1450);
    expect(attachmentHitsFromHtml(html, new Set(["44018"]))).toEqual([{ id: "44018" }]);
    const node = liveNode("803dbcdc-a0c5-4535-8cf7-996c71f49502", { width: 2037, height: 1040 });
    const matches = matchMediaAttachments(doc(single({ layout: "center" }, node)), html, [liveFile("44018", "datei-1.png", "image/png")]);
    expect(matches.get(node)?.id).toBe("44018");
  });

  it("HELP-522 Beschreibung: drei img in ADF-Reihenfolge, nicht nach ID sortiert", () => {
    const html = [liveImg("46883", "datei-1.png", 1261), "<p>…</p>", liveImg("46885", "datei-2.png", 1454), "<p>…</p>", liveImg("46884", "datei-3.png", 1454)].join("");
    expect(attachmentHitsFromHtml(html, new Set(["46883", "46884", "46885"]))).toEqual([{ id: "46883" }, { id: "46885" }, { id: "46884" }]);
    const first = liveNode("0d87d3d6-c365-4d37-9a07-d3d8ea48e4de", { width: 1261, height: 517 });
    const second = liveNode("5a516fae-14e8-4061-b798-52f43b98badd", { width: 2232, height: 1291 });
    const third = liveNode("583a042e-b150-4116-82fc-bdeb6dd2565e", { width: 2255, height: 1309 });
    const attachments = [liveFile("46883", "datei-1.png", "image/png"), liveFile("46884", "datei-3.png", "image/png"), liveFile("46885", "datei-2.png", "image/png")];
    const matches = matchMediaAttachments(doc(single({}, first), single({}, second), single({}, third)), html, attachments);
    expect([first, second, third].map((node) => matches.get(node)?.id)).toEqual(["46883", "46885", "46884"]);
  });

  it("FSI-472 Kommentar 65389: relative a-Links mit data-media-services-id, rendericon zählt nicht", () => {
    expect(attachmentHitsFromHtml(FSI_472, new Set(["46817", "46816"]))).toEqual([
      { id: "46816", mediaId: "7a48faba-bcd8-40a6-990d-6376e29eb51c" },
      { id: "46817", mediaId: "d2680320-9911-42c4-949b-41d025100839" },
    ]);
  });

  it("FSI-472 Kommentar 65389: Zuordnung über die Media-ID in ADF-Reihenfolge", () => {
    const first = liveNode("7a48faba-bcd8-40a6-990d-6376e29eb51c");
    const second = liveNode("d2680320-9911-42c4-949b-41d025100839");
    const attachments = [liveFile("46817", "datei-2.xml", "application/xml"), liveFile("46816", "datei-1.xml", "application/xml")];
    const matches = matchMediaAttachments(doc({ type: "mediaGroup", content: [first, second] }), FSI_472, attachments);
    expect(matches.get(first)?.id).toBe("46816");
    expect(matches.get(second)?.id).toBe("46817");
  });

  it("FSI-472 Kommentar 65389: die Media-ID schlägt eine abweichende Reihenfolge", () => {
    const first = liveNode("7a48faba-bcd8-40a6-990d-6376e29eb51c");
    const second = liveNode("d2680320-9911-42c4-949b-41d025100839");
    const attachments = [liveFile("46817", "datei-2.xml", "application/xml"), liveFile("46816", "datei-1.xml", "application/xml")];
    const matches = matchMediaAttachments(doc({ type: "mediaGroup", content: [second, first] }), FSI_472, attachments);
    expect(matches.get(second)?.id).toBe("46817");
    expect(matches.get(first)?.id).toBe("46816");
  });

  it("HELP-543 Kommentar 65827: Personen-Link unter /secure/ViewProfile.jspa trifft nicht", () => {
    expect(attachmentHitsFromHtml(HELP_543, new Set(["46943", "46944"]))).toEqual([]);
  });
});

describe("Medien im Editor", () => {
  const UUID = "803dbcdc-a0c5-4535-8cf7-996c71f49502";
  const shot = { id: "1", filename: "shot.png" };
  const other = { id: "2", filename: "other.png" };

  it("liest die Medien-Kennung aus dem Weiterleitungsziel des Anhangs", () => {
    expect(mediaIdFromLocation(`https://api.media.atlassian.com/file/${UUID}/binary?token=abc&name=shot.png`)).toBe(UUID);
    expect(mediaIdFromLocation(`https://api.media.atlassian.com/file/${UUID}`)).toBe(UUID);
    expect(mediaIdFromLocation("https://example.atlassian.net/secure/attachment/1/shot.png")).toBeUndefined();
    expect(mediaIdFromLocation(null)).toBeUndefined();
  });

  it("baut einen Bildknoten, den die Anzeige über den Dateinamen wiederfindet", () => {
    const node = imageMediaSingle(UUID, "shot.png", { width: 800, height: 400 });
    expect(node).toEqual({
      type: "mediaSingle",
      attrs: { layout: "align-start" },
      content: [{ type: "media", attrs: { id: UUID, type: "file", collection: "", alt: "shot.png", width: 800, height: 400 } }],
    });
    expect(matchMediaAttachments({ type: "doc", content: [node] }, "", [shot, other]).get(node.content![0]!)).toBe(shot);
  });

  it("ordnet Editor-Knoten über bekannte Kennungen zu, sonst über den eindeutigen Dateinamen", () => {
    const known = imageMediaSingle(UUID, "");
    const named = imageMediaSingle("unbekannt", "other.png");
    const lost = imageMediaSingle("unbekannt", "fehlt.png");
    const index = mediaIdIndex({ type: "doc", content: [known] }, new Map([[known.content![0]!, shot]]));
    expect(index.get(UUID)).toBe(shot);
    expect(matchKnownMedia(known, index, [shot, other]).get(known.content![0]!)).toBe(shot);
    expect(matchKnownMedia(named, index, [shot, other]).get(named.content![0]!)).toBe(other);
    expect(matchKnownMedia(named, index, [other, { ...other, id: "3" }]).size).toBe(0);
    expect(matchKnownMedia(lost, index, [shot, other]).size).toBe(0);
  });

  it("gibt eingefügten Bildern ohne eigenen Namen einen eindeutigen Namen", () => {
    const now = new Date(2026, 10, 10, 21, 5, 9);
    expect(pastedFileName("image.png", now)).toBe("image-20261110-210509.png");
    expect(pastedFileName("Skizze.png", now)).toBe("Skizze.png");
  });

  it("zählt Textlinks auf Anhänge nicht als eingebettete Medien", () => {
    const html = `<p><a href="${SITE}/rest/api/3/attachment/content/2" class="external-link" rel="nofollow noreferrer">other.png</a></p><p><img src="${SITE}/rest/api/3/attachment/content/1" alt="shot.png"></p>`;
    expect(attachmentHitsFromHtml(html, new Set(["1", "2"]))).toEqual([{ id: "1" }]);
  });
});
