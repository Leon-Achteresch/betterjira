import { JiraApiError } from "./client";
import { jiraErrors } from "./field-values";

export type FilterProblem = { title: string; description: string; detail: string };

const descriptions: Record<number, string> = {
  403: "Jira verweigert den Zugriff auf diesen Filter (403). Deine Anmeldung bleibt bestehen.",
  404: "Jira findet diesen Filter nicht (404). Er kann fehlen oder nicht für dich freigegeben sein.",
};

export const filterProblem = (error: unknown): FilterProblem => {
  const status = error instanceof JiraApiError ? error.status : undefined;
  const known = status === undefined ? undefined : descriptions[status];
  return {
    title: known ? "Filter nicht verfügbar" : "Filter konnte nicht geladen werden",
    description: known ?? "Jira ist gerade nicht erreichbar oder antwortet mit einem Fehler. Versuche es erneut.",
    detail: jiraErrors(error).messages.join(" "),
  };
};
