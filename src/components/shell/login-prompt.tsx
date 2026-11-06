import { LogInIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useJiraLogin } from "@/lib/jira/queries";

export function LoginPrompt({ description }: { description: string }) {
  const login = useJiraLogin();
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LogInIcon />
        </EmptyMedia>
        <EmptyTitle>Nicht angemeldet</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => login.mutate()}>
          {login.isPending && <Spinner />}
          {login.isPending ? "Warte auf Browser – erneut öffnen" : "Mit Atlassian verbinden"}
        </Button>
        {login.error && (
          <p role="alert" className="text-sm text-destructive">
            {login.error.message}
          </p>
        )}
      </EmptyContent>
    </Empty>
  );
}
