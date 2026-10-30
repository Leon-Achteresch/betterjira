import { CopyIcon, GitBranchIcon, GitPullRequestCreateIcon } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ScmBranch } from "@/lib/scm/model";

export function BranchRow({
  branch,
  repo,
  creating,
  onOpen,
  onCopyCheckout,
  onCreatePullRequest,
}: {
  branch: ScmBranch;
  repo: string;
  creating: boolean;
  onOpen: (url: string) => void;
  onCopyCheckout: (name: string) => void;
  onCreatePullRequest: (name: string) => void;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted">
      <GitBranchIcon className="size-4 text-muted-foreground" />
      <button type="button" onClick={() => onOpen(branch.url)} className="flex min-w-0 flex-col gap-0.5 text-left">
        <span className="truncate font-mono text-sm">{branch.name}</span>
        <span className="truncate text-xs text-muted-foreground">{repo} · noch kein Pull Request</span>
      </button>
      <span className="flex items-center gap-1">
        <Tooltip content="Checkout-Befehl kopieren">
          <Button variant="ghost" size="icon-sm" aria-label="Checkout-Befehl kopieren" onClick={() => onCopyCheckout(branch.name)}>
            <CopyIcon />
          </Button>
        </Tooltip>
        <Button variant="outline" size="sm" disabled={creating} onClick={() => onCreatePullRequest(branch.name)}>
          {creating ? <Spinner /> : <GitPullRequestCreateIcon />}
          Pull Request
        </Button>
      </span>
    </div>
  );
}
