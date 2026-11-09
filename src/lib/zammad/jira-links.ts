import { Schema } from "effect";

const RecordValue = Schema.Record(Schema.String, Schema.Unknown);
const normalized = (value: string) =>
  value.toLowerCase().replace(/[^a-zäöü0-9]/g, "");
const isHelpdeskField = (name: string) =>
  /^(helpdesk|hilftdas|zammad)(ticket)?(nummer|number|nr|link|url)?$/.test(
    normalized(name),
  );
const stringsOf = (value: unknown): string[] => {
  if (typeof value === "string" || typeof value === "number")
    return [String(value)];
  if (Array.isArray(value)) return value.flatMap(stringsOf);
  const decoded = Schema.decodeUnknownOption(RecordValue)(value);
  return decoded._tag === "Some"
    ? ["value", "url", "href", "text", "content"].flatMap((key) =>
        stringsOf(decoded.value[key]),
      )
    : [];
};
export type HelpdeskReference = { number?: string; id?: number; url?: string };
export const helpdeskReferences = (
  fields: Record<string, unknown>,
  names: Record<string, string>,
  baseUrl?: string,
): HelpdeskReference[] => {
  const values = Object.entries(names)
    .filter(([, name]) => isHelpdeskField(name))
    .flatMap(([id]) => stringsOf(fields[id]));
  const references: HelpdeskReference[] = [];
  for (const value of values) {
    const urls = value.match(/https?:\/\/[^\s<>\]"|]+/g) ?? [];
    for (const raw of urls) {
      try {
        const url = new URL(raw);
        if (url.username || url.password || url.protocol !== "https:") continue;
        const trusted =
          baseUrl &&
          url.origin === new URL(baseUrl).origin &&
          url.pathname.startsWith(new URL(baseUrl).pathname);
        const id = trusted
          ? url.hash.match(/#(?:ticket\/zoom|ticket)\/(\d+)(?:$|\/)/)?.[1]
          : undefined;
        references.push({ url: url.href, ...(id ? { id: Number(id) } : {}) });
      } catch {
        continue;
      }
    }
    if (!urls.length) {
      for (const number of value.match(/\b\d{3,}\b/g) ?? [])
        references.push({ number });
    }
  }
  const numbers = references.filter((ref) => ref.number);
  const links = references.filter((ref) => ref.url);
  if (numbers.length === 1 && links.length === 1)
    return [{ ...links[0], ...numbers[0] }];
  return references.filter(
    (ref, index) =>
      references.findIndex((other) =>
        ref.number ? other.number === ref.number : other.url === ref.url,
      ) === index,
  );
};
