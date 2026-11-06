import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { HistoryIcon, StarIcon } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { ProjectAvatar } from "@/components/shell/project-avatar";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
import type { JiraProject } from "@/lib/jira/queries";
import { EASE_OUT } from "@/lib/ease";
import type { ProjectPrefs } from "@/lib/project-prefs";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function LegacyProjectPrefsNotice({
  legacy,
  accountLabel,
  onAdopt,
  onDiscard,
}: {
  legacy: ProjectPrefs | null;
  accountLabel: string;
  onAdopt: () => void;
  onDiscard: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {legacy && (
        <motion.div
          role="region"
          aria-label="Frühere Bereichs-Einstellungen"
          initial={{ opacity: 0, y: reduce ? 0 : -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : -4, transition: { duration: 0.14, ease: EASE_OUT } }}
          transition={{ duration: 0.24, ease: EASE_OUT }}
          className="flex max-w-xl flex-col gap-3 rounded-2xl border bg-muted/40 px-4 py-3 text-sm sm:flex-row sm:items-center"
        >
          <HistoryIcon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <p className="flex-1 text-pretty">
            <span className="font-medium">Frühere Einstellungen gefunden: </span>
            <span className="text-muted-foreground tabular-nums">
              {count(legacy.favoriteIds.length, "Favorit", "Favoriten")},{" "}
              {count(legacy.hiddenIds.length, "ausgeblendeter Bereich", "ausgeblendete Bereiche")}. Sie gehören zu keinem Konto. Für{" "}
              {accountLabel} übernehmen?
            </span>
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" onClick={onDiscard}>
              Verwerfen
            </Button>
            <Button onClick={onAdopt}>Übernehmen</Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ProjectPrefsList({
  projects,
  favoriteIds,
  hiddenIds,
  disabled,
  onToggleFavorite,
  onToggleHidden,
}: {
  projects: readonly JiraProject[];
  favoriteIds: readonly string[];
  hiddenIds: readonly string[];
  disabled: boolean;
  onToggleFavorite: (id: string) => void;
  onToggleHidden: (id: string) => void;
}) {
  return (
    <ItemGroup className="max-w-xl">
      {projects.map((project) => {
        const favorite = favoriteIds.includes(project.id);
        const shown = !hiddenIds.includes(project.id);
        return (
          <Item key={project.id} variant="outline" size="sm">
            <ItemMedia>
              <ProjectAvatar project={project} />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{project.name}</ItemTitle>
              <ItemDescription>{project.key}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Tooltip content={favorite ? "Aus Favoriten entfernen" : "Favorisieren"}>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={disabled}
                  aria-pressed={favorite}
                  aria-label={favorite ? `${project.name} aus Favoriten entfernen` : `${project.name} favorisieren`}
                  onClick={() => onToggleFavorite(project.id)}
                >
                  <StarIcon className={favorite ? "fill-current text-amber-500" : "text-muted-foreground"} />
                </Button>
              </Tooltip>
              <Switch
                checked={shown}
                disabled={disabled}
                onCheckedChange={() => onToggleHidden(project.id)}
                aria-label={`${project.name} in Sidebar anzeigen`}
              />
            </ItemActions>
          </Item>
        );
      })}
    </ItemGroup>
  );
}
