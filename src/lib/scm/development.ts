import { Effect } from "effect";
import type { PullRequest, RepoDevelopment, RepoLink, ScmBranch, ScmConnection } from "./model";
import { providerFor } from "./provider";

export type DevelopmentRepo = {
  id: string;
  repo: string;
  pullRequests: PullRequest[];
  branches: ScmBranch[];
  error: string | null;
};

export type DevelopmentStatus = "loading" | "unconfigured" | "unlinked" | "ready";

export type RepoDevelopmentEntry = {
  link: RepoLink;
  connection: ScmConnection | null;
  development: RepoDevelopment | null;
  error: string | null;
};

export const loadDevelopment = (issueKey: string, links: readonly RepoLink[], connections: readonly ScmConnection[]) =>
  Effect.forEach(
    links,
    (link) => {
      const connection = connections.find(({ id }) => id === link.connectionId) ?? null;
      if (!connection) {
        return Effect.succeed<RepoDevelopmentEntry>({ link, connection, development: null, error: "Verbindung nicht mehr vorhanden" });
      }
      return providerFor(connection.kind)
        .development(connection, link.repo, issueKey)
        .pipe(
          Effect.match({
            onSuccess: (development): RepoDevelopmentEntry => ({ link, connection, development, error: null }),
            onFailure: (error): RepoDevelopmentEntry => ({ link, connection, development: null, error: error.message }),
          }),
        );
    },
    { concurrency: 4 },
  );

export const branchesWithoutPullRequest = ({ branches, pullRequests }: RepoDevelopment): ScmBranch[] =>
  branches.filter((branch) => !pullRequests.some((pr) => pr.source === branch.name));

export const repoLinkId = (link: RepoLink) => `${link.connectionId}::${link.repo}`;

const OPEN_STATES = new Set(["open", "draft"]);

export const sortPullRequests = (pullRequests: readonly PullRequest[]) =>
  [...pullRequests].sort(
    (a, b) => Number(OPEN_STATES.has(b.state)) - Number(OPEN_STATES.has(a.state)) || b.updatedAt.localeCompare(a.updatedAt),
  );
