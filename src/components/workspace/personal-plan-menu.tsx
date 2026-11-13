import { ArrowDownIcon, ArrowUpIcon, CalendarClockIcon, EllipsisIcon, ListMinusIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/motion/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { PlanBucket } from "@/lib/workspace-plan";

export function PersonalPlanMenu({ issueKey, bucket, onPlan, onMove, canMoveUp, canMoveDown }: {
  issueKey: string;
  bucket?: PlanBucket;
  onPlan: (bucket: PlanBucket | null) => void;
  onMove: (direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <DropdownMenu>
      <Tooltip content="Persönlichen Plan ändern">
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground" aria-label={`Plan für ${issueKey} ändern`}>
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem disabled={bucket === "today"} onSelect={() => onPlan("today")}><SunIcon /> Für heute planen</DropdownMenuItem>
        <DropdownMenuItem disabled={bucket === "later"} onSelect={() => onPlan("later")}><CalendarClockIcon /> Für später planen</DropdownMenuItem>
        {bucket && <>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!canMoveUp} onSelect={() => onMove(-1)}><ArrowUpIcon /> Im Plan nach oben</DropdownMenuItem>
          <DropdownMenuItem disabled={!canMoveDown} onSelect={() => onMove(1)}><ArrowDownIcon /> Im Plan nach unten</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onPlan(null)}><ListMinusIcon /> Aus Plan entfernen</DropdownMenuItem>
        </>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
