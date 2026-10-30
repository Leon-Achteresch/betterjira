import { useState } from "react";
import { useJiraProjects } from "@/lib/jira/queries";
import { repoLinkId } from "@/lib/scm/development";
import type { NewConnection } from "@/lib/scm/model";
import { useAddConnection } from "./use-add-connection";
import { useRemoveConnection } from "./use-remove-connection";
import { useScmConnections } from "./use-scm-connections";
import { useScmRepos } from "./use-scm-repos";
import { useScmSettings } from "./use-scm-settings";

export const useCodeHostingSettings = () => {
  const { connections, gh } = useScmConnections();
  const projects = useJiraProjects();
  const repoLinks = useScmSettings((state) => state.repoLinks);
  const linkRepo = useScmSettings((state) => state.linkRepo);
  const unlinkRepo = useScmSettings((state) => state.unlinkRepo);
  const add = useAddConnection();
  const remove = useRemoveConnection();
  const [addOpen, setAddOpen] = useState(false);
  const [projectKey, setProjectKey] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [repo, setRepo] = useState("");
  const selectedConnection = connections.find(({ id }) => id === connectionId);
  const repos = useScmRepos(selectedConnection);

  const projectName = (key: string) => projects.data?.find((project) => project.key === key)?.name ?? key;
  const connectionLabel = (id: string) => connections.find((connection) => connection.id === id)?.label ?? "Verbindung fehlt";

  return {
    connections: {
      connections: connections.map((connection) => ({
        id: connection.id,
        label: connection.label,
        account: connection.account,
        viaCli: connection.auth.kind === "gh",
      })),
      cliLoading: gh.isPending,
      cliError: gh.error?.message ?? null,
      removingId: remove.isPending ? (remove.variables ?? null) : null,
      onRemove: (id: string) => remove.mutate(id),
      onAdd: () => {
        add.reset();
        setAddOpen(true);
      },
    },
    addDialog: {
      open: addOpen,
      onOpenChange: setAddOpen,
      pending: add.isPending,
      error: add.error?.message ?? null,
      onSubmit: (input: NewConnection) => add.mutate(input, { onSuccess: () => setAddOpen(false) }),
    },
    repoLinks: {
      projects: (projects.data ?? []).map((project) => ({ value: project.key, label: project.name })),
      connections: connections.map((connection) => ({ value: connection.id, label: connection.label })),
      projectKey,
      connectionId,
      repo,
      repos: repos.data ?? [],
      reposLoading: repos.isFetching,
      reposError: repos.error?.message ?? null,
      groups: Object.entries(repoLinks)
        .filter(([, links]) => links.length > 0)
        .map(([key, links]) => ({
          projectKey: key,
          projectName: projectName(key),
          links: links.map((link) => ({ id: repoLinkId(link), repo: link.repo, source: connectionLabel(link.connectionId) })),
        })),
      onProjectChange: setProjectKey,
      onConnectionChange: (id: string) => {
        setConnectionId(id);
        setRepo("");
      },
      onRepoChange: setRepo,
      onLink: () => {
        linkRepo(projectKey, { connectionId, repo });
        setRepo("");
      },
      onUnlink: (key: string, id: string) => {
        const link = repoLinks[key]?.find((candidate) => repoLinkId(candidate) === id);
        if (link) unlinkRepo(key, link);
      },
    },
  };
};
