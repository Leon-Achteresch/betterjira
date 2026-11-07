export type AttachmentSortMode = "original" | "name" | "newest" | "largest";

export type SortableAttachment = {
  readonly filename?: string;
  readonly created?: string;
  readonly size?: number;
};

export const ATTACHMENT_SORT_DEFAULT: AttachmentSortMode = "original";

export const ATTACHMENT_SORT_OPTIONS: ReadonlyArray<{ value: AttachmentSortMode; label: string }> = [
  { value: "original", label: "Ursprüngliche Reihenfolge" },
  { value: "name", label: "Dateiname A–Z" },
  { value: "newest", label: "Neueste zuerst" },
  { value: "largest", label: "Größte zuerst" },
];

export const isAttachmentSortMode = (value: string): value is AttachmentSortMode =>
  ATTACHMENT_SORT_OPTIONS.some((option) => option.value === value);

const collator = new Intl.Collator("de", { numeric: true, sensitivity: "base" });

const nameOf = (attachment: SortableAttachment) => attachment.filename?.trim() || undefined;

const timeOf = (attachment: SortableAttachment) => {
  const time = Date.parse((attachment.created ?? "").replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(time) ? undefined : time;
};

const bytesOf = (attachment: SortableAttachment) =>
  typeof attachment.size === "number" && Number.isFinite(attachment.size) && attachment.size >= 0 ? attachment.size : undefined;

const missingLast = <V>(a: V | undefined, b: V | undefined, compare: (a: V, b: V) => number) =>
  a === undefined ? (b === undefined ? 0 : 1) : b === undefined ? -1 : compare(a, b);

const descending = (a: number, b: number) => b - a;

const COMPARE: Record<Exclude<AttachmentSortMode, "original">, (a: SortableAttachment, b: SortableAttachment) => number> = {
  name: (a, b) => missingLast(nameOf(a), nameOf(b), collator.compare),
  newest: (a, b) => missingLast(timeOf(a), timeOf(b), descending),
  largest: (a, b) => missingLast(bytesOf(a), bytesOf(b), descending),
};

export const sortAttachments = <T extends SortableAttachment>(items: readonly T[], mode: AttachmentSortMode): readonly T[] => {
  if (mode === "original") return items;
  const compare = COMPARE[mode];
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => compare(a.item, b.item) || a.index - b.index)
    .map(({ item }) => item);
};
