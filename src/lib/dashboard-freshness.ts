export type FreshnessFetchStatus = "fetching" | "paused" | "idle";

export type FreshnessSource = {
  label: string;
  hasData: boolean;
  updatedAt: number;
  failed: boolean;
  errorMessage: string;
  fetchStatus: FreshnessFetchStatus;
};

export const freshnessSource = (
  label: string,
  query: {
    data: unknown;
    dataUpdatedAt: number;
    status: "pending" | "error" | "success";
    error: { message: string } | null;
    fetchStatus: FreshnessFetchStatus;
  },
): FreshnessSource => ({
  label,
  hasData: query.data !== undefined,
  updatedAt: query.dataUpdatedAt,
  failed: query.status === "error",
  errorMessage: query.error?.message ?? "",
  fetchStatus: query.fetchStatus,
});

export type FreshnessTone ="refreshing" | "offline" | "partial" | "failed" | "fresh";

export type DashboardFreshness =
  | { kind: "loading" }
  | { kind: "waiting" }
  | { kind: "error"; message: string }
  | { kind: "ready"; tone: FreshnessTone; updatedAt: number; failed: string[]; refreshing: boolean };

export const dashboardFreshness = ({
  primary,
  secondary,
  online,
}: {
  primary: FreshnessSource;
  secondary: readonly FreshnessSource[];
  online: boolean;
}): DashboardFreshness => {
  if (!primary.hasData) {
    if (primary.fetchStatus === "paused" || (!online && primary.fetchStatus === "idle")) return { kind: "waiting" };
    if (primary.failed && primary.fetchStatus === "idle") return { kind: "error", message: primary.errorMessage };
    return { kind: "loading" };
  }
  const sources = [primary, ...secondary];
  const refreshing = sources.some((source) => source.fetchStatus === "fetching");
  const waiting = !online || sources.some((source) => source.fetchStatus === "paused");
  const failed = sources.filter((source) => source.failed && source.fetchStatus !== "fetching");
  const updatedAt = Math.min(...sources.filter((source) => source.hasData).map((source) => source.updatedAt));
  const tone: FreshnessTone = refreshing
    ? "refreshing"
    : waiting
      ? "offline"
      : failed.length === sources.length
        ? "failed"
        : failed.length > 0
          ? "partial"
          : "fresh";
  return { kind: "ready", tone, updatedAt, failed: failed.map((source) => source.label), refreshing };
};

export const standLabel = (updatedAt: number, now: Date) => {
  const date = new Date(updatedAt);
  const time = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return date.toDateString() === now.toDateString()
    ? `Stand ${time} Uhr`
    : `Stand ${date.toLocaleDateString("de-DE", { day: "numeric", month: "short" })}, ${time} Uhr`;
};

const listLabels = (labels: readonly string[]) =>
  labels.length > 1 ? `${labels.slice(0, -1).join(", ")} und ${labels.at(-1)}` : (labels[0] ?? "");

export const freshnessMessage = (tone: FreshnessTone, failed: readonly string[]) => {
  switch (tone) {
    case "refreshing":
      return "Wird aktualisiert";
    case "offline":
      return "Offline, Aktualisierung folgt bei Verbindung";
    case "failed":
      return "Aktualisierung fehlgeschlagen";
    case "partial":
      return `${listLabels(failed)} nicht aktualisiert`;
    case "fresh":
      return "Aktuell";
  }
};
