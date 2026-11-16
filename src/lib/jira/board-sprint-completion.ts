import type { BoardMetadata } from "./board";

export const boardSprintCompletion = (metadata?: BoardMetadata) => {
  if (metadata?.boardType !== "scrum") return undefined;
  const column = metadata.config.columnConfig.columns.at(-1);
  if (!column) return undefined;
  return {
    columnName: column.name,
    hasStatuses: column.statuses.length > 0,
  };
};

export type BoardSprintCompletion = NonNullable<ReturnType<typeof boardSprintCompletion>>;
