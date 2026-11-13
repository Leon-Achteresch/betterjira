import { AlarmClockIcon, CornerUpLeftIcon } from "lucide-react";
import { useId } from "react";
import { AnimatePresence } from "motion/react";
import { Fade } from "@/components/motion/fade";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotificationSnoozeMenu } from "@/hooks/notifications/use-notification-snooze-menu";

export function NotificationSnoozeMenu({
  issueKey,
  until,
  onSnooze,
  onResume,
}: {
  issueKey: string;
  until?: number;
  onSnooze: (until: number) => void;
  onResume: () => void;
}) {
  const menu = useNotificationSnoozeMenu(onSnooze, until);
  const errorId = useId();
  return (
    <Popover open={menu.open} onOpenChange={menu.setOpen}>
      <Tooltip
        content={until ? "Wiedervorlage ändern" : "Zurückstellen"}
        side="left"
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-8 rounded-xl text-muted-foreground"
            aria-label={`${issueKey} zurückstellen`}
          >
            <AlarmClockIcon className="size-3.5" />
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)]"
        aria-label={`${issueKey} Wiedervorlage`}
      >
        <div className="px-1">
          <p className="font-medium">{issueKey} zurückstellen</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Kehrt zum gewählten Zeitpunkt oder bei neuer Aktivität zurück. Bei
            geschlossener App beim nächsten Start.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 justify-start rounded-xl"
            onClick={() => menu.selectPreset("later")}
          >
            In 3 Stunden
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 justify-start rounded-xl"
            onClick={() => menu.selectPreset("tomorrow")}
          >
            Morgen um 9 Uhr
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 justify-start rounded-xl"
            onClick={() => menu.selectPreset("next-week")}
          >
            In einer Woche um 9 Uhr
          </Button>
        </div>
        <form
          noValidate
          className="flex flex-col gap-2 border-t pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            menu.submitDate();
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-medium">
            Eigener Zeitpunkt
            <Input
              type="datetime-local"
              value={menu.date}
              min={menu.minDate}
              onChange={(event) => menu.setDate(event.target.value)}
              required
              aria-invalid={!!menu.error}
              aria-describedby={menu.error ? errorId : undefined}
              className="h-9 min-w-0 rounded-xl tabular-nums"
            />
          </label>
          <AnimatePresence initial={false}>
            {menu.error && (
              <Fade key="date-error">
                <p
                  id={errorId}
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {menu.error}
                </p>
              </Fade>
            )}
          </AnimatePresence>
          <Button
            type="submit"
            size="sm"
            className="h-8 rounded-xl"
            disabled={!menu.date}
          >
            Zurückstellen
          </Button>
        </form>
        {until && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 justify-start rounded-xl"
            onClick={() => {
              menu.setOpen(false);
              onResume();
            }}
          >
            <CornerUpLeftIcon /> Jetzt zurückholen
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
