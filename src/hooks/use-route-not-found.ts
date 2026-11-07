import { useCanGoBack, useRouter } from "@tanstack/react-router";

export function useRouteNotFound() {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  return {
    canGoBack,
    goBack: () => router.history.back(),
    goHome: () => void router.navigate({ to: "/" }),
  };
}
