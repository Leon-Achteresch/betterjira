import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useIssueHistory, type IssueHistoryState } from "@/hooks/jira/use-issue-history";
import { jiraKeys } from "@/lib/jira/keys";
import fixture from "../jira/fixtures/status-intervals.json";

const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
export type HistoryQa = {
  state?: IssueHistoryState;
  previous?: IssueHistoryState;
  scope: (cloudId: string, accountId: string) => void;
  change?: (key: string, mounted?: boolean) => void;
};
const qa: HistoryQa = {
  scope: (cloudId, accountId) => {
    client.setQueryData(jiraKeys.site, { cloudId });
    client.setQueryData(jiraKeys.myself, { accountId });
  },
};
qa.scope("qa-cloud", "qa-user");
Object.assign(window, { __historyQa: qa });

function History({ issueKey }: { issueKey: string }) {
  const state = useIssueHistory(issueKey, { created: fixture.created, status: fixture.current });
  qa.state = state;
  return <output data-testid="hook">{JSON.stringify({ open: state.open, total: state.history?.total, selected: state.statusIntervals?.selectedKey })}</output>;
}

function Fixture() {
  const [issueKey, setIssueKey] = useState("DEMO-1");
  const [mounted, setMounted] = useState(true);
  qa.change = (key, visible = true) => { setIssueKey(key); setMounted(visible); };
  return mounted ? <History issueKey={issueKey} /> : <output data-testid="unmounted">unmounted</output>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><QueryClientProvider client={client}><Fixture /></QueryClientProvider></StrictMode>);
