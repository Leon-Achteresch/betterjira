import { Link } from "@tanstack/react-router";
import { NAV_TAB_CLASS, NavTabIndicator, NavTabs } from "@/components/motion/nav-tabs";
import type { SearchMode, SucheSearch } from "@/lib/search/search-params";
import { cn } from "@/lib/utils";

const MODES: { id: SearchMode; label: string }[] = [
  { id: "einfach", label: "Einfach" },
  { id: "jql", label: "JQL" },
];

export function SearchModeTabs({ mode, targets }: { mode: SearchMode; targets: Record<SearchMode, SucheSearch> }) {
  return (
    <NavTabs id="search-mode" label="Suchmodus" className="self-start">
      {MODES.map(({ id, label }) => (
        <Link
          key={id}
          to="/suche"
          search={targets[id]}
          aria-current={id === mode ? "page" : undefined}
          className={cn(NAV_TAB_CLASS, "pt-1.5")}
        >
          {label}
          {id === mode && <NavTabIndicator />}
        </Link>
      ))}
    </NavTabs>
  );
}
