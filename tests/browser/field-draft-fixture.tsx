import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useFieldDraft } from "@/hooks/use-field-draft";
import { useFieldDraftStore } from "@/hooks/use-field-drafts";
import { jiraKeys } from "@/lib/jira/keys";

type Options = Parameters<typeof useFieldDraft>[0];
type Editor = ReturnType<typeof useFieldDraft>;
export type FieldDraftQa = {
  editor?: Editor;
  captured?: Editor;
  change?: (options: Partial<Options>, mounted?: boolean) => void;
  scope: (cloudId: string, accountId: string) => void;
  client: QueryClient;
  store: typeof useFieldDraftStore;
  closes: string[];
  pending?: Promise<void>;
};

const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
const qa: FieldDraftQa = {
  client,
  store: useFieldDraftStore,
  closes: [],
  scope: (cloudId, accountId) => {
    client.setQueryData(jiraKeys.site, { cloudId, siteUrl: "https://example.atlassian.net" });
    client.setQueryData(jiraKeys.myself, { accountId });
  },
};
qa.scope("qa-cloud", "qa-user");
Object.assign(window, { __fieldDraftQa: qa });

function EditorHarness({ options }: { options: Options }) {
  const editor = useFieldDraft(options);
  qa.editor = editor;
  return <output data-testid="editor">{JSON.stringify({ text: editor.text, pending: editor.pending, comparison: editor.comparison, notice: editor.notice })}</output>;
}

function Fixture() {
  const [options, setOptions] = useState<Options>({
    issueKey: "DEMO-1", issueId: "1", field: "description", mode: "adf",
    initial: JSON.stringify({ type: "doc", version: 1, content: [{ type: "paragraph" }] }),
    initialRaw: { type: "doc", version: 1, content: [{ type: "paragraph" }] },
    onClose: () => qa.closes.push("DEMO-1"),
  });
  const [mounted, setMounted] = useState(true);
  qa.change = (patch, visible = true) => {
    setOptions((previous) => ({ ...previous, ...patch }));
    setMounted(visible);
  };
  return <>{mounted && <EditorHarness options={options} />}<Toaster /></>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><QueryClientProvider client={client}><Fixture /></QueryClientProvider></StrictMode>);
