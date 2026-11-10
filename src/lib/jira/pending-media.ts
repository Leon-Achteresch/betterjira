import type { AdfNode } from "./adf";

const PREFIX = "local:";

export const pendingMediaId = () => `${PREFIX}${crypto.randomUUID()}`;

export const isPendingMediaId = (id: unknown): id is string => typeof id === "string" && id.startsWith(PREFIX);

const pendingIdOf = (value: unknown) => {
  if (typeof value !== "object" || value === null) return undefined;
  const { type, attrs } = value as Partial<AdfNode>;
  return (type === "media" || type === "mediaInline") && isPendingMediaId(attrs?.id) ? attrs.id : undefined;
};

const children = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : typeof value === "object" && value !== null ? Object.values(value) : [];

export const pendingMediaIds = (value: unknown): string[] => {
  const id = pendingIdOf(value);
  return [...new Set(id ? [id] : children(value).flatMap(pendingMediaIds))];
};

export const replacePendingMedia = (value: unknown, replace: (node: AdfNode, id: string) => AdfNode): unknown => {
  const id = pendingIdOf(value);
  if (id) return replace(value as AdfNode, id);
  if (Array.isArray(value)) return value.map((entry) => replacePendingMedia(entry, replace));
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replacePendingMedia(entry, replace)]));
};
