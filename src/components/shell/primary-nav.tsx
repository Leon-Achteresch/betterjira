import { JiraLogo, ZammadLogo } from "@/components/brands/service-logos";
import { Link } from "@tanstack/react-router";
import { BellIcon, BriefcaseIcon, CalendarDaysIcon, GitPullRequestIcon, SunIcon, TimerIcon } from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import {
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { SPRING_LAYOUT, SPRING_PRESS } from "@/lib/ease";

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

export function PrimaryNav({ counts }: { counts: NavCounts }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const reduce = useReducedMotion();

  return (
    <nav aria-label="Hauptnavigation" className="flex flex-col gap-2">
      <LayoutGroup id="primary-nav">
        {GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col">
            <SidebarGroupLabel className="h-6 text-[11px] tracking-wide text-sidebar-foreground/55 uppercase">{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const count = "count" in item ? counts[item.count] : 0;
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild tooltip={item.label} className="relative">
                      <Link
                        to={item.to}
                        activeOptions={item.activeOptions}
                        activeProps={{ "data-active": true }}
                        onClick={() => isMobile && setOpenMobile(false)}
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <motion.span
                                layoutId="primary-nav-indicator"
                                transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
                                className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary"
                              />
                            )}
                            <item.icon className={isActive ? "text-foreground" : "text-muted-foreground"} />
                            <span>{item.label}</span>
                          </>
                        )}
                      </Link>
                    </SidebarMenuButton>
                    {count > 0 && (
                        <SidebarMenuBadge
                          aria-label={`${count} ungelesen`}
                          className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground peer-data-active/menu-button:text-primary-foreground peer-hover/menu-button:text-primary-foreground"
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
