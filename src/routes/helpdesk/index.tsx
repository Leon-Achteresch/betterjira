import { createFileRoute } from "@tanstack/react-router";
import { HelpdeskList } from "@/components/zammad/ticket-list";
import { useHelpdeskList } from "@/hooks/zammad/use-helpdesk-list";

export const Route = createFileRoute("/helpdesk/")({ component: Helpdesk });
function Helpdesk() {
  return <HelpdeskList {...useHelpdeskList()} />;
}
