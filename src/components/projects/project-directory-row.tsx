import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { EyeOffIcon } from "lucide-react";
import { FavoriteButton } from "@/components/projects/favorite-button";
import { ProjectAvatar } from "@/components/shell/project-avatar";
import { Badge } from "@/components/ui/badge";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import type { ProjectDirectoryRowProps } from "@/types/project-directory";

export function ProjectDirectoryRow({ entry, onToggleFavorite, ref }: ProjectDirectoryRowProps) {
  const reduce = useReducedMotion();
  const { project, favorite, hidden } = entry;
  return (
    <motion.li
      ref={ref}
      layout={reduce ? false : "position"}
      initial={{ opacity: 0, y: reduce ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE_OUT } }}
      transition={{ duration: 0.18, ease: EASE_OUT, layout: SPRING_LAYOUT }}
      className="flex items-center gap-1 rounded-xl pr-1.5 transition-colors hover:bg-muted/60"
    >
      <Link
        to="/bereiche/$key"
        params={{ key: project.key }}
        search={{}}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ProjectAvatar project={project} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{project.name}</span>
          <span className="truncate text-xs text-muted-foreground">{project.key}</span>
        </span>
        {hidden && (
          <Badge variant="outline" className="ml-auto shrink-0 text-muted-foreground">
            <EyeOffIcon />
            Nicht in Seitenleiste
          </Badge>
        )}
      </Link>
      <FavoriteButton name={project.name} favorite={favorite} onToggle={onToggleFavorite} />
    </motion.li>
  );
}
