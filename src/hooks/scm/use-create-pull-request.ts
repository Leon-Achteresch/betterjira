import { useMutation, useQueryClient } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Effect } from "effect";
import { toast } from "sonner";
import { scmKeys } from "@/lib/scm/client";
import type { PullRequestDraft, ScmConnection } from "@/lib/scm/model";
import { providerFor } from "@/lib/scm/provider";

export type NewPullRequest = { connection: ScmConnection; repo: string; draft: PullRequestDraft };

export const useCreatePullRequest = (issueKey: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ connection, repo, draft }: NewPullRequest) =>
      Effect.runPromise(providerFor(connection.kind).createPullRequest(connection, repo, draft)),
    onSuccess: (url) => {
      void queryClient.invalidateQueries({ queryKey: scmKeys.developmentAll(issueKey) });
      toast.success("Pull Request erstellt", url ? { action: { label: "Öffnen", onClick: () => void openUrl(url) } } : undefined);
    },
    onError: (error) => toast.error("Pull Request konnte nicht erstellt werden", { description: error.message }),
  });
};
