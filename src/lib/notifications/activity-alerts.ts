import { Option, Schema } from "effect";
import type { StatusLabel } from "@/lib/connections/status";
import type { JiraNotification } from "@/lib/jira/notifications";

const ActivityAlertPrefs = Schema.Struct({ inApp: Schema.Boolean, system: Schema.Boolean, watching: Schema.Boolean });
export type ActivityAlertPrefs = typeof ActivityAlertPrefs.Type;

export const DEFAULT_ACTIVITY_ALERT_PREFS: ActivityAlertPrefs = { inApp: true, system: true, watching: false };

export const ACTIVITY_ALERT_STORAGE_KEY = "betterjira-activity-alerts";
export const ACTIVITY_ALERT_STORAGE_VERSION = 2;

const decodeStored = Schema.decodeUnknownOption(Schema.Record(Schema.String, Schema.Unknown));
const decodeFlag = Schema.decodeUnknownOption(Schema.Boolean);
const NOTHING_STORED: Readonly<Record<string, unknown>> = {};

export const parseActivityAlertPrefs = (value: unknown): ActivityAlertPrefs => {
  const stored = Option.getOrElse(decodeStored(value), () => NOTHING_STORED);
  return {
    inApp: Option.getOrElse(decodeFlag(stored.inApp), () => DEFAULT_ACTIVITY_ALERT_PREFS.inApp),
    system: Option.getOrElse(decodeFlag(stored.system), () => DEFAULT_ACTIVITY_ALERT_PREFS.system),
    watching: Option.getOrElse(decodeFlag(stored.watching), () => DEFAULT_ACTIVITY_ALERT_PREFS.watching),
  };
};

export type ActivityAlertChannel = "in-app" | "system";

export const activityAlertChannel = (focused: boolean, prefs: ActivityAlertPrefs): ActivityAlertChannel | null => {
  if (focused) return prefs.inApp ? "in-app" : null;
  return prefs.system ? "system" : null;
};

export type SystemAlertGate = { system: boolean; systemEpoch: number; owner: string | null };

export const systemAlertStillAllowed = (before: SystemAlertGate, now: SystemAlertGate) =>
  now.system && now.systemEpoch === before.systemEpoch && now.owner !== null && now.owner === before.owner;

export const ALERT_COOLDOWN_MS = 5 * 60_000;

export const alertableItems = (
  fresh: readonly JiraNotification[],
  watching: boolean,
  lastAlerted: ReadonlyMap<string, number>,
  now: number,
) =>
  fresh
    .filter((item) => (watching || item.kind === "direct") && now - (lastAlerted.get(item.issueKey) ?? -Infinity) >= ALERT_COOLDOWN_MS)
    .sort((a, b) => b.created - a.created);

const listFormat = new Intl.ListFormat("de", { type: "conjunction" });

const listNames = (names: readonly string[]) =>
  names.length <= 3 ? listFormat.format(names) : `${names.slice(0, 3).join(", ")} und ${names.length - 3} weitere`;

export type AlertMessage = { title: string; body: string; issueKey: string | null };

export const alertMessage = (items: readonly JiraNotification[]): AlertMessage | null => {
  const [first] = items;
  if (!first) return null;
  if (items.length === 1) {
    return { title: `${first.issueKey} · ${first.actor.displayName}`, body: first.body ? `${first.title}: ${first.body}` : first.title, issueKey: first.issueKey };
  }
  const issues = [...new Set(items.map((item) => item.issueKey))];
  if (issues.length === 1) {
    const actors = [...new Set(items.map((item) => item.actor.displayName))];
    return { title: `${first.issueKey} · ${first.summary}`, body: `${items.length} Neuigkeiten von ${listNames(actors)}`, issueKey: first.issueKey };
  }
  return { title: `${items.length} Neuigkeiten in ${issues.length} Tickets`, body: listNames(issues), issueKey: null };
};

export const SystemPermission = Schema.Literals(["granted", "denied", "prompt"]);
export type SystemPermission = typeof SystemPermission.Type;

export type SystemAlertStatus = "off" | "checking" | "check-failed" | SystemPermission;

export const systemAlertStatus = (enabled: boolean, check: { isError: boolean; data: SystemPermission | undefined }): SystemAlertStatus => {
  if (!enabled) return "off";
  if (check.isError) return "check-failed";
  return check.data ?? "checking";
};

export const SYSTEM_ALERT_LABELS: Record<SystemAlertStatus, StatusLabel> = {
  off: { label: "Aus", tone: "neutral" },
  checking: { label: "Wird geprüft …", tone: "neutral" },
  "check-failed": { label: "Prüfung fehlgeschlagen", tone: "destructive" },
  granted: { label: "Erlaubt", tone: "success" },
  denied: { label: "Vom System blockiert", tone: "warning" },
  prompt: { label: "Noch nicht erlaubt", tone: "warning" },
};
