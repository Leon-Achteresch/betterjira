import { useRememberZammadTab } from "@/hooks/use-issue-tabs";
import { createFileRoute } from "@tanstack/react-router";
import { HelpdeskDetail } from "@/components/zammad/ticket-detail";
import { useHelpdeskDetail } from "@/hooks/zammad/use-helpdesk-detail";

export const Route = createFileRoute("/helpdesk/$id")({
  component: Ticket,
});
function Ticket() {
  const { id } = Route.useParams();
  return <TicketContent key={id} id={id} />;
}

function TicketContent({ id }: { id: string }) {
  useRememberZammadTab(id);
  return <HelpdeskDetail {...useHelpdeskDetail(id)} />;
}
