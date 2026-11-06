import type { useJiraBoard } from "@/lib/jira/queries";
import { type FilterValues, UNASSIGNED } from "@/lib/board-filters";
import type { InsightItem } from "@/lib/board-insights";

export type BoardColumn = NonNullable<ReturnType<typeof useJiraBoard>["data"]>[number]["columns"][number];
export type BoardCard = BoardColumn["issues"][number];

export const cardValues = ({ fields }: BoardCard): FilterValues => ({
  assignee: [fields.assignee?.displayName ?? UNASSIGNED],
  issuetype: [fields.issuetype.name],
  priority: fields.priority ? [fields.priority.name] : [],
  label: fields.labels ?? [],
});

export const insightItem = (card: BoardCard): InsightItem => ({
  values: { ...cardValues(card), status: [card.fields.status.name] },
  points: card.points,
});
