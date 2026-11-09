import { useState, type ReactNode } from "react";
import { useJiraProjectBoards } from "@/hooks/jira/use-jira-board";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  ChartColumnIcon,
  ChevronRightIcon,
  EyeOffIcon,
  ExternalLinkIcon,
  FunnelIcon,
  LayoutGridIcon,
  ListFilterIcon,
  ListIcon,
  SearchIcon,
  SquareKanbanIcon,
  StarIcon,
  StarOffIcon,
} from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { ProjectStatsDialog } from "@/components/project-stats/project-stats-dialog";
import { PrimaryNav } from "@/components/shell/primary-nav";
import { ProfileMenu } from "@/components/shell/profile-menu";
import { ProjectAvatar } from "@/components/shell/project-avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarMenuBadge,
  SidebarMenuSkeleton,
  useSidebar,
} from "@/components/ui/sidebar";
import { useJiraSite, type JiraProject } from "@/lib/jira/queries";
import { useProfileMenu } from "@/hooks/jira/use-profile-menu";
import { useProjectStats } from "@/hooks/jira/use-project-stats";
import { useSidebarSearch } from "@/hooks/use-sidebar-search";
import type { ProjectPrefsControls } from "@/hooks/use-project-prefs";
import { cn } from "@/lib/utils";

function ProjectBoards({ projectKey }: { projectKey: string }) {
  const boards = useJiraProjectBoards(projectKey);
  const { key } = useParams({ strict: false });
  const { board } = useSearch({ strict: false });
  const active = key === projectKey;

  return (
    <SidebarMenuSub>
      {boards.isPending && (
        <SidebarMenuSubItem>
          <SidebarMenuSkeleton />
        </SidebarMenuSubItem>
      )}
      {boards.data?.values.map((b) => (
        <SidebarMenuSubItem key={b.id}>
          <SidebarMenuSubButton asChild isActive={active && board === b.id}>
            <Link to="/bereiche/$key" params={{ key: projectKey }} search={{ board: b.id }}>
              <SquareKanbanIcon />
              <span>{b.name}</span>
            </Link>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ))}
      <SidebarMenuSubItem>
        <SidebarMenuSubButton asChild isActive={active && board === undefined}>
          <Link to="/bereiche/$key" params={{ key: projectKey }} search={{}}>
            <ListIcon />
            <span>Alle Vorgänge</span>
          </Link>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    </SidebarMenuSub>
  );
}

type ProjectMenuPrefs = Pick<ProjectPrefsControls, "ready" | "favoriteIds" | "toggleFavorite" | "toggleHidden">;

function ProjectItem({ project, prefs }: { project: JiraProject; prefs: ProjectMenuPrefs }) {
  const site = useJiraSite();
  const { key } = useParams({ strict: false });
  const [open, setOpen] = useState(key === project.key);
  const favorite = prefs.favoriteIds.includes(project.id);
  const [statsOpen, setStatsOpen] = useState(false);
  const stats = useProjectStats(project.key, statsOpen);
  const navigate = useNavigate();

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <SidebarMenuButton asChild tooltip={project.name}>
              <Link
                to="/bereiche/$key"
                params={{ key: project.key }}
                search={{}}
                activeProps={{ "data-active": true }}
                onClick={() => setOpen(true)}
              >
                <ProjectAvatar project={project} className="size-5" />
                <span>{project.name}</span>
              </Link>
            </SidebarMenuButton>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onSelect={() => setStatsOpen(true)}>
              <ChartColumnIcon />
              Statistiken
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem disabled={!prefs.ready} onSelect={() => prefs.toggleFavorite(project.id)}>
              {favorite ? <StarOffIcon /> : <StarIcon />}
              {favorite ? "Aus Favoriten entfernen" : "Favorisieren"}
            </ContextMenuItem>
            {site.data && (
              <ContextMenuItem onSelect={() => void openUrl(`${site.data!.siteUrl}/browse/${project.key}`)}>
                <ExternalLinkIcon />
                In Jira öffnen
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem disabled={!prefs.ready} onSelect={() => prefs.toggleHidden(project.id)}>
              <EyeOffIcon />
              Ausblenden
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <ProjectStatsDialog
          open={statsOpen}
          onOpenChange={setStatsOpen}
          projectName={project.name}
          stats={stats.stats}
          isPending={stats.isPending}
          error={stats.error}
          truncated={stats.truncated}
          onIssueSelect={(issueKey) => {
            setStatsOpen(false);
            void navigate({ to: "/issue/$key", params: { key: issueKey } });
          }}
        />
        <CollapsibleTrigger asChild>
          <SidebarMenuAction aria-label="Unterbereiche" className="data-[state=open]:rotate-90">
            <ChevronRightIcon />
          </SidebarMenuAction>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ProjectBoards projectKey={project.key} />
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function ProjectMenu({ projects, prefs }: { projects: JiraProject[]; prefs: ProjectMenuPrefs }) {
  return (
    <SidebarMenu>
      {projects.map((project) => (
        <ProjectItem key={project.id} project={project} prefs={prefs} />
      ))}
    </SidebarMenu>
  );
}

function Section({ label, count, action, children }: { label: string; count?: number; action?: ReactNode; children: ReactNode }) {
  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup className="py-1">
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className={cn("gap-1 uppercase tracking-wider hover:text-sidebar-foreground", action && "pr-9")}>
            <ChevronRightIcon className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            {label}
            {count !== undefined && <span className="ml-auto font-normal tabular-nums">{count}</span>}
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        {action}
        <CollapsibleContent>
          <SidebarGroupContent>{children}</SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

function MenuSkeleton() {
  return (
    <SidebarMenu>
      {Array.from({ length: 4 }, (_, i) => (
        <SidebarMenuItem key={i}>
          <SidebarMenuSkeleton showIcon />
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function AppSidebar() {
  const site = useJiraSite();
  const search = useSidebarSearch();
  const profile = useProfileMenu();
  const { projects, filters } = search;
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <Sidebar className="top-(--app-header-height) h-[calc(100svh-var(--app-header-height))] border-r-sidebar-border/60">
      <SidebarHeader className="gap-3 pt-3">
        <PrimaryNav />
        {site.data && (
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <SidebarInput
              type="search"
              placeholder="Suchen"
              aria-label="Bereiche und Filter suchen"
              className="rounded-lg border-transparent bg-sidebar-accent/60 pl-8 focus-visible:bg-background"
              value={search.query}
              onChange={(event) => search.setQuery(event.target.value)}
            />
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        {site.data && (
          <>
            {projects.favorites.length > 0 && (
              <Section label="Favoriten">
                <ProjectMenu projects={projects.favorites} prefs={search.prefs} />
              </Section>
            )}
            <Section
              label="Bereiche"
              count={projects.loaded ? projects.others.length : undefined}
              action={
                <Tooltip content="Alle Bereiche" side="right">
                  <SidebarGroupAction asChild className="top-1 right-1 size-8">
                    <Link to="/bereiche" search={{}} aria-label="Alle Bereiche" onClick={() => isMobile && setOpenMobile(false)}>
                      <LayoutGridIcon />
                    </Link>
                  </SidebarGroupAction>
                </Tooltip>
              }
            >
              {projects.isPending ? (
                <MenuSkeleton />
              ) : search.searching && projects.visible.length === 0 ? (
                <p className="px-2 py-1 text-sm text-muted-foreground">Keine Treffer</p>
              ) : (
                <ProjectMenu projects={projects.others} prefs={search.prefs} />
              )}
            </Section>
            <Section label="Filter" count={filters.loaded ? filters.items.length : undefined}>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Ticketsuche">
                    <Link to="/suche" search={{}} activeProps={{ "data-active": true }}>
                      <SearchIcon className="text-muted-foreground" />
                      <span>Ticketsuche</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Alle Filter">
                    <Link
                      to="/filter"
                      activeOptions={{ exact: true, includeSearch: false }}
                      activeProps={{ "data-active": true }}
                      onClick={() => isMobile && setOpenMobile(false)}
                    >
                      <ListFilterIcon className="text-muted-foreground" />
                      <span>Alle Filter</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
              {filters.isPending ? (
                <MenuSkeleton />
              ) : filters.error && !filters.loaded ? (
                <p role="alert" className="px-2 py-1 text-sm text-destructive">
                  Filter konnten nicht geladen werden
                </p>
              ) : filters.items.length === 0 ? (
                <p className="px-2 py-1 text-sm text-muted-foreground">{search.searching ? "Keine Treffer" : "Keine Filter"}</p>
              ) : (
                <SidebarMenu>
                  {filters.items.map((filter) => (
                    <SidebarMenuItem key={filter.id}>
                      <SidebarMenuButton asChild tooltip={filter.name}>
                        <Link to="/filter/$id" params={{ id: filter.id }} activeProps={{ "data-active": true }}>
                          <FunnelIcon className="text-muted-foreground" />
                          <span>{filter.name}</span>
                        </Link>
                      </SidebarMenuButton>
                      {filter.favourite && (
                        <SidebarMenuBadge>
                          <StarIcon className="size-3 fill-amber-400 text-amber-400" />
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              )}
            </Section>
          </>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/60">
        <SidebarMenu>
          <SidebarMenuItem>
            <ProfileMenu profile={profile} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
