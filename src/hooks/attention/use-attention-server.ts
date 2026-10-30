import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { attentionKeys, serveAttention } from "@/lib/attention/client";
import { useAttentionSettings } from "./use-attention-settings";

export const useAttentionServer = () => {
  const token = useAttentionSettings((state) => state.token);
  return useQuery({
    queryKey: attentionKeys.server(token),
    queryFn: ({ signal }) => Effect.runPromise(serveAttention(token), { signal }),
    staleTime: Infinity,
    gcTime: Infinity,
  });
};
