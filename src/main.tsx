import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JiraApiError, NotAuthenticated } from "@/lib/jira/client";
import { jiraKeys } from "@/lib/jira/queries";
import { routeTree } from "./routeTree.gen";
import "./index.css";

const resetOnLogout = (error: unknown) => {
  if (error instanceof NotAuthenticated) void queryClient.resetQueries({ queryKey: jiraKeys.site });
};

const isPermanent = (error: unknown) =>
  error instanceof NotAuthenticated || (error instanceof JiraApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429);

const queryClient: QueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => failureCount < 2 && !isPermanent(error),
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
