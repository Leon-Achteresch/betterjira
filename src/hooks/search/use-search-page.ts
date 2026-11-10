import { useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { useJiraSession } from "@/hooks/jira/use-jira-session";
import { useSimpleSearch } from "@/hooks/search/use-simple-search";
import { useJqlSearch } from "@/hooks/use-jql-search";
import { searchModeOf, withMode } from "@/lib/search/search-params";

export function useSearchPage() {
  const search = useSearch({ from: "/suche" });
  const navigate = useNavigate({ from: "/suche" });
  const mode = searchModeOf(search);
  const session = useJiraSession();
  const simple = useSimpleSearch(search);
  const jql = useJqlSearch(search.jql ?? "", mode === "jql", (next) =>
    void navigate({ search: (prev) => withMode({ ...prev, jql: next || undefined }, "jql") }),
  );

  return {
    mode,
    session,
    simple,
    jql,
    appliedJql: search.jql,
    stashedJql: mode === "einfach" ? search.jql : undefined,
    tabs: {
      einfach: mode === "einfach" ? search : withMode({ ...search, jql: jql.value.trim() || undefined }, "einfach"),
      jql: mode === "jql" ? search : withMode({ ...search, jql: search.jql ?? simple.generatedJql }, "jql"),
    },
    adoptJql: (composed: string) => void navigate({ search: (prev) => withMode({ ...prev, jql: composed }, "jql") }),
    discardStashedJql: () => {
      void navigate({ search: withMode({ ...search, jql: undefined }, "einfach") });
      toast("Gemerkte JQL verworfen", {
        action: { label: "Rückgängig", onClick: () => void navigate({ to: "/suche", search }) },
      });
    },
  };
}
