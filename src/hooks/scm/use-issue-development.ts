import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { scmKeys } from "@/lib/scm/client";
import { loadDevelopment } from "@/lib/scm/development";
import { useScmConnections } from "./use-scm-connections";
import { useRepoLinks } from "./use-scm-settings";

export const useIssueDevelopment = (issueKey: string, projectKey: string | undefined) => {
  const links = useRepoLinks(projectKey);
  const { connections, gh } = useScmConnections();
  const query = useQuery({
    queryKey: scmKeys.development(issueKey, links),
    queryFn: ({ signal }) => Effect.runPromise(loadDevelopment(issueKey, links, connections), { signal }),
    enabled: links.length > 0 && !gh.isPending,
    staleTime: 60_000,
  });
  return { query, links, connections, connectionsReady: !gh.isPending };
};
