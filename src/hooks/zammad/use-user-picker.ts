import { useState } from "react";
import { useZammadPeople } from "./use-zammad-people";
import { personFromUser } from "@/lib/zammad/people";
import { userLabel } from "@/lib/zammad/presentation";
import { useZammadUsers } from "./use-zammad-queries";

export const useUserPicker = (
  initialId?: number,
  initialLabel?: string,
  onChange?: (id: number) => void,
) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{
    id: number;
    label: string;
  } | null>(null);
  const users = useZammadUsers(query);
  const people = useZammadPeople((users.data ?? []).map((user) => user.id));
  return {
    open,
    setOpen,
    query,
    setQuery,
    value: selected?.id ?? initialId ?? "",
    label: selected?.label ?? initialLabel,
    users: (users.data ?? [])
      .filter((user) => user.active !== false)
      .map((user) => ({
        id: user.id,
        label: userLabel(user),
        email: user.email,
        person: people.get(user.id) ?? personFromUser(user),
      })),
    loading: users.isFetching,
    error: users.error?.message,
    onSelect: (id: number, label: string) => {
      setSelected({ id, label });
      onChange?.(id);
      setQuery("");
      setOpen(false);
    },
  };
};
export type UserPickerModel = ReturnType<typeof useUserPicker>;
