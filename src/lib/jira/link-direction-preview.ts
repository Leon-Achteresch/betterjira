import { Data, Effect } from "effect";
import {
  JiraApiError,
  JiraRequestScopeChanged,
  NotAuthenticated,
  type JiraRequestScope,
} from "./client";
import {
  confirmsDirectedLink,
  fetchIssueLinkData,
  oppositeLinkDirection,
  type IssueLinkReference,
} from "./issue-links";
import { readJiraAccount } from "./query-scope";

class LinkDirectionUnconfirmed extends Data.TaggedError(
  "LinkDirectionUnconfirmed",
)<{}> {}

const normalizeKey = (key: string) => key.trim().toUpperCase();
const validKey = (key: string) =>
  key.length <= 255 && /^[A-Z][A-Z0-9_]*-\d+$/.test(key);

export const readLinkDirectionPreview = (
  sourceKey: string,
  targetKey: string,
  reference: IssueLinkReference,
  accountId: string,
  scope: JiraRequestScope,
) =>
  Effect.gen(function* () {
    const source = normalizeKey(sourceKey);
    const target = normalizeKey(targetKey);
    const labels = reference.directed;
    if (!labels || !validKey(source) || !validKey(target) || source === target)
      return yield* new LinkDirectionUnconfirmed();

    const checkAccount = Effect.gen(function* () {
      const account = yield* readJiraAccount(scope, false);
      if (account.accountId !== accountId || !scope.isCurrent())
        return yield* new JiraRequestScopeChanged();
    });
    const confirmEndpoint = (
      key: string,
      linked: string,
      direction: IssueLinkReference["direction"],
    ) =>
      Effect.gen(function* () {
        const ticket = yield* fetchIssueLinkData(key, scope);
        if (
          normalizeKey(ticket.key ?? "") !== key ||
          !confirmsDirectedLink(ticket.fields.issuelinks ?? [], linked, {
            ...reference,
            direction,
          })
        )
          return yield* new LinkDirectionUnconfirmed();
      });

    const opposite = oppositeLinkDirection(reference.direction);
    yield* checkAccount;
    yield* confirmEndpoint(source, target, reference.direction);
    yield* confirmEndpoint(target, source, opposite);
    yield* checkAccount;

    return {
      typeId: reference.typeId,
      typeName: reference.typeName.trim(),
      current: [
        { from: source, label: labels[reference.direction], to: target },
        { from: target, label: labels[opposite], to: source },
      ],
      reversed: [
        { from: source, label: labels[opposite], to: target },
        { from: target, label: labels[reference.direction], to: source },
      ],
    };
  });

export type LinkDirectionPreview = Effect.Success<
  ReturnType<typeof readLinkDirectionPreview>
>;

export function linkDirectionPreviewError(error: unknown) {
  if (error instanceof JiraRequestScopeChanged)
    return "Der Ticket-, Konto- oder Websitekontext hat sich geändert.";
  if (error instanceof LinkDirectionUnconfirmed)
    return "Die gerichtete Beziehung konnte auf beiden Tickets nicht eindeutig bestätigt werden.";
  if (
    error instanceof NotAuthenticated ||
    (error instanceof JiraApiError && [401, 403, 404].includes(error.status))
  )
    return "Mindestens ein Ticket ist für dieses Konto nicht lesbar.";
  return "Die Richtungsvorschau konnte nicht geladen werden.";
}
