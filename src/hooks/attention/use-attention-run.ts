import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { toast } from "sonner";
import { attentionKeys, triggerAttention, type AttentionResult } from "@/lib/attention/client";
import { attentionScope, isAttentionPending, isAttentionWebhook } from "@/lib/attention/briefing-state";
import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";
import { useAttentionServer } from "./use-attention-server";
import { useAttentionSettings } from "./use-attention-settings";
import { useAttentionRunHistory } from "./use-attention-run-history";

type RunInput = {
  runId: string;
  scope: string;
  webhookUrl: string;
  siteUrl: string;
  me: { accountId: string; displayName: string };
};

export const useAttentionRun = () => {
  const site = useJiraSite();
  const myself = useJiraMyself();
  const server = useAttentionServer();
  const queryClient = useQueryClient();
  const webhookUrl = useAttentionSettings((state) => state.webhookUrl.trim());
  const markTriggered = useAttentionSettings((state) => state.markTriggered);
  const clearPending = useAttentionSettings((state) => state.clearPending);
  const remember = useAttentionRunHistory((state) => state.remember);
  const fail = useAttentionRunHistory((state) => state.fail);
  const siteUrl = site.data?.siteUrl;
  const me = myself.data && { accountId: myself.data.accountId, displayName: myself.data.displayName };
  const scope = site.data && myself.data ? attentionScope(site.data.cloudId, myself.data.accountId) : undefined;
  const ready = !!siteUrl && !!me && !!scope && !!server.data && !server.error && isAttentionWebhook(webhookUrl);

  const mutation = useMutation({
    mutationFn: ({ runId, webhookUrl: url, siteUrl: urlOfSite, me: person }: RunInput) =>
      Effect.runPromise(triggerAttention(url, { runId, siteUrl: urlOfSite, me: person })),
    onError: (error, input) => {
      fail(input.scope, input.runId, error.message);
      if (useAttentionSettings.getState().pendingRunId === input.runId) clearPending();
      toast.error("Briefing konnte nicht gestartet werden", { description: error.message });
    },
  });

  const { mutate } = mutation;
  const run = useCallback(() => {
    if (!ready || !scope || !siteUrl || !me) return;
    const settings = useAttentionSettings.getState();
    const owners = useAttentionRunHistory.getState().owners;
    const result = queryClient.getQueryData<AttentionResult | null>(attentionKeys.result);
    const pendingId = settings.pendingRunId && owners[settings.pendingRunId] === scope ? settings.pendingRunId : null;
    if (isAttentionPending(pendingId, settings.lastTriggeredAt, result?.runId ?? null, Date.now())) return;
    const runId = crypto.randomUUID();
    remember(runId, scope);
    markTriggered(runId);
    mutate({ runId, scope, webhookUrl, siteUrl, me });
  }, [ready, scope, siteUrl, me?.accountId, me?.displayName, queryClient, remember, markTriggered, mutate, webhookUrl]);

  return {
    isPending: mutation.isPending && mutation.variables?.scope === scope,
    error: mutation.variables?.scope === scope ? mutation.error : null,
    serverError: server.error,
    scope,
    run,
    ready,
  };
};
