import { ArrowLeftIcon, CompassIcon, HouseIcon } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

type RouteNotFoundProps = {
  canGoBack: boolean;
  onBack: () => void;
  onHome: () => void;
};

export function RouteNotFound({ canGoBack, onBack, onHome }: RouteNotFoundProps) {
  return (
    <Empty className="min-h-80">
      <Stagger className="flex flex-col items-center gap-4">
        <StaggerItem>
          <EmptyHeader>
            <EmptyMedia variant="icon" className="rounded-xl">
              <CompassIcon />
            </EmptyMedia>
            <EmptyTitle role="heading" aria-level={1} className="text-base text-balance">
              Diese Seite gibt es nicht
            </EmptyTitle>
            <EmptyDescription>
              Der Link führt zu keiner Ansicht in betterjira. Kopfzeile und Navigation funktionieren weiter.
            </EmptyDescription>
          </EmptyHeader>
        </StaggerItem>
        <StaggerItem>
          <EmptyContent className="flex-row flex-wrap justify-center">
            <Button autoFocus className="rounded-xl" onClick={onHome}>
              <HouseIcon data-icon="inline-start" />
              Zu Heute
            </Button>
            {canGoBack && (
              <Button variant="outline" className="rounded-xl" onClick={onBack}>
                <ArrowLeftIcon data-icon="inline-start" />
                Zurück
              </Button>
            )}
          </EmptyContent>
        </StaggerItem>
      </Stagger>
    </Empty>
  );
}
