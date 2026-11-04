import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { attentionKeys, readAttention } from "@/lib/attention/client";

export const useAttention = () => {
  return useQuery({
    queryKey: attentionKeys.result,
    queryFn: ({ signal }) => Effect.runPromise(readAttention, { signal }),
    staleTime: Infinity,
  });
};
