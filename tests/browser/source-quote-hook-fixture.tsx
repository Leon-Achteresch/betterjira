import { StrictMode, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useHelpdeskDetail,
  type HelpdeskDetailModel,
} from "@/hooks/zammad/use-helpdesk-detail";
import { zammadKeys } from "@/lib/zammad/keys";
import { articleQuoteText } from "@/lib/zammad/source-quote";
import { clearZammadDrafts } from "@/hooks/zammad/use-zammad-draft";
import type { Article, Connection, User } from "@/lib/zammad/model";

const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});
export type QuoteQa = {
  model?: HelpdeskDetailModel;
  old?: HelpdeskDetailModel;
  scope: (host: string, userId: number) => void;
  change?: (id: string, mounted?: boolean) => void;
  source: (id: number, body: string) => void;
  text: typeof articleQuoteText;
  clear: () => void;
  submit: (model: HelpdeskDetailModel) => void;
};
const qa: QuoteQa = {
  scope: (baseUrl, id) => {
    client.setQueryData<Connection>(zammadKeys.connection, {
      baseUrl,
      revision: "0",
    });
    client.setQueryData<User>(zammadKeys.user, { id });
  },
  source: (id, body) =>
    client.setQueryData(
      zammadKeys.articles(41),
      (articles: readonly Article[] | undefined) =>
        articles?.map((article) =>
          article.id === id ? { ...article, body } : article,
        ),
    ),
  text: articleQuoteText,
  clear: clearZammadDrafts,
  submit: (model) => {
    const form = document.createElement("form");
    const body = document.createElement("textarea");
    body.name = "body";
    body.value = model.body;
    form.append(body);
    model.onArticle({
      preventDefault: () => undefined,
      currentTarget: form,
    } as FormEvent<HTMLFormElement>);
  },
};
qa.scope("https://helpdesk.example.com", 3);
Object.assign(window, { __quoteQa: qa });

function Detail({ id }: { id: string }) {
  const model = useHelpdeskDetail(id);
  qa.model = model;
  return (
    <output data-testid="model">
      {JSON.stringify({
        id: model.ticket?.id,
        ready: model.quote.available && model.articles.length > 0,
        active: model.quote.active,
        selected: model.quote.selectedId,
        preview: model.quote.preview?.excerpt,
        body: model.body,
        error: model.quote.error,
      })}
    </output>
  );
}
function Fixture() {
  const [id, setId] = useState("41");
  const [mounted, setMounted] = useState(true);
  qa.change = (id, visible = true) => {
    setId(id);
    setMounted(visible);
  };
  return mounted ? (
    <Detail id={id} />
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
