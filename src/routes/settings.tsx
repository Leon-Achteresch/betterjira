import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { NAV_TAB_CLASS, NavTabIndicator, NavTabs } from "@/components/motion/nav-tabs";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

const TABS = [
  { to: "/settings/darstellung", label: "Darstellung" },
  { to: "/settings/bereiche", label: "Bereiche" },
  { to: "/settings/code-hosting", label: "Code-Hosting" },
  { to: "/settings/briefing", label: "KI-Briefing" },
  { to: "/settings/verbindungen", label: "Verbindungen" },
  { to: "/settings/updates", label: "Updates" },
] as const;

function Settings() {
  return (
    <div className="flex flex-col items-start gap-6 p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Einstellungen</h1>
      <NavTabs id="settings-tabs" label="Einstellungen">
        {TABS.map((tab) => (
          <Link key={tab.to} to={tab.to} className={NAV_TAB_CLASS}>
            {({ isActive }) => (
              <>
                {tab.label}
                {isActive && <NavTabIndicator />}
              </>
            )}
          </Link>
        ))}
      </NavTabs>
      <Outlet />
    </div>
  );
}
