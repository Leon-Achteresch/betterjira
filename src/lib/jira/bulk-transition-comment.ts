import { Effect, Schema } from "effect";
import { textToAdf } from "./adf";
import { jira, JiraApiError, JiraRequestScopeChanged, NotAuthenticated, type JiraRequestScope } from "./client";
import { MyPermissions } from "./comment-permissions";
import { readIssueTransitions, sendIssueTransition, transitionComment, type JiraTransition } from "./issue-transitions";
import { readJiraAccount, type JiraQueryScope } from "./query-scope";
import { JiraStatus } from "./status";
import { bulkTransitionCommentAllowed } from "@/lib/jira/bulk-transition-comment-capability";

export const BULK_TRANSITION_LIMIT = 20;
export const BULK_TRANSITION_COMMENT_LIMIT = 4000;

export type BulkTransitionTarget = { key: string; id: string };

export const validBulkTransitionTargets = (targets: readonly BulkTransitionTarget[]) =>
  targets.length > 0 && targets.length <= BULK_TRANSITION_LIMIT
  && targets.every(({ id, key }) => !!id.trim() && !!key.trim())
  && new Set(targets.map(({ id }) => id)).size === targets.length
  && new Set(targets.map(({ key }) => key)).size === targets.length;
const IssueStatus = Schema.Struct({ id: Schema.String, key: Schema.String, fields: Schema.Struct({ status: JiraStatus }) });
const permissionKeys = ["TRANSITION_ISSUES", "ADD_COMMENTS"] as const;
const requiredFields = (transition: JiraTransition) =>
  Object.entries(transition.fields ?? {}).filter(([, field]) => field.required).map(([id, { name }]) => name.trim() || id);

const readResult = <A, E>(effect: Effect.Effect<A, E>) => effect.pipe(
  Effect.match({
    onSuccess: (data) => ({ data, denied: false }),
    onFailure: (error) => ({ data: undefined, denied: error instanceof JiraApiError && [401, 403].includes(error.status) }),
  }),
);

const readTicket = (target: BulkTransitionTarget, scope: JiraRequestScope) => Effect.gen(function* () {
  const init = { scope, cache: "no-store" } as const;
  const permissions = new URLSearchParams({ issueKey: target.key, permissions: permissionKeys.join(",") });
  const { issue, transitions, rights } = yield* Effect.all({
    issue: readResult(jira(`/issue/${encodeURIComponent(target.key)}?fields=status`, IssueStatus, init)),
    transitions: readResult(readIssueTransitions(target.key, scope)),
    rights: readResult(jira(`/mypermissions?${permissions}`, MyPermissions, init)),
  }, { concurrency: 2 });
  const current = issue.data?.fields.status;
  let reason: string | undefined;
  if (issue.denied || transitions.denied || rights.denied) reason = "Jira verweigert den Zugriff.";
  else if (!issue.data) reason = "Vorgang oder aktueller Status konnte nicht gelesen werden.";
  else if (issue.data.id !== target.id || issue.data.key !== target.key) reason = "Die Vorgangszuordnung hat sich geändert.";
  else if (!transitions.data) reason = "Übergangsmetadaten konnten nicht gelesen werden.";
  else if (!rights.data || permissionKeys.some((key) => !rights.data?.permissions[key])) reason = "Rechte zum Übergang oder Kommentieren sind unbekannt.";
  else if (!rights.data.permissions.TRANSITION_ISSUES?.havePermission) reason = "Recht zum Statuswechsel fehlt.";
  else if (!rights.data.permissions.ADD_COMMENTS?.havePermission) reason = "Recht zum Kommentieren fehlt.";
  return { target, current, transitions: transitions.data?.transitions ?? [], reason };
});

type Ticket = Effect.Success<ReturnType<typeof readTicket>>;
type BulkTransitionStatus = { id: string; label: string };
export type BulkTransitionRow = {
  target: BulkTransitionTarget;
  current?: string;
  fields: readonly { name: string; required: readonly string[] }[];
  eligible?: { issueStatusId: string; transition: JiraTransition };
  reason?: string;
};

const isCompletion = (transition: JiraTransition) => transition.to.statusCategory.key === "done" && !!transition.to.id.trim();

export const completionStatuses = (tickets: readonly Ticket[]): BulkTransitionStatus[] => {
  const destinations = tickets.flatMap(({ transitions }) => transitions.filter(isCompletion).map(({ to }) => to));
  const statuses = [...new Map(destinations.map((status) => [status.id, status])).values()];
  const nameCounts = new Map<string, number>();
  for (const { name } of statuses) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  return statuses.map(({ id, name }) => ({ id, label: nameCounts.get(name) === 1 ? name : `${name} · ID ${id}` }));
};

const reviewTicket = (ticket: Ticket, statusId: string): BulkTransitionRow => {
  const { target, current, transitions } = ticket;
  const matching = transitions.filter((transition) => isCompletion(transition) && transition.to.id === statusId);
  const candidates = matching.filter(({ isAvailable }) => isAvailable !== false);
  const [transition] = candidates;
  const overview = { target, current: current?.name, fields: matching.map((candidate) => ({
    name: candidate.name, required: requiredFields(candidate),
  })) };
  if (!statusId) return { ...overview, reason: ticket.reason };
  let reason = ticket.reason;
  if (!reason) {
    if (!current?.id.trim()) reason = "Aktueller Status ist unbekannt.";
    else if (current.id === statusId) reason = "Vorgang ist bereits im Zielstatus.";
    else if (!transition) reason = "Kein verfügbarer Übergang in diesen Zielstatus.";
    else if (candidates.length > 1) reason = "Mehrere Übergänge in diesen Zielstatus.";
    else if (!transition.id.trim() || !transition.name.trim() || !transition.to.name.trim() || !transition.fields) reason = "Übergangsmetadaten sind unvollständig.";
    else if (transition.isConditional) reason = "Bedingter Übergang. Bitte im Einzelvorgang prüfen.";
    else if (requiredFields(transition).length) reason = "Pflichtangaben im Einzelvorgang prüfen.";
  }
  if (reason || !current || !transition) return { ...overview, reason };
  return { ...overview, eligible: { issueStatusId: current.id, transition } };
};

export const readBulkCompletion = (targets: readonly BulkTransitionTarget[], scope: JiraRequestScope) =>
  Effect.forEach(targets, (target) => readTicket(target, scope), { concurrency: 2 });

export const reviewBulkCompletion = (tickets: readonly Ticket[], statusId: string) => tickets.map((ticket) => reviewTicket(ticket, statusId));

export type BulkTransitionResult = { key: string; status: "changed" | "skipped" | "failed" | "uncertain" | "context-lost"; message: string };

const transitionSnapshot = ({ issueStatusId, transition }: NonNullable<BulkTransitionRow["eligible"]>) =>
  JSON.stringify([issueStatusId, transition.id, transition.name, transition.to.id, transition.to.name,
    Object.entries(transition.fields ?? {}).sort(([left], [right]) => left.localeCompare(right))]);

const performTransition = (
  row: BulkTransitionRow,
  statusId: string,
  comment: string,
  account: JiraQueryScope,
  scope: JiraRequestScope,
): Effect.Effect<BulkTransitionResult> => Effect.gen(function* () {
  const skipped = (message: string): BulkTransitionResult => ({ key: row.target.key, status: "skipped", message });
  const contextLost = (): BulkTransitionResult => ({ key: row.target.key, status: "context-lost", message: "Jira-Konto oder Kontext konnte nicht erneut bestätigt werden." });
  if (!row.eligible) return skipped(row.reason ?? "Vorgang ist nicht freigegeben.");
  const fresh = reviewTicket(yield* readTicket(row.target, scope), statusId);
  if (!scope.isCurrent()) return contextLost();
  if (!fresh.eligible || transitionSnapshot(fresh.eligible) !== transitionSnapshot(row.eligible))
    return skipped(fresh.reason ?? "Status oder Übergang hat sich geändert. Bitte neu prüfen.");
  const currentAccount = yield* readJiraAccount(scope).pipe(Effect.option);
  if (currentAccount._tag === "None" || currentAccount.value.accountId !== account.accountId || !scope.isCurrent())
    return contextLost();
  return yield* sendIssueTransition(row.target.key, {
    transition: { id: fresh.eligible.transition.id },
    update: transitionComment(textToAdf(comment)),
  }, { scope, retry: false }).pipe(Effect.match({
    onSuccess: (): BulkTransitionResult => ({ key: row.target.key, status: "changed", message: "Von Jira bestätigt." }),
    onFailure: (error): BulkTransitionResult => {
      if (error instanceof JiraRequestScopeChanged || error instanceof NotAuthenticated) return contextLost();
      if (error instanceof JiraApiError && error.status >= 400 && error.status < 500 && error.status !== 408)
        return { key: row.target.key, status: "failed", message: `Jira meldet HTTP ${error.status}.` };
      return { key: row.target.key, status: "uncertain", message: "Serverstand prüfen, bevor du erneut abschließt." };
    },
  }));
});

export const applyBulkCompletion = (
  rows: readonly BulkTransitionRow[], statusId: string, comment: string,
  account: JiraQueryScope, siteUrl: string, scope: JiraRequestScope,
  onResult: (result: BulkTransitionResult) => void,
) => Effect.gen(function* () {
  let stoppedAfter: "uncertain" | "context-lost" | undefined;
  const valid = validBulkTransitionTargets(rows.map(({ target }) => target))
    && !!comment.trim() && comment.length <= BULK_TRANSITION_COMMENT_LIMIT;
  const guarded = { ...scope, isCurrent: () => scope.isCurrent() && bulkTransitionCommentAllowed(account, siteUrl) };
  for (const row of rows) {
    const result: BulkTransitionResult = valid && !stoppedAfter && guarded.isCurrent()
      ? yield* performTransition(row, statusId, comment, account, guarded)
      : { key: row.target.key, status: "skipped", message: row.reason ?? (stoppedAfter === "uncertain"
          ? "Nach unklarer Antwort gestoppt. Nichts gesendet."
          : "Freigabe oder Auswahlkontext fehlt. Nichts gesendet.") };
    if (result.status === "uncertain" || result.status === "context-lost") stoppedAfter = result.status;
    yield* Effect.sync(() => onResult(result));
  }
});
