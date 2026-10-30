import { formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";
import {
  CircleCheckIcon,
  CircleDotIcon,
  CircleXIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
  type LucideIcon,
} from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar";
import type { CheckState, PullRequest, PullRequestState, ReviewState, ScmPerson } from "@/lib/scm/model";
import { cn } from "@/lib/utils";

const STATES: Record<PullRequestState, { icon: LucideIcon; label: string; className: string }> = {
  open: { icon: GitPullRequestIcon, label: "Offen", className: "text-emerald-500" },
  draft: { icon: GitPullRequestDraftIcon, label: "Entwurf", className: "text-muted-foreground" },
  merged: { icon: GitMergeIcon, label: "Gemerged", className: "text-violet-500" },
  closed: { icon: GitPullRequestClosedIcon, label: "Geschlossen", className: "text-destructive" },
};

const CHECKS: Record<CheckState, { icon: LucideIcon; label: string; className: string }> = {
  success: { icon: CircleCheckIcon, label: "Checks erfolgreich", className: "text-emerald-500" },
  failure: { icon: CircleXIcon, label: "Checks fehlgeschlagen", className: "text-destructive" },
  pending: { icon: CircleDotIcon, label: "Checks laufen", className: "text-amber-500" },
};

const REVIEWS: Record<ReviewState, { label: string; ring: string }> = {
  approved: { label: "hat freigegeben", ring: "ring-emerald-500!" },
  changes: { label: "möchte Änderungen", ring: "ring-destructive!" },
  pending: { label: "Review ausstehend", ring: "" },
};

const initials = (name: string) =>
  name
    .split(/[\s._-]+/)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);

export function PersonAvatar({ person, className }: { person: ScmPerson; className?: string }) {
  return (
    <Avatar size="sm" className={className}>
      {person.avatarUrl && <AvatarImage src={person.avatarUrl} alt="" />}
      <AvatarFallback className="text-[10px]">{initials(person.name)}</AvatarFallback>
    </Avatar>
  );
}

export function PullRequestRow({ pr, repo, onOpen }: { pr: PullRequest; repo: string; onOpen: (url: string) => void }) {
  const state = STATES[pr.state];
  const checks = pr.checks && CHECKS[pr.checks];
  return (
    <button
      type="button"
      onClick={() => onOpen(pr.url)}
      className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted"
    >
      <Tooltip content={state.label}>
        <span className="grid place-items-center" aria-label={state.label}>
          <state.icon className={cn("size-4", state.className)} />
        </span>
      </Tooltip>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm">{pr.title}</span>
        <span className="truncate text-xs text-muted-foreground">
          {repo} #{pr.number} · <span className="font-mono">{pr.source}</span> → <span className="font-mono">{pr.target}</span> ·{" "}
          {formatDistanceToNowStrict(new Date(pr.updatedAt), { locale: de, addSuffix: true })}
        </span>
      </span>
      <span className="flex items-center gap-2">
        {pr.reviewers.length > 0 && (
          <AvatarGroup>
            {pr.reviewers.slice(0, 4).map((reviewer) => (
              <Tooltip key={reviewer.name} content={`${reviewer.name} ${REVIEWS[reviewer.state].label}`}>
                <PersonAvatar person={reviewer} className={REVIEWS[reviewer.state].ring} />
              </Tooltip>
            ))}
          </AvatarGroup>
        )}
        {checks && (
          <Tooltip content={checks.label}>
            <span className="grid place-items-center" aria-label={checks.label}>
              <checks.icon className={cn("size-4", checks.className)} />
            </span>
          </Tooltip>
        )}
      </span>
    </button>
  );
}
