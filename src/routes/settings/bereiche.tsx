import { createFileRoute } from "@tanstack/react-router";
import { StarIcon } from "lucide-react";
import { ProjectAvatar } from "@/components/shell/project-avatar";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useJiraProjects, useJiraSite } from "@/lib/jira/queries";
import { useProjectPrefs } from "@/lib/project-prefs";

export const Route = createFileRoute("/settings/bereiche")({
  component: BereicheSettings,
});

function BereicheSettings() {
  const site = useJiraSite();
  const projects = useJiraProjects();
  const { projectIds: favoriteIds, hiddenProjectIds, toggleProject, toggleHidden } = useProjectPrefs();

  return (
    <section className="flex w-full flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Bereiche</h2>
        <p className="text-muted-foreground">Lege fest, welche Bereiche in der Sidebar erscheinen.</p>
      </div>
      {!site.isPending && !site.data ? (
        <p className="text-muted-foreground">Melde dich auf der Startseite an, um Bereiche zu sehen.</p>
      ) : projects.isPending ? (
        <Spinner />
      ) : projects.error ? (
        <p role="alert" className="text-sm text-destructive">
          {projects.error.message}
        </p>
      ) : projects.data.length === 0 ? (
        <p className="text-muted-foreground">Keine Bereiche gefunden</p>
      ) : (
        <ItemGroup className="max-w-xl">
          {projects.data.map((project) => {
            const favorite = favoriteIds.includes(project.id);
            const shown = !hiddenProjectIds.includes(project.id);
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
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-pressed={favorite}
                    aria-label={favorite ? `${project.name} aus Favoriten entfernen` : `${project.name} favorisieren`}
                    onClick={() => toggleProject(project.id)}
                  >
                    <StarIcon className={favorite ? "fill-current text-amber-500" : "text-muted-foreground"} />
                  </Button>
                  <Switch
                    checked={shown}
                    onCheckedChange={() => toggleHidden(project.id)}
                    aria-label={`${project.name} in Sidebar anzeigen`}
                  />
                </ItemActions>
              </Item>
            );
          })}
        </ItemGroup>
      )}
    </section>
  );
}
