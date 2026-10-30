import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { toast } from "sonner";
import { deleteToken, saveToken, ScmError, scmKeys } from "@/lib/scm/client";
import { SCM_KIND_LABELS, type NewConnection, type ScmConnection } from "@/lib/scm/model";
import { providerFor } from "@/lib/scm/provider";
import { useScmSettings } from "./use-scm-settings";

const BITBUCKET_CLOUD_URL = "https://bitbucket.org";

const connectionFor = (input: NewConnection, id: string): ScmConnection => {
  const baseUrl = input.kind === "bitbucket-cloud" ? BITBUCKET_CLOUD_URL : input.baseUrl.trim().replace(/\/+$/, "");
  const host = new URL(baseUrl).host;
  return {
    id,
    kind: input.kind,
    label: input.kind === "bitbucket-cloud" ? SCM_KIND_LABELS[input.kind] : `${SCM_KIND_LABELS[input.kind]} · ${host}`,
    baseUrl,
    account: null,
    auth: { kind: "token", id, username: input.username.trim() || null },
  };
};

const connect = (input: NewConnection) =>
  Effect.gen(function* () {
    const id = crypto.randomUUID();
    const connection = yield* Effect.try({
      try: () => connectionFor(input, id),
      catch: (cause) => new ScmError({ message: "Bitte eine gültige URL angeben, z. B. https://bitbucket.firma.de", cause }),
    });
    yield* saveToken(id, input.token.trim(), new URL(connection.baseUrl).host);
    const account = yield* providerFor(connection.kind)
      .verify(connection)
      .pipe(Effect.tapError(() => deleteToken(id).pipe(Effect.ignore)));
    return { ...connection, account };
  });

export const useAddConnection = () => {
  const queryClient = useQueryClient();
  const addConnection = useScmSettings((state) => state.addConnection);
  return useMutation({
    mutationFn: (input: NewConnection) => Effect.runPromise(connect(input)),
    onSuccess: (connection) => {
      addConnection(connection);
      void queryClient.invalidateQueries({ queryKey: scmKeys.all });
      toast.success(`${connection.label} verbunden`);
    },
  });
};
