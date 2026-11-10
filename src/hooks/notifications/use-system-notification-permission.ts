import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { readSystemPermission, requestSystemPermission, systemNotificationKeys } from "@/lib/notifications/system-notifications";

export const useSystemNotificationPermission = (enabled: boolean) =>
  useQuery({
    queryKey: systemNotificationKeys.permission,
    queryFn: ({ signal }) => Effect.runPromise(readSystemPermission, { signal }),
    enabled,
    retry: false,
    staleTime: 0,
    networkMode: "always",
  });

export const useRequestSystemNotificationPermission = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => Effect.runPromise(requestSystemPermission),
    networkMode: "always",
    onSuccess: () => queryClient.invalidateQueries({ queryKey: systemNotificationKeys.permission }),
  });
};
