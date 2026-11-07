import { useNavigate } from "@tanstack/react-router";
import { useProjectDirectory } from "@/hooks/jira/use-project-directory";
import { useUrlText } from "@/hooks/search/use-url-text";
import { useProjectPrefs } from "@/lib/project-prefs";
import type { ProjectSettingsSearch } from "@/lib/project-settings-search";

export function useProjectSettings(search: ProjectSettingsSearch) {
  const navigate = useNavigate({ from: "/settings/bereiche" });
  const query = useUrlText(search.q ?? "", (q) => void navigate({ search: (prev) => ({ ...prev, q: q || undefined }), replace: true }));
  const directory = useProjectDirectory({ query: query.text, view: "alle" });
  const toggleHidden = useProjectPrefs((state) => state.toggleHidden);

  return { ...directory, query: query.text, setQuery: query.setText, toggleHidden };
}

export type ProjectSettingsState = ReturnType<typeof useProjectSettings>;
