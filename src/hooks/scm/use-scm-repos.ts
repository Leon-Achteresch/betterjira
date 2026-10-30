import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { scmKeys } from "@/lib/scm/client";
import type { ScmConnection } from "@/lib/scm/model";
import { providerFor } from "@/lib/scm/provider";

export const useScmRepos = (connection: ScmConnection | undefined) =>
  useQuery({
    queryKey: scmKeys.repos(connection?.id ?? ""),
    queryFn: ({ signal }) => Effect.runPromise(providerFor(connection!.kind).repos(connection!), { signal }),
    enabled: !!connection,
    staleTime: 10 * 60_000,
  });
