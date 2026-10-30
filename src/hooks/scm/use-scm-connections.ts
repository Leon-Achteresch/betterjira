import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { ghConnections, scmKeys } from "@/lib/scm/client";
import { useScmSettings } from "./use-scm-settings";

export const useGhConnections = () =>
  useQuery({
    queryKey: scmKeys.ghHosts,
    queryFn: ({ signal }) => Effect.runPromise(ghConnections, { signal }),
    staleTime: 5 * 60_000,
    retry: false,
  });

export const useScmConnections = () => {
  const gh = useGhConnections();
  const stored = useScmSettings((state) => state.connections);
  const connections = useMemo(() => [...(gh.data ?? []), ...stored], [gh.data, stored]);
  return { connections, gh };
};
