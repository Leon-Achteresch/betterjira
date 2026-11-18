import type { Article } from "./model";
import { canReplyToArticle } from "./people";

const bareAddress =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const namedAddress = /^(?:"(?:[^"\\]|\\.)*"|[^"<>:;\\])*<([^<>]+)>$/;

function mailboxes(value: string) {
  if (/[\p{Cc}\p{Cf}\u2028\u2029]/u.test(value)) return null;
  const pieces = value.match(/"(?:[^"\\]|\\.)*"|,|[^",]+/g) ?? [];
  if (pieces.join("") !== value) return null;
  const entries = [""];
  for (const piece of pieces) {
    if (piece === ",") entries.push("");
    else entries[entries.length - 1] += piece;
  }
  const addresses: string[] = [];
  let invalid = false;
  for (const entry of entries) {
    const text = entry.trim();
    if (!text) continue;
    const named = namedAddress.exec(text);
    if (!named && /["<>:;]/.test(text)) return null;
    const address = named?.[1].trim() ?? text;
    if (
      address.length > 254 ||
      address.indexOf("@") > 64 ||
      !bareAddress.test(address)
    ) {
      invalid = true;
    } else {
      addresses.push(address);
    }
  }
  return { addresses, invalid };
}

export function sourceCcAddresses(value: unknown) {
  const addresses =
    typeof value === "string" ? mailboxes(value)?.addresses : null;
  return [...new Set(addresses?.map((address) => address.toLowerCase()))];
}

export function appendSourceCc(
  draftCc: string,
  recipient: string | null,
  selected: readonly string[],
) {
  const existing = mailboxes(draftCc);
  if (!existing || existing.invalid) return null;
  const seen = new Set([
    ...existing.addresses.map((address) => address.toLowerCase()),
    ...sourceCcAddresses(recipient),
  ]);
  const additions = [...new Set(selected)].filter(
    (address) => !seen.has(address),
  );
  if (!additions.length) return draftCc;
  const separator =
    !draftCc.trim() || /,\s+$/.test(draftCc)
      ? ""
      : draftCc.endsWith(",")
        ? " "
        : ", ";
  return `${draftCc}${separator}${additions.join(", ")}`;
}

export function sourceCcIdentity(article: Article, ticketId: number) {
  if (
    article.ticket_id !== ticketId ||
    !Number.isSafeInteger(article.id) ||
    article.id <= 0 ||
    article.type !== "email" ||
    (article.sender !== "Customer" && article.sender !== "Agent") ||
    !canReplyToArticle(article)
  )
    return null;
  return JSON.stringify([
    article.id,
    article.ticket_id,
    article.sender,
    article.message_id,
    article.from,
    article.to,
  ]);
}

export function findSourceCcArticle(
  articles: readonly Article[],
  ticketId: number,
  sourceId: number,
  identity: string,
) {
  const matches = articles.filter((row) => row.id === sourceId);
  return matches.length === 1 &&
    sourceCcIdentity(matches[0], ticketId) === identity
    ? matches[0]
    : undefined;
}
