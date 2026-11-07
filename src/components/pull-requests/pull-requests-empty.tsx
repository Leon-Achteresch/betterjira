import { FunnelXIcon, GitPullRequestIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { PullRequestsEmptyProps } from "@/types/pull-requests";

export function PullRequestsEmpty(props: PullRequestsEmptyProps) {
  return (
    <Empty className="rounded-2xl border border-dashed py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <GitPullRequestIcon />
        </EmptyMedia>
        <EmptyTitle className="text-balance">{props.title}</EmptyTitle>
        <EmptyDescription>{props.description}</EmptyDescription>
      </EmptyHeader>
      {props.onChecksReset && (
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
