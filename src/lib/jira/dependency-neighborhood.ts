import { Cause, Data, Effect } from "effect";
import { JiraApiError, JiraRequestScopeChanged, NotAuthenticated, type JiraRequestScope } from "./client";
import { fetchIssueLinkData, readIssueLink, type IssueLinkDirection } from "./issue-links";

export const DEPENDENCY_LIMITS = { depth: 2, reads: 8, nodes: 20, edges: 40, linksPerRead: 200 } as const;

export type DependencyRelation = { typeId: string; direction: IssueLinkDirection };
type NodeState = "read" | "depth-limit" | "read-limit" | "forbidden" | "unavailable" | "missing-links";
type DependencyNode = { key: string; depth: number; via: string[]; state: NodeState };

export class DependencyContextChanged extends Data.TaggedError("DependencyContextChanged")<{}> {}

const ticketKey = (key: string) => {
  const normalized = key.trim().toUpperCase();
  return normalized.length <= 255 && /^[A-Z][A-Z0-9_]*-\d+$/.test(normalized) ? normalized : undefined;
};

export const readDependencyNeighborhood = (source: string, selection: DependencyRelation, scope: JiraRequestScope) =>
  Effect.gen(function* () {
    const root: DependencyNode = { key: ticketKey(source) ?? source, depth: 0, via: [], state: "read-limit" };
    const nodes = new Map([[root.key, root]]);
    let reads = 0;
    let edges = 0;
    let unreadable = 0;
    let rateLimited = false;
    const limits = { nodes: false, edges: false, linksPerRead: false };
    for (const node of nodes.values()) {
      if (!scope.isCurrent()) return yield* new DependencyContextChanged();
      if (node.depth >= DEPENDENCY_LIMITS.depth || reads >= DEPENDENCY_LIMITS.reads) continue;
      reads++;
      const read = yield* Effect.exit(fetchIssueLinkData(node.key, scope));
      if (!scope.isCurrent()) return yield* new DependencyContextChanged();
      if (read._tag === "Failure") {
        const error = Cause.squash(read.cause);
        if (error instanceof JiraRequestScopeChanged || error instanceof NotAuthenticated) return yield* new DependencyContextChanged();
        node.state = error instanceof JiraApiError && (error.status === 401 || error.status === 403) ? "forbidden" : "unavailable";
        if (error instanceof JiraApiError && error.status === 429) {
          rateLimited = true;
          break;
        }
        continue;
      }
      const links = read.value.fields.issuelinks;
      if (!links || !read.value.key || ticketKey(read.value.key) !== node.key) {
        node.state = "missing-links";
        continue;
      }
      node.state = "read";
      if (links.length > DEPENDENCY_LIMITS.linksPerRead) limits.linksPerRead = true;
      for (const raw of links.slice(0, DEPENDENCY_LIMITS.linksPerRead)) {
        const link = readIssueLink(raw);
        const key = link && ticketKey(link.key);
        if (!link?.typeId || !key) {
          unreadable++;
          continue;
        }
        if (link.typeId !== selection.typeId || link.direction !== selection.direction) continue;
        const existing = nodes.get(key);
        if (existing?.via.includes(node.key)) continue;
        if (!existing && nodes.size >= DEPENDENCY_LIMITS.nodes) {
          limits.nodes = true;
          continue;
        }
        if (edges >= DEPENDENCY_LIMITS.edges) {
          limits.edges = true;
          continue;
        }
        edges++;
        if (existing) existing.via.push(node.key);
        else {
          const depth = node.depth + 1;
          nodes.set(key, { key, depth, via: [node.key], state: depth === DEPENDENCY_LIMITS.depth ? "depth-limit" : "read-limit" });
        }
      }
    }
    return { nodes: [...nodes.values()], reads, edges, unreadable, limits, rateLimited };
  });

export type DependencyNeighborhood = Effect.Success<ReturnType<typeof readDependencyNeighborhood>>;
