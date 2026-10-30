import { Link, Outlet, createFileRoute, useMatchRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { SPRING_LAYOUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

const TABS = [
  { to: "/settings/bereiche", label: "Bereiche" },
  { to: "/settings/code-hosting", label: "Code-Hosting" },
  { to: "/settings/briefing", label: "KI-Briefing" },
] as const;

function Settings() {
  const matchRoute = useMatchRoute();
  return (
    <div className="flex flex-col items-start gap-6 p-8">
      <h1 className="text-2xl font-semibold">Einstellungen</h1>
      <nav aria-label="Einstellungen" className="flex gap-1 border-b">
        {TABS.map((tab) => {
          const active = !!matchRoute({ to: tab.to });
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "relative px-3 pb-2 text-sm outline-none transition-colors hover:text-foreground focus-visible:text-foreground",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {tab.label}
              {active && (
                <motion.span layoutId="settings-tab" transition={SPRING_LAYOUT} className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-foreground" />
              )}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
