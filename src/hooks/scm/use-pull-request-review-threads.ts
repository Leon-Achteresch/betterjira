import { useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { useContextSession } from "@/hooks/use-context-session";
import { useLatestRef } from "@/hooks/use-latest-ref";
import { scmKeys } from "@/lib/scm/client";
import {
  bitbucketReviewOriginal,
  githubReviewTarget,
  readReviewThreads,
  reviewThreadsError,
} from "@/lib/scm/review-threads";
import { reviewThreadsAllowed } from "@/lib/scm/review-threads-capability";
import type {
  ListedPullRequest,
  PullRequestTarget,
} from "@/lib/scm/pull-requests";

export const pullRequestRowKey = (entry: ListedPullRequest) =>
  JSON.stringify([entry.repoId, entry.pr.number, entry.pr.url]);

export function usePullRequestReviewThreads(
  entries: readonly ListedPullRequest[],
  repos: readonly PullRequestTarget[],
  view: string,
  checkingGithub: boolean,
) {
  const context = JSON.stringify([
    view,
    repos.map(({ id, connection }) => [
      id,
      connection?.kind,
      connection?.baseUrl,
      connection?.account,
      connection?.auth,
      connection?.auth.kind === "gh" && checkingGithub,
    ]),
  ]);
  const session = useContextSession(context);
  const instance = useId();
  const sequence = useRef(0);
  const [selection, setSelection] = useState<{
    token: typeof session.token;
    id: number;
    key: string;
  }>();

  const targetFor = (entry: ListedPullRequest) => {
    const connection = repos.find(({ id }) => id === entry.repoId)?.connection;
    if (
      !connection ||
      (checkingGithub && connection.auth.kind === "gh") ||
      !reviewThreadsAllowed(connection)
    )
      return;
    const subject = { connection, repo: entry.repo, pr: entry.pr };
    if (githubReviewTarget(subject))
      return { kind: "github" as const, subject };
    const url = bitbucketReviewOriginal(subject);
    if (url) return { kind: "bitbucket" as const, url };
  };

  const selectedEntry =
    selection?.token === session.token
      ? entries.find((entry) => pullRequestRowKey(entry) === selection.key)
      : undefined;
  const selectedTarget = selectedEntry && targetFor(selectedEntry);
  if (selection?.token === session.token && !selectedTarget)
    setSelection(undefined);
  const active = selectedTarget ? selection : undefined;
  const latest = useLatestRef(active);
  const query = useQuery({
    queryKey: scmKeys.reviewThreads(context, instance, active?.id),
    enabled: !!active && selectedTarget?.kind === "github",
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: ({ signal }) => {
      if (selectedTarget?.kind !== "github" || !active)
        throw new Error("Keine aktuelle Reviewauswahl");
      return Effect.runPromise(
        readReviewThreads(
          selectedTarget.subject,
          () => session.isCurrent() && latest.current === active,
        ),
        { signal },
      );
    },
  });

  return {
    forEntry(entry: ListedPullRequest) {
      const target = targetFor(entry);
      if (!target) return;
      const key = pullRequestRowKey(entry);
      const open = active?.key === key;
      return {
        context,
        open,
        loading: open && target.kind === "github" && query.isPending,
        result: open ? query.data : undefined,
        error: open && query.isError ? reviewThreadsError(query.error) : null,
        fallback: target.kind === "bitbucket" ? target.url : undefined,
        onOpenChange: (next: boolean) => {
          if (!session.isCurrent()) return;
          if (next)
            setSelection({ token: session.token, id: ++sequence.current, key });
          else if (latest.current?.key === key) setSelection(undefined);
        },
      };
    },
  };
}

export type PullRequestReviewState = ReturnType<
  typeof usePullRequestReviewThreads
>;
