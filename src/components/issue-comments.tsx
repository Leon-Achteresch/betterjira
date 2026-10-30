import { useState, type FormEvent } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";
import { AdfContent } from "@/components/adf-content";
import { JiraUserLabel } from "@/components/jira-user-avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useJiraAddComment } from "@/lib/jira/issue";
import type { JiraIssueDetail } from "@/lib/jira/queries";

type Comment = NonNullable<JiraIssueDetail["fields"]["comment"]>["comments"][number];

export function IssueComments({ issueKey, comments }: { issueKey: string; comments: readonly Comment[] }) {
  const add = useJiraAddComment(issueKey);
  const [draft, setDraft] = useState("");

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (draft.trim()) add.mutate(draft.trim(), { onSuccess: () => setDraft("") });
  };

  return (
    <div className="flex flex-col gap-6">
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Kommentare.</p>
      ) : (
        <ol className="flex flex-col gap-6">
          {comments.map((comment) => (
            <li key={comment.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm">
                <JiraUserLabel user={comment.author} />
                <span className="text-xs text-muted-foreground" title={new Date(comment.created).toLocaleString("de-DE")}>
                  {formatDistanceToNowStrict(new Date(comment.created), { locale: de, addSuffix: true })}
                </span>
              </div>
              <AdfContent doc={comment.body} className="pl-8" />
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={submit} className="flex flex-col gap-2">
        <Textarea
          value={draft}
          placeholder="Kommentar schreiben… (*fett*, _kursiv_, [~accountid:…])"
          aria-label="Kommentar"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit();
          }}
        />
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={!draft.trim() || add.isPending}>
            {add.isPending && <Spinner />}
            Kommentieren
          </Button>
          <span className="text-xs text-muted-foreground">⌘ + Enter</span>
          {add.error && (
            <p role="alert" className="text-sm text-destructive">
              {add.error.message}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
