import { RefreshCwIcon, RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { motion } from "motion/react";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

const COPY = {
  page: {
    title: "Diese Ansicht konnte nicht angezeigt werden",
    first: "Ein unerwarteter Fehler ist aufgetreten. Kopfzeile und Navigation funktionieren weiter.",
  },
  app: {
    title: "betterjira konnte nicht angezeigt werden",
    first: "Ein unerwarteter Fehler ist aufgetreten.",
  },
} as const;

const AGAIN = "Der Fehler tritt weiterhin auf. Neu laden startet die Oberfläche neu, ohne gespeicherte Daten zu löschen.";

type RenderErrorProps = {
  scope: keyof typeof COPY;
  retries?: number;
  onRetry: () => void;
  onReload: () => void;
  className?: string;
};

export function RenderError({ scope, retries = 0, onRetry, onReload, className }: RenderErrorProps) {
  const copy = COPY[scope];
  const again = retries > 0;
  return (
    <Empty className={cn("min-h-80", className)}>
      <Stagger className="flex flex-col items-center gap-4">
        <StaggerItem>
          <EmptyHeader role="alert">
            <EmptyMedia variant="icon" className="rounded-xl">
              <TriangleAlertIcon />
            </EmptyMedia>
            <EmptyTitle className="text-base text-balance">{copy.title}</EmptyTitle>
            <EmptyDescription>
              <motion.span
                key={again ? "again" : "first"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.18, ease: EASE_OUT }}
              >
                {again ? AGAIN : copy.first}
              </motion.span>
            </EmptyDescription>
          </EmptyHeader>
        </StaggerItem>
        <StaggerItem>
          <EmptyContent className="flex-row flex-wrap justify-center">
            <Button autoFocus className="rounded-xl" onClick={onRetry}>
              <RotateCcwIcon data-icon="inline-start" />
              Erneut versuchen
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={onReload}>
              <RefreshCwIcon data-icon="inline-start" />
              Neu laden
            </Button>
          </EmptyContent>
        </StaggerItem>
      </Stagger>
    </Empty>
  );
}
