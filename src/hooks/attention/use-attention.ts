import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { Effect } from "effect";
import { ATTENTION_EVENT, attentionKeys, readAttention } from "@/lib/attention/client";

export const useAttention = () => {
  const queryClient = useQueryClient();
  useEffect(() => {
    const unlisten = listen(ATTENTION_EVENT, () => void queryClient.invalidateQueries({ queryKey: attentionKeys.result }));
    return () => void unlisten.then((stop) => stop());
  }, [queryClient]);

  return useQuery({
    queryKey: attentionKeys.result,
    queryFn: ({ signal }) => Effect.runPromise(readAttention, { signal }),
    staleTime: Infinity,
  });
};
