import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  ExternalLinkIcon,
  FileTextIcon,
  FolderKanbanIcon,
  FunnelIcon,
  HomeIcon,
  KeyboardIcon,
  LayersIcon,
  SparklesIcon,
  LogInIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  PanelLeftIcon,
  SearchIcon,
  SettingsIcon,
  StarIcon,
  SunIcon,
  TerminalSquareIcon,
  TicketIcon,
  PinIcon,
  HistoryIcon,
} from "lucide-react";
import type { CommandItem } from "@/components/motion/command-palette";
import { IssuePreview, ProjectPreview, FilterPreview, IssueKey } from "@/components/shell/command-previews";
import { useSidebar } from "@/components/ui/sidebar";
import {
  useJiraFilters,
  useJiraIssues,
  useJiraLogin,
  useJiraLogout,
  useJiraMyWork,
  useJiraProjects,
  useJiraSite,
} from "@/lib/jira/queries";
import { IS_MAC } from "@/lib/platform";
import { useProjectPrefs } from "@/lib/project-prefs";
import { shortcutHint } from "@/lib/shortcuts";
import { useShortcutHelp } from "@/hooks/use-app-shortcuts";
import { type ThemePreference, useTheme } from "@/hooks/use-theme";
import { useWorkspace } from "@/hooks/use-workspace";

const MOD = IS_MAC ? "⌘" : "Strg";
const ISSUE_KEY = /^[a-z][a-z0-9_]*-\d+$/i;

const THEMES: { value: ThemePreference; label: string; icon: typeof SunIcon }[] = [
  { value: "system", label: "Design: wie System", icon: MonitorIcon },
  { value: "light", label: "Design: Hell", icon: SunIcon },
  { value: "dark", label: "Design: Dunkel", icon: MoonIcon },
];

export function useAppCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced] = useDebouncedValue(query.trim(), { wait: 250 });
  const navigate = useNavigate();
  const { toggleSidebar } = useSidebar();
  const site = useJiraSite();
  const projects = useJiraProjects();
  const filters = useJiraFilters();
  const myWork = useJiraMyWork();
  const login = useJiraLogin();
  const logout = useJiraLogout();
  const hiddenIds = useProjectPrefs((state) => state.hiddenProjectIds);
  const favoriteIds = useProjectPrefs((state) => state.projectIds);
  const { theme, setTheme } = useTheme();
  const openShortcutHelp = useShortcutHelp((state) => state.setOpen);

  const text = debounced.replace(/[\\"]/g, "\\$&");
  const search = useJiraIssues(`text ~ "${text}*" ORDER BY updated DESC`, open && debounced.length >= 2);
  const trimmed = query.trim();
  const issueKey = ISSUE_KEY.test(trimmed) ? trimmed.toUpperCase() : null;

  const openIssue = (key: string) => void navigate({ to: "/issue/$key", params: { key } });
  const { workspace, ready } = useWorkspace();
  const pinnedKeys = new Set(workspace.pinned.map((issue) => issue.key));
  const remembered = ready
    ? [
        ...workspace.pinned.map((issue) => ({
          ...issue,
          group: "Angeheftet",
          icon: PinIcon,
        })),
        ...workspace.recent
          .filter((issue) => !pinnedKeys.has(issue.key))
          .slice(0, 6)
          .map((issue) => ({
            ...issue,
            group: "Zuletzt geöffnet",
            icon: HistoryIcon,
          })),
      ]
    : [];
  const rememberedKeys = new Set(remembered.map((issue) => issue.key));
  const workKeys = new Set(myWork.data?.issues.map((issue) => issue.key));
  const workByKey = new Map(myWork.data?.issues.map((issue) => [issue.key, issue]));
  const searchKeys = new Set(search.data?.issues.map((issue) => issue.key));

  const items: CommandItem[] = [
    ...remembered
      .filter((issue) => issue.key !== issueKey)
      .map((issue) => ({
        id: `remembered:${issue.key}`,
        label: issue.summary,
        group: issue.group,
        icon: issue.icon,
        keywords: [
          issue.key,
          workByKey.get(issue.key)?.fields.project.name ?? "",
          workByKey.get(issue.key)?.fields.status.name ?? "",
          ...(searchKeys.has(issue.key) ? [debounced] : []),
        ],
        badge: <IssueKey value={issue.key} />,
        preview: <IssuePreview issueKey={issue.key} />,
        onSelect: () => openIssue(issue.key),
      })),
    ...(issueKey
      ? [
          {
            id: `key:${issueKey}`,
            label: `${issueKey} öffnen`,
            group: "Vorgang",
            icon: FileTextIcon,
            keywords: [trimmed],
            preview: <IssuePreview issueKey={issueKey} />,
            onSelect: () => openIssue(issueKey),
          },
        ]
      : []),
    ...(search.data?.issues ?? [])
      .filter((issue) => !workKeys.has(issue.key) && !rememberedKeys.has(issue.key) && issue.key !== issueKey)
      .map((issue) => ({
        id: `search:${issue.key}`,
        label: issue.fields.summary,
        group: "Suchergebnisse",
        icon: FileTextIcon,
        keywords: [debounced, issue.key],
        badge: <IssueKey value={issue.key} />,
        preview: <IssuePreview issueKey={issue.key} />,
        onSelect: () => openIssue(issue.key),
      })),
    ...(myWork.data?.issues ?? [])
      .filter((issue) => !rememberedKeys.has(issue.key) && issue.key !== issueKey)
      .map((issue) => ({
        id: `work:${issue.key}`,
        label: issue.fields.summary,
        group: "Meine Vorgänge",
        icon: FileTextIcon,
        keywords: [
          issue.key,
          issue.fields.project.name,
          issue.fields.status.name,
          ...(searchKeys.has(issue.key) ? [debounced] : []),
        ],
        badge: <IssueKey value={issue.key} />,
        preview: <IssuePreview issueKey={issue.key} />,
        onSelect: () => openIssue(issue.key),
      })),
    ...(projects.data ?? [])
      .filter((project) => !hiddenIds.includes(project.id))
      .sort((a, b) => Number(favoriteIds.includes(b.id)) - Number(favoriteIds.includes(a.id)))
      .map((project) => ({
        id: `project:${project.id}`,
        label: project.name,
        group: "Bereiche",
        icon: FolderKanbanIcon,
        keywords: [project.key],
        badge: favoriteIds.includes(project.id) ? (
          <StarIcon className="size-3 fill-amber-400 text-amber-400" />
        ) : undefined,
        preview: <ProjectPreview project={project} />,
        onSelect: () =>
          void navigate({
            to: "/bereiche/$key",
            params: { key: project.key },
            search: {},
          }),
      })),
    ...[...(filters.data ?? [])]
      .sort((a, b) => Number(!!b.favourite) - Number(!!a.favourite))
      .map((filter) => ({
        id: `filter:${filter.id}`,
        label: filter.name,
        group: "Filter",
        icon: FunnelIcon,
        badge: filter.favourite ? <StarIcon className="size-3 fill-amber-400 text-amber-400" /> : undefined,
        preview: <FilterPreview id={filter.id} name={filter.name} />,
        onSelect: () => void navigate({ to: "/filter/$id", params: { id: filter.id } }),
      })),
    {
      id: "nav:home",
      label: "Übersicht",
      group: "Navigation",
      icon: HomeIcon,
      keywords: ["home", "dashboard", "startseite"],
      hint: shortcutHint("home"),
      onSelect: () => void navigate({ to: "/" }),
    },
    {
      id: "nav:tickets",
      label: "Jira-Tickets",
      group: "Navigation",
      icon: TicketIcon,
      keywords: ["tickets", "vorgänge", "meine", "beobachtet"],
      hint: shortcutHint("tickets"),
      onSelect: () => void navigate({ to: "/tickets" }),
    },
    {
      id: "nav:search",
      label: "Ticketsuche",
      group: "Navigation",
      icon: SearchIcon,
      keywords: ["suche", "volltext", "vorgänge", "projekt"],
      hint: shortcutHint("search"),
      onSelect: () => void navigate({ to: "/suche", search: {} }),
    },
    {
      id: "nav:jql",
      label: "JQL-Suche",
      group: "Navigation",
      icon: TerminalSquareIcon,
      keywords: ["jql", "query", "abfrage", "experte", "filter"],
      onSelect: () => void navigate({ to: "/suche", search: { modus: "jql" } }),
    },
    {
      id: "nav:settings",
      label: "Einstellungen",
      group: "Navigation",
      icon: SettingsIcon,
      hint: shortcutHint("settings"),
      onSelect: () => void navigate({ to: "/settings" }),
    },
    {
      id: "nav:areas",
      label: "Bereiche verwalten",
      group: "Navigation",
      icon: LayersIcon,
      onSelect: () => void navigate({ to: "/settings/bereiche" }),
    },
    {
      id: "nav:briefing",
      label: "KI-Briefing einrichten",
      group: "Navigation",
      icon: SparklesIcon,
      onSelect: () => void navigate({ to: "/settings/briefing" }),
    },
    {
      id: "action:sidebar",
      label: "Seitenleiste ein-/ausblenden",
      group: "Aktionen",
      icon: PanelLeftIcon,
      hint: `${MOD} B`,
      onSelect: toggleSidebar,
    },
    {
      id: "action:shortcuts",
      label: "Tastenkürzel anzeigen",
      group: "Aktionen",
      icon: KeyboardIcon,
      keywords: ["shortcuts", "hotkeys", "tastatur"],
      hint: shortcutHint("help"),
      onSelect: () => openShortcutHelp(true),
    },
    ...THEMES.map((option) => ({
      id: `theme:${option.value}`,
      label: option.label,
      group: "Darstellung",
      icon: option.icon,
      keywords: ["theme", "design", "darstellung", "dark mode", "dunkelmodus", "hellmodus"],
      badge: theme === option.value ? <span className="text-[10px] text-muted-foreground">Aktiv</span> : undefined,
      onSelect: () => setTheme(option.value),
    })),
    ...(site.data
      ? [
          {
            id: "action:jira",
            label: "Jira im Browser öffnen",
            group: "Aktionen",
            icon: ExternalLinkIcon,
            onSelect: () => void openUrl(site.data!.siteUrl),
          },
          {
            id: "action:logout",
            label: "Abmelden",
            group: "Aktionen",
            icon: LogOutIcon,
            onSelect: () => logout.mutate(),
          },
        ]
      : [
          {
            id: "action:login",
            label: "Mit Atlassian verbinden",
            group: "Aktionen",
            icon: LogInIcon,
            onSelect: () => login.mutate(),
          },
        ]),
  ];

  return {
    items,
    open,
    setOpen: (next: boolean) => {
      if (next) setQuery("");
      setOpen(next);
    },
    setQuery,
    loading: open && debounced.length >= 2 && search.isFetching,
  };
}
