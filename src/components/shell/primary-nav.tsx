import { JiraLogo, ZammadLogo } from "@/components/brands/service-logos";
import { Link, useMatch } from "@tanstack/react-router";
import { BellIcon, BriefcaseIcon, CalendarDaysIcon, GitPullRequestIcon, SunIcon, TimerIcon } from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { Tooltip } from "@/components/motion/tooltip";
import {
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { SPRING_LAYOUT, SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";

type NavCounts = { notifications: number };

const GROUPS = [
  {
    label: "Mein Tag",
    items: [
      { to: "/", label: "Heute", icon: SunIcon, activeOptions: { exact: true } },
      { to: "/benachrichtigungen", label: "Benachrichtigungen", icon: BellIcon, activeOptions: { includeSearch: false }, count: "notifications" },
      { to: "/arbeitsplatz", label: "Arbeitsplatz", icon: BriefcaseIcon, activeOptions: { includeSearch: false } },
    ],
  },
  {
    label: "Arbeit",
    items: [
      { to: "/tickets", label: "Jira-Tickets", icon: JiraLogo, activeOptions: { includeSearch: false } },
      { to: "/helpdesk", label: "Zammad-Tickets", icon: ZammadLogo, activeOptions: { includeSearch: false } },
      { to: "/pull-requests", label: "Pull Requests", icon: GitPullRequestIcon, activeOptions: { includeSearch: false } },
      { to: "/kalender", label: "Kalender", icon: CalendarDaysIcon, activeOptions: {} },
      { to: "/zeiterfassung", label: "Zeiterfassung", icon: TimerIcon, activeOptions: { includeSearch: false } },
    ],
  },
] as const;

export function PrimaryNav({ counts, markIssueSection = false, compact = false }: {
  counts: NavCounts;
  markIssueSection?: boolean;
  compact?: boolean;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const reduce = useReducedMotion();
  const issue = useMatch({ from: "/issue/$key", shouldThrow: false });

  return (
    <nav aria-label="Hauptnavigation" data-slot="workspace-navigation" className="flex flex-col gap-2">
      <LayoutGroup id={compact ? "studio-dock" : "primary-nav"}>
        {GROUPS.map((group) => (
          <div key={group.label} className={cn("flex flex-col", compact && "border-t border-border pt-1")}>
            {!compact && <SidebarGroupLabel className="h-6 text-xs font-medium text-muted-foreground">{group.label}</SidebarGroupLabel>}
            <SidebarMenu>
              {group.items.map((item) => {
                const count = "count" in item ? counts[item.count] : 0;
                const issueSection = markIssueSection && !!issue && item.to === "/tickets";
                const link = (
                    <SidebarMenuButton asChild tooltip={compact ? undefined : item.label} className={cn("relative isolate", compact && "size-8 justify-center p-0")}>
                      <Link
                        to={item.to}
                        activeOptions={item.activeOptions}
                        data-active={issueSection || undefined}
                        activeProps={{ "data-active": true }}
                        onClick={() => isMobile && setOpenMobile(false)}
                      >
                        {({ isActive }) => (
                          <>
                            {(isActive || issueSection) && (
                              <motion.span
                                layoutId="primary-nav-indicator"
                                transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
                                className="pointer-events-none absolute inset-0 -z-10 rounded-xl bg-sidebar-accent/80 ring-1 ring-border/50"
                              />
                            )}
                            <item.icon aria-hidden className={isActive || issueSection ? "text-foreground" : "text-muted-foreground"} />
                            <span className={compact ? "sr-only" : undefined}>{item.label}</span>
                          </>
                        )}
                      </Link>
                    </SidebarMenuButton>
                );
                return (
                  <SidebarMenuItem key={item.to}>
                    {compact ? <Tooltip content={item.label} side="right">{link}</Tooltip> : link}
                    {count > 0 && (
                        <SidebarMenuBadge
                          aria-label={`${count} ungelesen`}
                          className={cn("rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground peer-data-active/menu-button:text-primary-foreground peer-hover/menu-button:text-primary-foreground", compact && "-top-0.5! -right-1! h-3.5 min-w-3.5 px-0.5 text-[9px]")}
                        >
                          <motion.span
                            key={count}
                            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={reduce ? { duration: 0.15 } : SPRING_PRESS}
                          >
                            {count > 99 ? "99+" : count}
                          </motion.span>
                        </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </div>
        ))}
      </LayoutGroup>
    </nav>
  );
}
