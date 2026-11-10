import type { AdfNode } from "./adf";

export type MediaAttachment = { id: string; filename: string };
export type AttachmentHit = { id: string; mediaId?: string };
export type MediaBox = { width?: string; aspectRatio?: string; height?: string };

export const MEDIA_FALLBACK_HEIGHT = "12rem";
export const MEDIA_THUMBNAIL_HEIGHT = "8rem";

const ATTACHMENT_PATH = /^(?:https?:\/\/[^/?#]+)?\/(?:rest\/api\/3\/attachment\/content\/(\d+)(?=[/?#]|$)|secure\/attachment\/(\d+)\/)/;
const TAG = /<(\/?)(a|img)\b([^>]*)>/gi;

const attribute = (attrs: string, name: string) =>
  new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")
    .exec(attrs)
    ?.slice(1)
    .find((value) => value !== undefined);

const idOf = (url: string | undefined) => {
  const match = url ? ATTACHMENT_PATH.exec(url) : null;
  return match ? (match[1] ?? match[2]) : undefined;
};

export const attachmentHitsFromHtml = (html: string, known: ReadonlySet<string>): AttachmentHit[] => {
  const hits: AttachmentHit[] = [];
  let anchor: AttachmentHit | undefined;
  for (const [, closing, tag = "", attrs = ""] of html.matchAll(TAG)) {
    const isAnchor = tag.toLowerCase() === "a";
    if (closing) {
      if (isAnchor) anchor = undefined;
      continue;
    }
    if (isAnchor) anchor = undefined;
    if (isAnchor && /\bexternal-link\b/.test(attribute(attrs, "class") ?? "")) continue;
    const id = idOf(attribute(attrs, isAnchor ? "href" : "src"));
    if (!id || !known.has(id)) continue;
    if (!isAnchor && anchor?.id === id) continue;
    const mediaId = attribute(attrs, "data-media-services-id");
    const hit: AttachmentHit = mediaId ? { id, mediaId } : { id };
    hits.push(hit);
    if (isAnchor) anchor = hit;
  }
  return hits;
};

export const isAdfNode = (value: unknown): value is AdfNode =>
  typeof value === "object" && value !== null && typeof (value as AdfNode).type === "string";

const walk = (value: unknown, visit: (node: AdfNode) => void) => {
  if (!isAdfNode(value)) return;
  visit(value);
  if (Array.isArray(value.content)) for (const child of value.content) walk(child, visit);
};

export const hasMediaNodes = (doc: unknown) => {
  let found = false;
  walk(doc, (node) => {
    if (node.type === "media" || node.type === "mediaInline") found = true;
  });
  return found;
};

export const countedMediaNodes = (doc: unknown): AdfNode[] => {
  const nodes: AdfNode[] = [];
  walk(doc, (node) => {
    if ((node.type === "media" && node.attrs?.type === "file") || node.type === "mediaInline") nodes.push(node);
  });
  return nodes;
};

export const needsRenderedFields = (description: unknown, comments: readonly { body: unknown }[]) =>
  hasMediaNodes(description) || comments.some((comment) => hasMediaNodes(comment.body));

export const mediaAltText = (node: AdfNode) => {
  const alt = node.attrs?.alt;
  return typeof alt === "string" && alt.trim() ? alt : undefined;
};

export const matchMediaAttachments = <A extends MediaAttachment>(doc: unknown, html: string, attachments: readonly A[]) => {
  const byId = new Map(attachments.map((attachment) => [attachment.id, attachment] as const));
  const hits = attachmentHitsFromHtml(html, new Set(byId.keys()));
  const matches = new Map<object, A>();
  const used = new Set<AttachmentHit>();
  const rest: AdfNode[] = [];
  for (const node of countedMediaNodes(doc)) {
    const uuid = node.attrs?.id;
    const hit = typeof uuid === "string" && uuid !== "" ? hits.find((entry) => entry.mediaId === uuid && !used.has(entry)) : undefined;
    const attachment = hit ? byId.get(hit.id) : undefined;
    if (hit && attachment) {
      used.add(hit);
      matches.set(node, attachment);
      continue;
    }
    rest.push(node);
  }
  const remaining = hits.filter((hit) => !used.has(hit));
  if (remaining.length === rest.length) {
    rest.forEach((node, index) => {
      const attachment = byId.get(remaining[index]?.id ?? "");
      if (attachment) matches.set(node, attachment);
    });
    return matches;
  }
  for (const node of rest) {
    const alt = mediaAltText(node);
    const named = alt === undefined ? [] : attachments.filter((attachment) => attachment.filename === alt);
    const [only] = named;
    if (named.length === 1 && only) matches.set(node, only);
  }
  return matches;
};

const positive = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined);

const ratioOf = (media: Record<string, unknown> | undefined) => {
  const width = positive(media?.width);
  const height = positive(media?.height);
  return width && height ? `${width} / ${height}` : undefined;
};

export const mediaSingleBox = (single?: Record<string, unknown>, media?: Record<string, unknown>): MediaBox => {
  const singleWidth = positive(single?.width);
  const mediaWidth = positive(media?.width);
  const width = singleWidth !== undefined
    ? single?.widthType === "pixel" ? `${singleWidth}px` : `${Math.min(singleWidth, 100)}%`
    : mediaWidth !== undefined ? `${mediaWidth}px` : undefined;
  const aspectRatio = ratioOf(media);
  return { width, aspectRatio, height: aspectRatio ? undefined : MEDIA_FALLBACK_HEIGHT };
};

export const mediaThumbnailBox = (media?: Record<string, unknown>): MediaBox => {
  const aspectRatio = ratioOf(media);
  return { height: MEDIA_THUMBNAIL_HEIGHT, aspectRatio, width: aspectRatio ? undefined : MEDIA_THUMBNAIL_HEIGHT };
};

export const isImageAttachment = (attachment: { mimeType: string }) => attachment.mimeType.startsWith("image/");

export const mediaIdIndex = <A>(doc: unknown, matches: ReadonlyMap<object, A>) => {
  const index = new Map<string, A>();
  for (const node of countedMediaNodes(doc)) {
    const id = node.attrs?.id;
    const attachment = matches.get(node);
    if (typeof id === "string" && id !== "" && attachment) index.set(id, attachment);
  }
  return index;
};

export const matchKnownMedia = <A extends MediaAttachment>(node: unknown, known: ReadonlyMap<string, A>, attachments: readonly A[]) => {
  const matches = new Map<object, A>();
  for (const media of countedMediaNodes(node)) {
    const id = media.attrs?.id;
    const alt = mediaAltText(media);
    const named = alt === undefined ? [] : attachments.filter((attachment) => attachment.filename === alt);
    const attachment = (typeof id === "string" ? known.get(id) : undefined) ?? (named.length === 1 ? named[0] : undefined);
    if (attachment) matches.set(media, attachment);
  }
  return matches;
};

const MEDIA_FILE_ID = /\/file\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})(?=[/?#]|$)/i;

export const mediaIdFromLocation = (location: string | null | undefined) => (location ? MEDIA_FILE_ID.exec(location)?.[1] : undefined);

export type ImageSize = { width: number; height: number };

export const imageMediaSingle = (mediaId: string, alt: string, size?: ImageSize): AdfNode => ({
  type: "mediaSingle",
  attrs: { layout: "align-start" },
  content: [{ type: "media", attrs: { id: mediaId, type: "file", collection: "", alt, ...size } }],
});

const GENERIC_IMAGE_NAME = /^image\.[a-z0-9]+$/i;
const two = (value: number) => String(value).padStart(2, "0");

export const pastedFileName = (name: string, now: Date) => {
  if (!GENERIC_IMAGE_NAME.test(name)) return name;
  const stamp = `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}-${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`;
  return name.replace(/^image/i, `image-${stamp}`);
};

export type MediaMatchState<A> = { pending: boolean; matches: ReadonlyMap<object, A> };

export const createMediaMatchCache = <A extends MediaAttachment>() => {
  const held = new WeakMap<object, ReadonlyMap<object, A>>();
  const none: ReadonlyMap<object, A> = new Map();
  return (doc: unknown, status: "loading" | "error" | "ready", html: string | undefined, attachments: readonly A[]): MediaMatchState<A> => {
    const key = typeof doc === "object" && doc !== null ? doc : undefined;
    if (status === "loading") {
      const kept = key ? held.get(key) : undefined;
      return kept ? { pending: false, matches: kept } : { pending: true, matches: none };
    }
    if (status === "error" || html === undefined) return { pending: false, matches: none };
    const matches = matchMediaAttachments(doc, html, attachments);
    if (key) held.set(key, matches);
    return { pending: false, matches };
  };
};
