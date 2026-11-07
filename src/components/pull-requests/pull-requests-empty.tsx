import { FunnelXIcon, GitPullRequestIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { PullRequestEmptyReason } from "@/lib/scm/pull-requests";

type PullRequestsEmptyProps = {
  reason: PullRequestEmptyReason;
  query: string;
  filterLabel: string;
  checksLabel: string;
  partial: boolean;
  onChecksReset: () => void;
};

const titleFor = ({ reason, query, filterLabel, checksLabel }: PullRequestsEmptyProps) =>
  reason === "checks"
    ? `Keine Pull Requests mit Prüfstatus „${checksLabel}“`
    : reason === "query"
      ? `Keine Treffer für „${query}“`
      : `Keine Pull Requests mit Status „${filterLabel}“`;

const descriptionFor = ({ reason, partial }: PullRequestsEmptyProps) => {
  if (reason === "checks")
    return partial
      ? "Einige Repositories konnten nicht geladen werden. Der Prüfstatus-Filter gilt nur für die geladenen Pull Requests."
      : "Der Prüfstatus-Filter gilt nur für die geladenen Pull Requests.";
  return partial ? "Einige Repositories konnten nicht geladen werden." : "Durchsucht werden alle verknüpften Repositories.";
};

export function PullRequestsEmpty(props: PullRequestsEmptyProps) {
  return (
    <Empty className="rounded-2xl border border-dashed py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <GitPullRequestIcon />
        </EmptyMedia>
        <EmptyTitle className="text-balance">{titleFor(props)}</EmptyTitle>
        <EmptyDescription>{descriptionFor(props)}</EmptyDescription>
      </EmptyHeader>
      {props.reason === "checks" && (
        <EmptyContent>
          <Button variant="outline" className="h-8 rounded-xl" onClick={props.onChecksReset}>
            <FunnelXIcon />
            Prüfstatus zurücksetzen
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
