import { useIssueTabStore } from "@/hooks/use-issue-tabs";
import { zammadTabKey } from "@/lib/issue-tabs";
import { createFileRoute } from "@tanstack/react-router";
import { HelpdeskDetail } from "@/components/zammad/ticket-detail";
import { useHelpdeskDetail } from "@/hooks/zammad/use-helpdesk-detail";

export const Route = createFileRoute("/helpdesk/$id")({
  onEnter: ({ params }) => {
    if (
      /^\d+$/.test(params.id) &&
      Number(params.id) > 0 &&
      Number.isSafeInteger(Number(params.id))
    )
      useIssueTabStore.getState().open(zammadTabKey(params.id));
  },
  component: Ticket,
});
function Ticket() {
  const { id } = Route.useParams();
  return <TicketContent key={id} id={id} />;
}

function TicketContent({ id }: { id: string }) {
  return <HelpdeskDetail {...useHelpdeskDetail(id)} />;
}
