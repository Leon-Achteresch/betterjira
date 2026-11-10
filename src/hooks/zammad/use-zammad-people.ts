import { useMemo } from "react";
import { useQueries, queryOptions } from "@tanstack/react-query";
import { Effect } from "effect";
import { getUser } from "@/lib/zammad/api";
import { zammadKeys } from "@/lib/zammad/keys";
import { getAvatar, personFromUser } from "@/lib/zammad/people";
import type { Person } from "@/lib/zammad/people";

export const personOptions = (id: number) =>
  queryOptions({
    queryKey: zammadKeys.person(id),
    queryFn: ({ signal }) => Effect.runPromise(getUser(id), { signal }),
    staleTime: 300_000,
    retry: false,
  });
export const useZammadPeople = (
  input: readonly (number | null | undefined)[],
) => {
  const ids = [...new Set(input.filter((id): id is number => !!id && id > 1))];
  const users = useQueries({
    queries: ids.map(personOptions),
    combine: (results) => results.map((query) => query.data),
  });
  const hashes = [
    ...new Set(users.flatMap((user) => (user?.image ? [user.image] : []))),
  ];
  const avatars = useQueries({
    combine: (results) => results.map((query) => query.data),
    queries: hashes.map((hash) => ({
      queryKey: zammadKeys.avatar(hash),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        Effect.runPromise(getAvatar(hash), { signal }),
      staleTime: Infinity,
      retry: false as const,
    })),
  });
  const images = new Map(hashes.map((hash, index) => [hash, avatars[index]]));
  return useMemo(
    () =>
      new Map<number, Person>(
        users.flatMap((user) =>
          user
            ? [
                [
                  user.id,
                  personFromUser(user, images.get(user.image ?? "")),
                ] as const,
              ]
            : [],
        ),
      ),
    [users, avatars],
  );
};
