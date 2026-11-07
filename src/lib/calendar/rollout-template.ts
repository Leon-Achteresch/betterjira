import type { Rollout } from "./model";
import { rolloutForm, type RolloutForm } from "./presentation";
import { ROLLOUT_TITLE_MAX_LENGTH } from "./validation";

export const COPY_SUFFIX = " (Kopie)";

export const copyTitle = (title: string) =>
  `${title.trim().slice(0, ROLLOUT_TITLE_MAX_LENGTH - COPY_SUFFIX.length).trimEnd()}${COPY_SUFFIX}`;

export const rolloutTemplateForm = (rollout: Rollout): RolloutForm => {
  const form = rolloutForm(rollout);
  return { ...form, title: copyTitle(rollout.title), issues: form.issues.map((issue) => ({ ...issue })) };
};
