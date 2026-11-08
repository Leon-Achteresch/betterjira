import { Option, Schema } from "effect";
import type { StatusLabel } from "@/lib/connections/status";
import type { JiraNotification } from "@/lib/jira/notifications";

const ActivityAlertPrefs = Schema.Struct({ inApp: Schema.Boolean, system: Schema.Boolean });
export type ActivityAlertPrefs = typeof ActivityAlertPrefs.Type;

export const DEFAULT_ACTIVITY_ALERT_PREFS: ActivityAlertPrefs = { inApp: true, system: true };

export const ACTIVITY_ALERT_STORAGE_KEY = "betterjira-activity-alerts";
export const ACTIVITY_ALERT_STORAGE_VERSION = 1;

const decodeStored = Schema.decodeUnknownOption(Schema.Record(Schema.String, Schema.Unknown));
const decodeFlag = Schema.decodeUnknownOption(Schema.Boolean);
const NOTHING_STORED: Readonly<Record<string, unknown>> = {};

export const parseActivityAlertPrefs = (value: unknown): ActivityAlertPrefs => {
  const stored = Option.getOrElse(decodeStored(value), () => NOTHING_STORED);
  return {
    inApp: Option.getOrElse(decodeFlag(stored.inApp), () => DEFAULT_ACTIVITY_ALERT_PREFS.inApp),
    system: Option.getOrElse(decodeFlag(stored.system), () => DEFAULT_ACTIVITY_ALERT_PREFS.system),
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

export const MAX_ACTIVITY_ALERTS = 3;

export const systemAlertMessages = (fresh: readonly JiraNotification[]) => {
  const shown = fresh.slice(0, MAX_ACTIVITY_ALERTS).map((item) => ({
    title: `${item.issueKey} · ${item.actor.displayName}`,
    body: `${item.title}: ${item.body}`,
  }));
  const rest = fresh.length - shown.length;
  return rest > 0 ? [...shown, { title: "betterjira", body: `${rest} weitere Benachrichtigungen` }] : shown;
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
