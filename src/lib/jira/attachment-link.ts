import type { AdfNode } from "./adf";

export const attachmentContentUrl = (siteUrl: string, id: string) => `${siteUrl}/rest/api/3/attachment/content/${id}`;

export const attachmentLinkNode = (filename: string, href: string): AdfNode => ({
  type: "text",
  text: filename,
  marks: [{ type: "link", attrs: { href } }],
});

export const fileMediaInline = (mediaId: string, alt: string): AdfNode => ({
  type: "mediaInline",
  attrs: { id: mediaId, type: "file", collection: "", alt },
});
