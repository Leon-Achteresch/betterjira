export const CARD_PROPERTIES = {
  priority: "Priorität",
  issuetype: "Typ",
  labels: "Labels",
  parent: "Übergeordnet",
  points: "Story Points",
  subtasks: "Unteraufgaben",
  duedate: "Fälligkeit",
  age: "Tage in Spalte",
  rank: "Rang",
  assignee: "Bearbeiter",
} as const;

export type CardProperty = keyof typeof CARD_PROPERTIES;

export const DEFAULT_HIDDEN_PROPERTIES: CardProperty[] = ["rank"];
