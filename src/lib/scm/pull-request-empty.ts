import type { PullRequestEmptyReason } from "./pull-requests";

type EmptyContext = {
  reason: PullRequestEmptyReason;
  query: string;
  filterLabel: string;
  checksLabel: string;
  partial: boolean;
};

export const pullRequestsEmptyText = ({ reason, query, filterLabel, checksLabel, partial }: EmptyContext) => ({
  title: reason === "checks"
    ? `Keine Pull Requests mit Prüfstatus „${checksLabel}“`
    : reason === "query"
      ? `Keine Treffer für „${query}“`
      : `Keine Pull Requests mit Status „${filterLabel}“`,
  description: reason === "checks"
    ? `${partial ? "Einige Repositories konnten nicht geladen werden. " : ""}Der Prüfstatus-Filter gilt nur für die geladenen Pull Requests.`
    : `${partial ? "Einige Repositories konnten nicht geladen werden. " : ""}Angezeigt werden nur die bereits geladenen Pull Requests.`,
});
