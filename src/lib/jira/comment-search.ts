import { adfToText, isAdfDoc } from "./adf";

type SearchableComment = { body: unknown; author?: { displayName: string } };

const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("de-DE").replace(/\s+/g, " ").trim();

export const commentText = (body: unknown) => (typeof body === "string" ? body : isAdfDoc(body) ? adfToText(body) : "");

export const filterComments = <T extends SearchableComment>(comments: readonly T[], query: string): readonly T[] => {
  const needle = normalize(query);
  if (!needle) return comments;
  return comments.filter(
    (comment) => normalize(comment.author?.displayName ?? "").includes(needle) || normalize(commentText(comment.body)).includes(needle),
  );
};

export const commentSearchSummary = (found: number, loaded: number, query: string) => {
  const noun = loaded === 1 ? "geladenen Kommentar" : "geladenen Kommentaren";
  return query.trim() ? `${found} von ${loaded} ${noun}` : `In ${loaded} ${noun} suchen`;
};
