import { describe, expect, it } from "vitest";
import type { AdfNode } from "./adf";
import { matchKnownMedia } from "./adf-media";
import { fileMediaInline } from "./attachment-link";
import { isPendingMediaId, pendingMediaId, pendingMediaIds, replacePendingMedia } from "./pending-media";

const local = pendingMediaId();
const other = pendingMediaId();
const media = (id: string): AdfNode => ({ type: "mediaSingle", content: [{ type: "media", attrs: { id, type: "file", collection: "", alt: "bild.png" } }] });
const body: AdfNode = {
  type: "doc",
  version: 1,
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Siehe " }, fileMediaInline(local, "Angebot.pdf"), fileMediaInline("uuid-fest", "alt.pdf")] },
    media(other),
    media(local),
  ],
};

describe("noch nicht hochgeladene Medien", () => {
  it("erkennt lokale Kennungen und findet sie einmalig in beliebig verschachtelten Eingaben", () => {
    expect(isPendingMediaId(local)).toBe(true);
    expect(isPendingMediaId("uuid-fest")).toBe(false);
    expect(pendingMediaIds({ id: "c-1", payload: { body } })).toEqual([local, other]);
    expect(pendingMediaIds({ fields: { description: null, summary: local } })).toEqual([]);
  });

  it("ersetzt nur lokale Medienknoten und lässt den Rest unverändert", () => {
    const sent = replacePendingMedia({ transition: { id: "21" }, update: { comment: [{ add: { body } }] } }, (node, id) =>
      node.type === "media" ? { ...node, attrs: { ...node.attrs, id: `echt-${id === local ? 1 : 2}` } } : { type: "text", text: "Angebot.pdf" },
    ) as { transition: { id: string }; update: { comment: [{ add: { body: AdfNode } }] } };

    expect(sent.transition).toEqual({ id: "21" });
    const [paragraph, first, second] = sent.update.comment[0].add.body.content ?? [];
    expect(paragraph?.content).toEqual([{ type: "text", text: "Siehe " }, { type: "text", text: "Angebot.pdf" }, fileMediaInline("uuid-fest", "alt.pdf")]);
    expect(first?.content?.[0]?.attrs?.id).toBe("echt-2");
    expect(second?.content?.[0]?.attrs?.id).toBe("echt-1");
    expect(pendingMediaIds(sent)).toEqual([]);
    expect(pendingMediaIds(body)).toEqual([local, other]);
  });

  it("ordnet einen lokalen Knoten ohne gehaltene Datei keinem gleichnamigen Anhang zu", () => {
    const attachment = { id: "46886", filename: "Angebot.pdf" };
    const node = fileMediaInline(local, "Angebot.pdf");
    expect(matchKnownMedia(node, new Map(), [attachment]).size).toBe(0);
    expect(matchKnownMedia(fileMediaInline("unbekannt", "Angebot.pdf"), new Map(), [attachment]).size).toBe(1);
  });
});
