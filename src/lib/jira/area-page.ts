import { quoteJql } from "./jql";

export const BACKLOG = "backlog";

export type BoardSprint = number | typeof BACKLOG;

export type AreaSearch = { board?: number; sprint?: BoardSprint };

const DIGITS = /^\d+$/;

const idOf = (value: unknown) => {
  const id = typeof value === "string" && DIGITS.test(value) ? Number(value) : value;
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : undefined;
};

export const parseAreaSearch = (raw: Record<string, unknown>): AreaSearch => {
  const board = idOf(raw.board);
  const sprint = board === undefined ? undefined : raw.sprint === BACKLOG ? BACKLOG : idOf(raw.sprint);
  return { board, sprint };
};

export const areaJql = (projectKey: string) => `project = ${quoteJql(projectKey)} ORDER BY updated DESC`;

export type AreaContent<B> =
  | { kind: "all" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "missing" }
  | { kind: "board"; board: B };

export const areaContent = <B extends { id: number }>({
  boardId,
  boards,
  failed,
}: {
  boardId?: number;
  boards?: readonly B[];
  failed: boolean;
}): AreaContent<B> => {
  if (boardId === undefined) return { kind: "all" };
  const board = boards?.find((entry) => entry.id === boardId);
  if (board) return { kind: "board", board };
  if (boards) return { kind: "missing" };
  return failed ? { kind: "error" } : { kind: "loading" };
};

export const areaSubtitle = (projectKey: string, boardId?: number, boardName?: string) =>
  `${projectKey} · ${boardId === undefined ? "Alle Vorgänge" : (boardName ?? `Board ${boardId}`)}`;
