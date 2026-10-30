import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboard";
import { scmKeys } from "@/lib/scm/client";
import { checkoutCommand } from "@/lib/scm/issue-key";
import type { ScmConnection } from "@/lib/scm/model";
import { providerFor } from "@/lib/scm/provider";

export type NewBranch = { connection: ScmConnection; repo: string; name: string };

export const useCreateBranch = (issueKey: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ connection, repo, name }: NewBranch) =>
      Effect.runPromise(providerFor(connection.kind).createBranch(connection, repo, name)),
    onSuccess: (branch) => {
      void queryClient.invalidateQueries({ queryKey: scmKeys.developmentAll(issueKey) });
      toast.success(`Branch ${branch.name} erstellt`, {
        action: { label: "Checkout kopieren", onClick: () => void copyToClipboard(checkoutCommand(branch.name), "Befehl kopiert") },
      });
    },
  });
};
