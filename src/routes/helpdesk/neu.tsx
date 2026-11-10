import { createFileRoute } from "@tanstack/react-router";
import { CreateHelpdeskTicket } from "@/components/zammad/create-ticket";
import { useCreateTicketForm } from "@/hooks/zammad/use-create-ticket-form";

export const Route = createFileRoute("/helpdesk/neu")({ component: Create });
function Create() {
  return <CreateHelpdeskTicket {...useCreateTicketForm()} />;
}
