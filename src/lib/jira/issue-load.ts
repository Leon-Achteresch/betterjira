import { JiraApiError, JiraAuthError, NotAuthenticated } from "./client";
import { jiraErrors } from "./field-values";

export type IssueLoadProblemKind = "not-found" | "forbidden" | "session" | "connection" | "unavailable" | "unknown";

export type IssueLoadProblem = {
  kind: IssueLoadProblemKind;
  title: string;
  description: string;
  detail: string;
};

export type IssueLoadState<T> =
  | { phase: "loading" }
  | { phase: "failed"; problem: IssueLoadProblem }
  | { phase: "ready"; data: T; refreshProblem: IssueLoadProblem | null; loadedAt: number };

const TEMPORARY_STATUS = new Set([408, 429]);

const kindOf = (error: unknown): IssueLoadProblemKind => {
  if (error instanceof NotAuthenticated) return "session";
  if (error instanceof JiraAuthError) return "connection";
  if (!(error instanceof JiraApiError)) return "unknown";
  if (error.status === 404) return "not-found";
  if (error.status === 403) return "forbidden";
  if (error.status === 401) return "session";
  if (error.status >= 500 || TEMPORARY_STATUS.has(error.status)) return "unavailable";
  return "unknown";
};

const TEXTS: Record<IssueLoadProblemKind, Pick<IssueLoadProblem, "title" | "description">> = {
  "not-found": {
    title: "Ticket nicht gefunden",
    description:
      "Jira liefert dieses Ticket nicht aus. Es kann verschoben, gelöscht oder für dein Konto nicht sichtbar sein. Deine Anmeldung bleibt davon unberührt.",
  },
  forbidden: {
    title: "Kein Zugriff auf dieses Ticket",
    description: "Jira verweigert den Zugriff, vermutlich fehlt deinem Konto eine Berechtigung. Du bist weiterhin angemeldet.",
  },
  session: {
    title: "Anmeldung nicht bestätigt",
    description: "Jira hat die Anmeldung für diese Anfrage nicht akzeptiert. Versuche es erneut, sonst melde dich in den Einstellungen neu an.",
  },
  connection: {
    title: "Verbindung zu Jira fehlgeschlagen",
    description: "Die Anfrage hat Jira nicht erreicht. Das ist keine Abmeldung, versuche es erneut.",
  },
  unavailable: {
    title: "Jira ist gerade nicht erreichbar",
    description: "Das liegt meist an Jira selbst und ist oft nach kurzer Zeit behoben.",
  },
  unknown: {
    title: "Ticket konnte nicht geladen werden",
    description: "Versuche es erneut.",
  },
};

export const issueLoadProblem = (error: unknown): IssueLoadProblem => {
  const kind = kindOf(error);
  const detail = jiraErrors(error).messages.join(" ") || (error instanceof JiraApiError ? error.message : "");
  return { kind, ...TEXTS[kind], detail };
};

export const issueLoadState = <T>({
  data,
  error,
  loadedAt,
}: {
  data: T | undefined;
  error: unknown;
  loadedAt: number;
}): IssueLoadState<T> => {
  if (data !== undefined) return { phase: "ready", data, refreshProblem: error ? issueLoadProblem(error) : null, loadedAt };
  if (error) return { phase: "failed", problem: issueLoadProblem(error) };
  return { phase: "loading" };
};

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export const loadedAtLabel = (loadedAt: number, now: number) => {
  const date = new Date(loadedAt);
  const time = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return sameDay(date, new Date(now)) ? `Stand ${time} Uhr` : `Stand ${date.toLocaleDateString("de-DE", { dateStyle: "medium" })}, ${time} Uhr`;
};
