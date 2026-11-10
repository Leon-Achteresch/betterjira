import type { Ref } from "react";
import type { ProjectSettingsState } from "@/hooks/jira/use-project-settings";

export type ProjectVisibilitySettingsProps = { settings: ProjectSettingsState };

export type ProjectVisibilityRowProps = {
  entry: ProjectSettingsState["entries"][number];
  onToggleFavorite: () => void;
  onToggleHidden: () => void;
  disabled?: boolean;
  ref?: Ref<HTMLDivElement>;
};
