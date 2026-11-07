import { useReducedMotion } from "motion/react";
import { StaggerItem } from "@/components/motion/stagger";
import { FavoriteButton } from "@/components/projects/favorite-button";
import { ProjectAvatar } from "@/components/shell/project-avatar";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import type { ProjectVisibilityRowProps } from "@/types/project-settings";

export function ProjectVisibilityRow({ entry, onToggleFavorite, onToggleHidden, ref }: ProjectVisibilityRowProps) {
  const reduce = useReducedMotion();
  const { project, favorite, hidden } = entry;
  return (
    <StaggerItem
      ref={ref}
      role="listitem"
      layout={reduce ? false : "position"}
      exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE_OUT } }}
      transition={{ layout: SPRING_LAYOUT }}
    >
      <Item variant="outline" size="sm" className="rounded-xl">
        <ItemMedia><ProjectAvatar project={project} /></ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle className="w-full truncate">{project.name}</ItemTitle>
          <ItemDescription>{project.key}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <FavoriteButton name={project.name} favorite={favorite} onToggle={onToggleFavorite} />
          <Switch checked={!hidden} onCheckedChange={onToggleHidden} aria-label={`${project.name} in Sidebar anzeigen`} />
        </ItemActions>
      </Item>
    </StaggerItem>
  );
}
