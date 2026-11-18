import { AnimatePresence } from "motion/react";
import { Fade } from "@/components/motion/fade";
import type { BoardSprintCompletion } from "@/lib/jira/board-sprint-completion";

export function SprintCompletionHint({ completion }: { completion?: BoardSprintCompletion }) {
  return (
    <AnimatePresence initial={false} mode="wait">
      {completion && (
        <Fade key={`${completion.columnName}:${completion.hasStatuses}`}>
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Sprintabschluss: „{completion.columnName}“.</span>{" "}
            {completion.hasStatuses
              ? "Für Jira zählt die rechte konfigurierte Boardspalte, auch wenn sie hier ausgeblendet ist. Grüne Status in anderen Spalten reichen dafür nicht aus."
              : "Der rechten konfigurierten Boardspalte sind keine Status zugeordnet. Prüfe die Spaltenzuordnung in Jira; eine grüne Statusfarbe allein reicht für den Sprintabschluss nicht aus."}
          </p>
        </Fade>
      )}
    </AnimatePresence>
  );
}
