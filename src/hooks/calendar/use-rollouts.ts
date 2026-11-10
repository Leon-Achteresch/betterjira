import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { toast } from "sonner";
import { deleteRollout, loadRollouts, saveRollout, syncRolloutToOutlook } from "@/lib/calendar/client";
import { calendarKeys, type RolloutDraft } from "@/lib/calendar/model";
import { errorMessage } from "@/lib/calendar/presentation";

export const useRollouts = () =>
  useQuery({
    queryKey: calendarKeys.rollouts,
    queryFn: ({ signal }) => Effect.runPromise(loadRollouts, { signal }),
  });

export const useSaveRollout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ draft, id }: { draft: RolloutDraft; id?: string }) => Effect.runPromise(saveRollout(draft, id)),
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: calendarKeys.rollouts });
      toast.success(id ? "Rollout gespeichert" : "Rollout angelegt");
    },
  });
};

export const useDeleteRollout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => Effect.runPromise(deleteRollout(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
      toast.success("Rollout gelöscht");
    },
  });
};

export const useSyncRollout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => Effect.runPromise(syncRolloutToOutlook(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: calendarKeys.all });
      toast.success("In Outlook eingetragen");
    },
    onError: (error) =>
      toast.error("Synchronisierung fehlgeschlagen", { description: errorMessage(error, "Outlook ist nicht erreichbar.") }),
  });
};
