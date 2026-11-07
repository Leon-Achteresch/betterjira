import { AnimatePresence } from "motion/react";
import { Fade } from "@/components/motion/fade";
import { SearchField } from "@/components/motion/search-field";
import { ProjectSettingsRefreshNotice } from "@/components/settings/project-settings-refresh-notice";
import { ProjectVisibilityContent } from "@/components/settings/project-visibility-content";
import type { ProjectVisibilitySettingsProps } from "@/types/project-settings";

export function ProjectVisibilitySettings({ settings }: ProjectVisibilitySettingsProps) {
  return (
    <div className="flex w-full max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          value={settings.query}
          onChange={settings.setQuery}
          label="Bereiche durchsuchen"
          placeholder="Name oder Schlüssel"
          className="w-full sm:w-72 [&_input::-webkit-search-cancel-button]:hidden [&_button]:min-h-8 [&_button]:min-w-8"
        />
        <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">{settings.matchLabel}</p>
      </div>
      <AnimatePresence initial={false}>
        {settings.refreshError && (
          <Fade key="refresh">
            <ProjectSettingsRefreshNotice message={settings.refreshErrorText} retrying={settings.isFetching} onRetry={settings.retry} />
          </Fade>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        <ProjectVisibilityContent key={settings.contentKey} settings={settings} />
      </AnimatePresence>
    </div>
  );
}
