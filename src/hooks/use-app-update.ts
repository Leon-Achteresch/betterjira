import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Update } from "@tauri-apps/plugin-updater";
import { Effect } from "effect";
import { toast } from "sonner";
import { appUpdateKeys, checkForUpdate, installUpdate } from "@/lib/app-update";

const TOAST_ID = "app-update";
const CHECK_INTERVAL = 6 * 60 * 60 * 1000;

export function useAppUpdate() {
  const { data: update } = useQuery({
    queryKey: appUpdateKeys.check,
    queryFn: () => Effect.runPromise(checkForUpdate),
    enabled: !import.meta.env.DEV,
    staleTime: CHECK_INTERVAL,
    refetchInterval: CHECK_INTERVAL,
    retry: false,
  });

  const { mutate: install } = useMutation({
    mutationFn: (next: Update) => Effect.runPromise(installUpdate(next)),
    onMutate: () => void toast.loading("Update wird installiert …", { id: TOAST_ID, duration: Infinity }),
    onError: (error) => void toast.error(error.message, { id: TOAST_ID, duration: 6000 }),
  });

  useEffect(() => {
    if (!update) return;
    toast(`Version ${update.version} ist verfügbar`, {
      id: TOAST_ID,
      duration: Infinity,
      action: { label: "Installieren", onClick: () => install(update) },
    });
  }, [update, install]);
}
