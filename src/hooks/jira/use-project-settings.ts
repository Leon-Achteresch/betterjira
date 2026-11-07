import { useNavigate } from "@tanstack/react-router";
import { useProjectDirectoryData } from "@/hooks/jira/use-project-directory-data";
import { useUrlText } from "@/hooks/search/use-url-text";
import { useProjectPrefs } from "@/lib/project-prefs";
import { jiraErrors } from "@/lib/jira/field-values";
import { projectMatchLabel, type ProjectSettingsSearch } from "@/lib/project-settings-search";

export function useProjectSettings(search: ProjectSettingsSearch) {
  const navigate = useNavigate({ from: "/settings/bereiche" });
  const query = useUrlText(search.q ?? "", (q) => void navigate({ search: (prev) => ({ ...prev, q: q || undefined }), replace: true }));
  const directory = useProjectDirectoryData({ query: query.text, view: "alle" });
  const toggleHidden = useProjectPrefs((state) => state.toggleHidden);

  return {
    ...directory,
    query: query.text,
    setQuery: query.setText,
    clearQuery: () => query.setText(""),
    toggleHidden,
    matchLabel: directory.loaded && directory.counts.alle > 0 ? projectMatchLabel(directory.entries.length, directory.counts.alle) : "",
    contentKey: directory.loadError ? "error" : directory.isPending ? "pending" : (directory.empty ?? "list"),
    loadErrorText: directory.loadError ? jiraErrors(directory.loadError).messages.join(" ") : "",
    refreshErrorText: directory.refreshError ? jiraErrors(directory.refreshError).messages.join(" ") : "",
  };
}

export type ProjectSettingsState = ReturnType<typeof useProjectSettings>;
