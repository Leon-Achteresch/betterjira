import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { ATTENTION_EVENT, attentionKeys } from "@/lib/attention/client";

export function useAttentionEvents() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const unlisten = listen(
      ATTENTION_EVENT,
      () => void queryClient.invalidateQueries({ queryKey: attentionKeys.result }),
    );
    return () => void unlisten.then((stop) => stop());
  }, [queryClient]);
}
