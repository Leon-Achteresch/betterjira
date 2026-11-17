import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useMultiTicketLinks,
  type MultiTicketLinksState,
} from "@/hooks/jira/use-multi-ticket-links";
import { jiraKeys } from "@/lib/jira/keys";
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: Infinity },
    mutations: { retry: 3 },
  },
});
export type MultiLinkQa = {
  state?: MultiTicketLinksState;
  old?: MultiTicketLinksState;
  scope: (cloudId: string, accountId: string, host?: string) => void;
  change?: (key: string, mounted?: boolean) => void;
};
const qa: MultiLinkQa = {
  scope: (cloudId, accountId, host = "https://example.atlassian.net") => {
    client.setQueryData(jiraKeys.site, {
      cloudId,
      siteUrl: host,
      siteName: "Synthetisch",
    });
    client.setQueryData(jiraKeys.myself, { accountId, displayName: accountId });
  },
};
qa.scope(
  new URLSearchParams(location.search).get("cloud") ?? "qa-cloud",
  "qa-user",
);
Object.assign(window, { __multiLinkQa: qa });
function State({ issueKey }: { issueKey: string }) {
  const state = useMultiTicketLinks(issueKey);
  qa.state = state;
  return (
    <output data-testid="state">
      {JSON.stringify({
        source: state.source,
        open: state.open,
        input: state.input,
        choiceId: state.choiceId,
        choices: state.choices,
        ready: state.canPreview,
        preview: state.preview,
        results: state.results,
        pending: state.pending,
        error: state.error,
        account: state.account,
      })}
    </output>
  );
}
function Fixture() {
  const [key, setKey] = useState("DEMO-4");
  const [mounted, setMounted] = useState(true);
  qa.change = (key, show = true) => {
    setKey(key);
    setMounted(show);
  };
  return mounted ? (
    <State issueKey={key} />
  ) : (
    <output data-testid="unmounted">unmounted</output>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <Fixture />
    </QueryClientProvider>
  </StrictMode>,
);
