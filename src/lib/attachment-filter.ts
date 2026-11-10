export type AttachmentKind = "all" | "image" | "document" | "other";

type FilterableAttachment = { filename: string; mimeType: string };

export const ATTACHMENT_KINDS: readonly { value: AttachmentKind; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "image", label: "Bilder" },
  { value: "document", label: "Dokumente" },
  { value: "other", label: "Andere" },
];

export const UNNAMED_ATTACHMENT = "Unbenannte Datei";

const DOCUMENT_MIME =
  /^(text\/[\w.+-]+|application\/(pdf|rtf|msword|json|xml|vnd\.ms-(excel|powerpoint)|vnd\.openxmlformats-officedocument\.[\w.+-]+|vnd\.oasis\.opendocument\.[\w.+-]+))$/;

const normalize = (value: string) => value.normalize("NFC").trim().toLocaleLowerCase("de");

export const attachmentName = (filename: string) => filename.trim() || UNNAMED_ATTACHMENT;

export const attachmentKind = (mimeType: string): Exclude<AttachmentKind, "all"> => {
  const type = normalize(mimeType.split(";")[0] ?? "");
  if (type.startsWith("image/")) return "image";
  return DOCUMENT_MIME.test(type) ? "document" : "other";
};

export const filterAttachments = <T extends FilterableAttachment>(
  attachments: readonly T[],
  { query, kind }: { query: string; kind: AttachmentKind },
) => {
  const needle = normalize(query);
  return attachments.filter(
    (attachment) =>
      (kind === "all" || attachmentKind(attachment.mimeType) === kind) &&
      normalize(attachmentName(attachment.filename)).includes(needle),
  );
};
