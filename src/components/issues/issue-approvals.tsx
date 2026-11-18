import { Fade } from "@/components/motion/fade";
import { Skeleton } from "@/components/ui/skeleton";
import type { IssueApprovals } from "@/lib/jira/issue-approvals";

export function IssueApprovalsContent({
  page,
  error,
  loading,
}: {
  page?: IssueApprovals;
  error: string | null;
  loading: boolean;
}) {
  if (loading)
    return (
      <Fade>
        <div
          role="status"
          aria-label="Freigaben werden geprüft"
          className="space-y-2"
        >
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </Fade>
    );
  if (error)
    return (
      <Fade>
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      </Fade>
    );
  if (!page) return null;

  return (
    <Fade>
      {page.stages.length > 0 && (
        <ul
          aria-label="Gemeldete Freigabestufen"
          className="m-0 divide-y divide-border/60 rounded-2xl border border-border/60"
        >
          {page.stages.map(({ id, name, decision, names, moreNames }) => (
            <li
              key={id}
              className="space-y-1 px-3 py-2.5 text-sm wrap-anywhere"
            >
              <h3 className="font-medium">{name}</h3>
              <p className="text-muted-foreground">
                Status <span className="text-foreground">{decision}</span>
              </p>
              {names.length > 0 && (
                <p className="text-muted-foreground">
                  Entscheider{" "}
                  <span className="text-foreground">{names.join(", ")}</span>
                  {moreNames && " · Weitere Namen in der Antwort"}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {page.partial && (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          Teilansicht. Nur die erste Seite wurde geprüft.
        </p>
      )}
      {!page.partial && page.stages.length === 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          JSM meldet keine Freigabestufen für diese Anfrage.
        </p>
      )}
    </Fade>
  );
}
