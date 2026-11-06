import { Link } from "@tanstack/react-router";
import { BriefcaseIcon, CalendarDaysIcon, GitPullRequestIcon, HouseIcon, TicketIcon } from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { SPRING_LAYOUT } from "@/lib/ease";

const ITEMS = [
  { to: "/", label: "Übersicht", icon: HouseIcon, activeOptions: { exact: true } },
  { to: "/arbeitsplatz", label: "Arbeitsplatz", icon: BriefcaseIcon, activeOptions: { includeSearch: false } },
  { to: "/tickets", label: "Jira-Tickets", icon: TicketIcon, activeOptions: { includeSearch: false } },
  { to: "/pull-requests", label: "Pull Requests", icon: GitPullRequestIcon, activeOptions: { includeSearch: false } },
  { to: "/kalender", label: "Kalender", icon: CalendarDaysIcon, activeOptions: {} },
] as const;

export function PrimaryNav() {
  const { isMobile, setOpenMobile } = useSidebar();
  const reduce = useReducedMotion();

  return (
    <nav aria-label="Hauptnavigation">
      <LayoutGroup id="primary-nav">
        <SidebarMenu>
          {ITEMS.map((item) => (
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
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </LayoutGroup>
    </nav>
  );
}
