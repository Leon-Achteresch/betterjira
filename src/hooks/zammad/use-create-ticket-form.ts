import { useSubmissionLock } from "@/hooks/use-submission-lock";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent } from "react";
import { formText } from "@/lib/zammad/ticket-form";
import { useZammadConnection } from "./use-zammad-connection";
import { useCreateZammadTicket } from "./use-zammad-mutations";
import { useZammadMetadata } from "./use-zammad-queries";
import { useUserPicker } from "./use-user-picker";

export const useCreateTicketForm = () => {
  const lock = useSubmissionLock();
  const connection = useZammadConnection();
  const groups = useZammadMetadata("groups", !!connection.data);
  const priorities = useZammadMetadata("ticket_priorities", !!connection.data);
  const customer = useUserPicker();
  const create = useCreateZammadTicket();
  const navigate = useNavigate();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (create.isPending || !customer.value || !lock.acquire("create")) return;
    const data = new FormData(event.currentTarget);
    create.mutate(
      {
        title: formText(data, "title"),
        group_id: Number(formText(data, "group_id")),
        priority_id: Number(formText(data, "priority_id")),
        customer_id: Number(customer.value),
        article: {
          body: formText(data, "body"),
          type: "note",
          internal: false,
        },
      },
      {
        onSettled: () => lock.release("create"),
        onSuccess: (ticket) =>
          void navigate({
            to: "/helpdesk/$id",
            params: { id: String(ticket.id) },
          }),
      },
    );
  };
  return {
    connected: !!connection.data,
    loading: connection.isPending || (!!connection.data && groups.isPending),
    groups: groups.data?.filter((row) => row.active !== false) ?? [],
    priorities: priorities.data?.filter((row) => row.active !== false) ?? [],
    defaultPriority: priorities.data?.find(
      (row) => row.id === 2 && row.active !== false,
    ),
    customer,
    onSubmit,
    saving: create.isPending,
    error:
      connection.error?.message ??
      groups.error?.message ??
      priorities.error?.message ??
      create.error?.message,
  };
};
export type CreateTicketFormModel = ReturnType<typeof useCreateTicketForm>;
