import { createFileRoute } from "@tanstack/react-router";
import { Workday } from "@/components/dashboard/workday";
import { useDashboard } from "@/hooks/use-dashboard";

export const Route = createFileRoute("/")({ component: Today });

function Today() {
  const dashboard = useDashboard();
  return <Workday dashboard={dashboard} />;
}
