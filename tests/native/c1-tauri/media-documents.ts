import type { AdfNode } from "../../../src/lib/jira/adf";
import descriptionWithMedia from "../../jira/fixtures/description-adf-media.json";

const paragraph = (text: string): AdfNode => ({ type: "paragraph", content: [{ type: "text", text }] });

const remote = descriptionWithMedia satisfies AdfNode;
const revised = {
  ...remote,
  content: remote.content.map((node) => node.type === "extension"
    ? { ...node, attrs: { ...node.attrs, revision: "R2" } }
    : node),
};
const withIntroduction = (text: string) => ({
  ...revised,
  content: [{ ...paragraph(text), attrs: revised.content[0]!.attrs }, ...revised.content.slice(1)],
});

export const mediaDocuments = {
  initial: { type: "doc", version: 1, content: [paragraph("C1 Medien-Ausgangsfassung")] },
  remote,
  revised,
  newerText: withIntroduction("Jira-Frischer Servertext"),
  beforeLogout: withIntroduction("Jira-Fassung vor Abmeldung"),
};

export const expectedMediaWrite = {
  ...revised,
  content: [...revised.content.slice(0, -1), paragraph("Jira-Schluss ergänzt")],
};
