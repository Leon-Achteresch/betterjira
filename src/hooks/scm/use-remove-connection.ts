import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { toast } from "sonner";
import { deleteToken, scmKeys } from "@/lib/scm/client";
import { useScmSettings } from "./use-scm-settings";

export const useRemoveConnection = () => {
  const queryClient = useQueryClient();
  const removeConnection = useScmSettings((state) => state.removeConnection);
  return useMutation({
    mutationFn: (id: string) => Effect.runPromise(deleteToken(id).pipe(Effect.as(id))),
    onSuccess: (id) => {
      removeConnection(id);
      void queryClient.invalidateQueries({ queryKey: scmKeys.all });
    },
    onError: (error) => toast.error("Verbindung konnte nicht entfernt werden", { description: error.message }),
  });
};
