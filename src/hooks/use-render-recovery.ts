import { useRouter, useRouterState } from "@tanstack/react-router";

export function useRenderRecovery() {
  const router = useRouter();
  const resetKey = useRouterState({ select: (state) => state.resolvedLocation?.href });
  const invalidateFailed = () => {
    if (router.state.matches.some((match) => match.status === "error"))
      void router.invalidate({ filter: (match) => match.status === "error" });
  };
  return { resetKey, invalidateFailed, reload: () => window.location.reload() };
}
