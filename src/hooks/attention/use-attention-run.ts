import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Effect } from "effect";
import { toast } from "sonner";
import { triggerAttention } from "@/lib/attention/client";
import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";
import { useAttentionSettings } from "./use-attention-settings";

export const useAttentionRun = () => {
  const site = useJiraSite();
  const myself = useJiraMyself();
  const webhookUrl = useAttentionSettings((state) => state.webhookUrl.trim());
  const markTriggered = useAttentionSettings((state) => state.markTriggered);
  const clearPending = useAttentionSettings((state) => state.clearPending);
  const siteUrl = site.data?.siteUrl;
  const me = myself.data && { accountId: myself.data.accountId, displayName: myself.data.displayName };

  const mutation = useMutation({
    mutationFn: (runId: string) => Effect.runPromise(triggerAttention(webhookUrl, { runId, siteUrl: siteUrl!, me: me! })),
    onMutate: markTriggered,
    onError: (error) => {
      clearPending();
      toast.error("Briefing konnte nicht gestartet werden", { description: error.message });
    },
  });

  const { mutate } = mutation;
  const run = useCallback(() => mutate(crypto.randomUUID()), [mutate]);

  return {
    isPending: mutation.isPending,
    run,
    ready: !!siteUrl && !!me && webhookUrl !== "",
  };
};
