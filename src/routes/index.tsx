import { createFileRoute } from "@tanstack/react-router";
import { Workday } from "@/components/dashboard/workday";

export const Route = createFileRoute("/")({ component: Workday });
