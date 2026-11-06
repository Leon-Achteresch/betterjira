import { createFileRoute } from "@tanstack/react-router";
import { JqlSearch } from "@/components/search/jql-search";
import { SearchHeader } from "@/components/search/search-header";
import { SearchModePanel } from "@/components/search/search-mode-panel";
import { SearchModeTabs } from "@/components/search/search-mode-tabs";
import { SimpleSearch } from "@/components/search/simple-search";
import { LoginPrompt } from "@/components/shell/login-prompt";
import { SessionGate } from "@/components/shell/session-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchPage } from "@/hooks/search/use-search-page";
import { parseSucheSearch } from "@/lib/search/search-params";

export const Route = createFileRoute("/suche")({
  validateSearch: parseSucheSearch,
  component: Suche,
});

function Suche() {
  const page = useSearchPage();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-8">
      <SearchHeader mode={page.mode} connected={page.session.status === "connected"} />
      <SessionGate
        session={page.session}
        className="flex flex-col gap-6"
        pending={<Skeleton className="h-64 w-full" />}
        unconnected={<LoginPrompt description="Melde dich an, um zu suchen." />}
      >
        <SearchModeTabs mode={page.mode} targets={page.tabs} />
        <SearchModePanel mode={page.mode}>
          {page.mode === "jql" ? (
            <JqlSearch jql={page.appliedJql} search={page.jql} />
          ) : (
            <SimpleSearch
              search={page.simple}
              stashedJql={page.stashedJql}
              onDiscardStashedJql={page.discardStashedJql}
              onAdoptJql={page.adoptJql}
            />
          )}
        </SearchModePanel>
      </SessionGate>
    </div>
  );
}
