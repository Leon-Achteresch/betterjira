import { useDebouncedValue } from "@tanstack/react-pacer";
import { useNavigate } from "@tanstack/react-router";
import { useUrlText } from "@/hooks/search/use-url-text";
import { useJiraProjects } from "@/lib/jira/queries";
import type { SucheSearch } from "@/lib/search/search-params";
import { simpleSearchJql } from "@/lib/search/simple-jql";

export type SimpleSearchStatus = "ready" | "pending" | "missing" | "error";

export function useSimpleSearch(search: SucheSearch) {
  const navigate = useNavigate({ from: "/suche" });
  const projects = useJiraProjects();
  const text = useUrlText(search.q ?? "", (q) => void navigate({ search: (prev) => ({ ...prev, q: q || undefined }), replace: true }));
  const [debouncedText] = useDebouncedValue(text.text, { wait: 300 });

  const project = search.projekt ? projects.data?.find((entry) => entry.key === search.projekt) : undefined;
  const status: SimpleSearchStatus =
    !search.projekt || project ? "ready" : projects.isPending ? "pending" : projects.isError ? "error" : "missing";

  return {
    status,
    projectKey: search.projekt,
    projects: projects.data ?? [],
    projectsPending: projects.isPending,
    retryingProjects: projects.isFetching,
    jql: simpleSearchJql(project?.key, debouncedText),
    generatedJql: simpleSearchJql(search.projekt, text.text),
    text: { value: text.text, onChange: text.setText, placeholder: "Alle Vorgänge durchsuchen" },
    selectProject: (key: string | undefined) => void navigate({ search: (prev) => ({ ...prev, projekt: key }) }),
    retryProjects: () => void projects.refetch(),
  };
}

export type SimpleSearchState = ReturnType<typeof useSimpleSearch>;
