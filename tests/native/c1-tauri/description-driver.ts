import { button, check, click, wait } from "./driver";

export const comparison = () => document.querySelector('[role=group][aria-labelledby="description-comparison-title"]');
export const editor = () => document.querySelector<HTMLElement>('[role=textbox][aria-label="Beschreibung"]');
export const openEditor = (label = "Beschreibung bearbeiten") => click(() => button(label), "description editor");
export const append = async (text: string) => {
  const field = await wait(() => {
    const current = editor();
    return current === document.activeElement ? current : undefined;
  }, "editor focus");
  const lastBlock = field.lastElementChild!;
  getSelection()!.collapse(lastBlock, lastBlock.childNodes.length);
  check(document.execCommand("insertText", false, text), "WebKit text input failed");
  await wait(() => field.textContent.includes(text), text);
};
export const save = () => click(() => button("Speichern"), "description save");
export const currentPreview = () => comparison()?.querySelector('[role=region][aria-label="Aktuell in Jira"]');
export const confirmButton = () => button("Entwurf trotzdem speichern", comparison());
export const requireConflict = async (text: string) => {
  await wait(() => currentPreview()?.textContent.includes(text), text);
  check(confirmButton()?.disabled, "Overwrite enabled without acknowledgement");
};
export const confirm = async () => {
  await click(() => comparison()?.querySelector<HTMLElement>("[role=checkbox]"), "acknowledge comparison");
  await click(confirmButton, "confirm draft");
};
