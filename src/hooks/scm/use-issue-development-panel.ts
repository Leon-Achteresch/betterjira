import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { copyToClipboard } from "@/lib/clipboard";
import { useJiraSite } from "@/lib/jira/queries";
import {
  branchesWithoutPullRequest,
  repoLinkId,
  sortPullRequests,
  type DevelopmentRepo,
  type DevelopmentStatus,
} from "@/lib/scm/development";
import { branchNameFor, checkoutCommand } from "@/lib/scm/issue-key";
import { useCreateBranch } from "./use-create-branch";
import { useCreatePullRequest } from "./use-create-pull-request";
import { useIssueDevelopment } from "./use-issue-development";

type IssueSummary = { projectKey: string; summary: string };

export const useIssueDevelopmentPanel = (issueKey: string, issue: IssueSummary | undefined) => {
  const site = useJiraSite();
  const { query, links, connections, connectionsReady } = useIssueDevelopment(issueKey, issue?.projectKey);
  const createBranch = useCreateBranch(issueKey);
  const createPullRequest = useCreatePullRequest(issueKey);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);

  const entries = query.data ?? [];
  const entryById = new Map(entries.map((entry) => [repoLinkId(entry.link), entry]));
  const status: DevelopmentStatus = !connectionsReady
    ? "loading"
    : connections.length === 0
      ? "unconfigured"
      : links.length === 0
        ? "unlinked"
        : query.isPending
          ? "loading"
          : "ready";

  const repos: DevelopmentRepo[] = entries.map((entry) => ({
    id: repoLinkId(entry.link),
    repo: entry.link.repo,
    pullRequests: entry.development ? sortPullRequests(entry.development.pullRequests) : [],
    branches: entry.development ? branchesWithoutPullRequest(entry.development) : [],
    error: entry.error,
  }));

  const repoOptions = links.flatMap((link) => {
    const connection = connections.find(({ id }) => id === link.connectionId);
    return connection ? [{ id: repoLinkId(link), label: `${link.repo} · ${connection.label}`, link, connection }] : [];
  });

  const issueUrl = site.data ? `${site.data.siteUrl}/browse/${issueKey}` : null;

  return {
    panel: {
      status,
      issueKey,
      repos,
      refreshing: query.isFetching,
      pendingBranch: createPullRequest.isPending ? (createPullRequest.variables?.draft.branch ?? null) : null,
      onRefresh: () => void query.refetch(),
      onCreateBranch: () => {
        createBranch.reset();
        setBranchDialogOpen(true);
      },
      onOpen: (url: string) => void openUrl(url),
      onCopyCheckout: (branch: string) => void copyToClipboard(checkoutCommand(branch), "Checkout-Befehl kopiert"),
      onCreatePullRequest: (repoId: string, branch: string) => {
        const entry = entryById.get(repoId);
        if (!entry?.connection || !issue) return;
        createPullRequest.mutate({
          connection: entry.connection,
          repo: entry.link.repo,
          draft: {
            branch,
            title: `${issueKey} ${issue.summary}`,
            body: issueUrl ? `Jira: [${issueKey}](${issueUrl})` : issueKey,
          },
        });
      },
    },
    branchDialog: {
      open: branchDialogOpen,
      onOpenChange: setBranchDialogOpen,
      repos: repoOptions.map(({ id, label }) => ({ id, label })),
      defaultName: issue ? branchNameFor(issueKey, issue.summary) : "",
      pending: createBranch.isPending,
      error: createBranch.error?.message ?? null,
      onSubmit: (repoId: string, name: string) => {
        const option = repoOptions.find(({ id }) => id === repoId);
        if (!option) return;
        createBranch.mutate(
          { connection: option.connection, repo: option.link.repo, name },
          { onSuccess: () => setBranchDialogOpen(false) },
        );
      },
    },
  };
};
