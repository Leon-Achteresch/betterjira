import { format, isToday } from "date-fns";
import type { JiraSessionStatus } from "@/lib/jira/session-status";

export type StatusTone = "neutral" | "success" | "warning" | "destructive";

export type StatusLabel = { label: string; tone: StatusTone };

export type CheckState = "unchecked" | "checking" | "ok" | "failed";

export type QueryCheck = { dataUpdatedAt: number; errorUpdatedAt: number; isFetching: boolean };

export const checkState = ({ dataUpdatedAt, errorUpdatedAt, isFetching }: QueryCheck): CheckState =>
  isFetching ? "checking" : errorUpdatedAt > dataUpdatedAt ? "failed" : dataUpdatedAt > 0 ? "ok" : "unchecked";

export const checkedAt = (time: number) => format(time, isToday(time) ? "HH:mm" : "dd.MM. HH:mm");

export const lastReachable = (dataUpdatedAt: number) => (dataUpdatedAt > 0 ? `Zuletzt erreichbar um ${checkedAt(dataUpdatedAt)}` : null);

const CHECK_LABELS: Record<CheckState, StatusLabel> = {
  unchecked: { label: "Nicht geprüft", tone: "neutral" },
  checking: { label: "Wird geprüft …", tone: "neutral" },
  ok: { label: "Antwort erhalten", tone: "neutral" },
  failed: { label: "Prüfung fehlgeschlagen", tone: "destructive" },
};

export const checkLabel = (state: CheckState) => CHECK_LABELS[state];

export const JIRA_SESSION_LABELS: Record<JiraSessionStatus, StatusLabel> = {
  pending: { label: "Wird gelesen …", tone: "neutral" },
  unconnected: { label: "Nicht angemeldet", tone: "warning" },
  connected: { label: "Angemeldet", tone: "success" },
  error: { label: "Anmeldung nicht lesbar", tone: "destructive" },
};

export type OutlookStatus = "pending" | "waiting" | "unconnected" | "connected" | "failed";

export const outlookStatus = ({
  isPending,
  paused,
  hasAccount,
  failed,
}: {
  isPending: boolean;
  paused: boolean;
  hasAccount: boolean;
  failed: boolean;
}): OutlookStatus => (failed ? "failed" : isPending ? (paused ? "waiting" : "pending") : hasAccount ? "connected" : "unconnected");

export const OUTLOOK_LABELS: Record<OutlookStatus, StatusLabel> = {
  pending: { label: "Wird gelesen …", tone: "neutral" },
  waiting: { label: "Wartet auf Netzwerk", tone: "neutral" },
  unconnected: { label: "Nicht verbunden", tone: "neutral" },
  connected: { label: "Verbunden", tone: "success" },
  failed: { label: "Prüfung fehlgeschlagen", tone: "destructive" },
};

export const scmLabel = (count: number, cliPending: boolean): StatusLabel =>
  count === 0 && cliPending
    ? { label: "Wird gelesen …", tone: "neutral" }
    : count === 0
      ? { label: "Keine Verbindung", tone: "neutral" } : { label: count === 1 ? "1 konfiguriert" : `${count} konfiguriert`, tone: "neutral" };
