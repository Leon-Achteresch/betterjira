import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  ChartColumnIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  EyeOffIcon,
  ExternalLinkIcon,
  FunnelIcon,
  ListIcon,
  LogInIcon,
  LogOutIcon,
  SearchIcon,
  SquareKanbanIcon,
  StarIcon,
  StarOffIcon,
  TerminalSquareIcon,
} from "lucide-react";
import { ProjectStatsDialog } from "@/components/project-stats/project-stats-dialog";
import { ProjectAvatar } from "@/components/shell/project-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
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
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import {
  useJiraFilters,
  useJiraLogin,
  useJiraLogout,
  useJiraMyself,
  useJiraProjectBoards,
  useJiraProjects,
  useJiraSite,
  type JiraProject,
} from "@/lib/jira/queries";
import { useProjectStats } from "@/hooks/jira/use-project-stats";
import { useProjectPrefs } from "@/lib/project-prefs";

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

function ProjectItem({ project }: { project: JiraProject }) {
  const site = useJiraSite();
  const { key } = useParams({ strict: false });
  const [open, setOpen] = useState(key === project.key);
  const favorite = useProjectPrefs((state) => state.projectIds.includes(project.id));
  const toggleFavorite = useProjectPrefs((state) => state.toggleProject);
  const toggleHidden = useProjectPrefs((state) => state.toggleHidden);
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
            <ContextMenuItem onSelect={() => toggleFavorite(project.id)}>
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
            <ContextMenuItem onSelect={() => toggleHidden(project.id)}>
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

function ProjectMenu({ projects }: { projects: JiraProject[] }) {
  return (
    <SidebarMenu>
      {projects.map((project) => (
        <ProjectItem key={project.id} project={project} />
      ))}
    </SidebarMenu>
  );
}

function Section({ label, count, children }: { label: string; count?: number; children: ReactNode }) {
  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup className="py-1">
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="gap-1 uppercase tracking-wider hover:text-sidebar-foreground">
            <ChevronRightIcon className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            {label}
            {count !== undefined && <span className="ml-auto font-normal tabular-nums">{count}</span>}
          </CollapsibleTrigger>
        </SidebarGroupLabel>
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

function ProfileMenu() {
  const site = useJiraSite();
  const myself = useJiraMyself();
  const login = useJiraLogin();
  const logout = useJiraLogout();

  if (!site.isPending && !site.data) {
    return (
      <SidebarMenuButton size="lg" variant="outline" onClick={() => login.mutate()} disabled={login.isPending}>
        {login.isPending ? <Spinner /> : <LogInIcon />}
        <span>{login.isPending ? "Warte auf Browser" : "Mit Atlassian verbinden"}</span>
      </SidebarMenuButton>
    );
  }

  const name = myself.data?.displayName ?? "";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
          <Avatar className="size-8">
            {myself.data && <AvatarImage src={myself.data.avatarUrls["48x48"]} alt="" />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate font-medium">{name || "…"}</span>
            <span className="truncate text-xs text-muted-foreground">{site.data?.siteName}</span>
          </div>
          <ChevronsUpDownIcon className="ml-auto text-muted-foreground" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="min-w-56">
        <DropdownMenuLabel className="grid font-normal">
          <span className="font-medium">{name}</span>
          {myself.data?.emailAddress && <span className="text-xs text-muted-foreground">{myself.data.emailAddress}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {site.data && (
          <DropdownMenuItem onSelect={() => void openUrl(site.data!.siteUrl)}>
            <ExternalLinkIcon />
            Jira öffnen
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => logout.mutate()} disabled={logout.isPending}>
          <LogOutIcon />
          Abmelden
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppSidebar() {
  const site = useJiraSite();
  const projects = useJiraProjects();
  const favoriteIds = useProjectPrefs((state) => state.projectIds);
  const hiddenIds = useProjectPrefs((state) => state.hiddenProjectIds);
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible =
    projects.data?.filter(
      (project) =>
        !hiddenIds.includes(project.id) &&
        (project.name.toLowerCase().includes(needle) || project.key.toLowerCase().includes(needle)),
    ) ?? [];
  const favorites = visible.filter((project) => favoriteIds.includes(project.id));
  const others = visible.filter((project) => !favoriteIds.includes(project.id));
  const filters = useJiraFilters();
  const visibleFilters = (filters.data ?? [])
    .filter((filter) => filter.name.toLowerCase().includes(needle))
    .sort((a, b) => Number(!!b.favourite) - Number(!!a.favourite));

  return (
    <Sidebar className="top-(--app-header-height) h-[calc(100svh-var(--app-header-height))] border-r-sidebar-border/60">
      {site.data && (
        <SidebarHeader className="pt-3">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <SidebarInput
              type="search"
              placeholder="Suchen"
              aria-label="Bereiche und Filter suchen"
              className="rounded-lg border-transparent bg-sidebar-accent/60 pl-8 focus-visible:bg-background"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </SidebarHeader>
      )}
      <SidebarContent>
        {site.data && (
          <>
            {favorites.length > 0 && (
              <Section label="Favoriten">
                <ProjectMenu projects={favorites} />
              </Section>
            )}
            <Section label="Bereiche" count={projects.data ? others.length : undefined}>
              {projects.isPending ? (
                <MenuSkeleton />
              ) : needle && visible.length === 0 ? (
                <p className="px-2 py-1 text-sm text-muted-foreground">Keine Treffer</p>
              ) : (
                <ProjectMenu projects={others} />
              )}
            </Section>
            <Section label="Filter" count={filters.data ? visibleFilters.length : undefined}>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="JQL-Suche">
                    <Link to="/suche" search={{}} activeProps={{ "data-active": true }}>
                      <TerminalSquareIcon className="text-muted-foreground" />
                      <span>JQL-Suche</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
              {filters.isPending ? (
                <MenuSkeleton />
              ) : filters.error ? (
                <p role="alert" className="px-2 py-1 text-sm text-destructive">
                  Filter konnten nicht geladen werden
                </p>
              ) : visibleFilters.length === 0 ? (
                <p className="px-2 py-1 text-sm text-muted-foreground">{needle ? "Keine Treffer" : "Keine Filter"}</p>
              ) : (
                <SidebarMenu>
                  {visibleFilters.map((filter) => (
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
            <ProfileMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
