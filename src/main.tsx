import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotAuthenticated } from "@/lib/jira/client";
import { jiraKeys } from "@/lib/jira/queries";
import { shouldRetryQuery } from "@/lib/jira/retry-policy";
import { routeTree } from "./routeTree.gen";
import "./index.css";

const resetOnLogout = (error: unknown) => {
  if (!(error instanceof NotAuthenticated)) return;
  void queryClient.resetQueries({ queryKey: jiraKeys.site });
  void queryClient.resetQueries({ queryKey: jiraKeys.myself, exact: true });
};

const queryClient: QueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: shouldRetryQuery,
    },
  },
  queryCache: new QueryCache({ onError: resetOnLogout }),
  mutationCache: new MutationCache({ onError: resetOnLogout }),
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  scrollRestoration: true,
  scrollToTopSelectors: ["#app-scroll"],
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
