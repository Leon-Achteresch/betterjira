export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not(:disabled)",
  "input:not(:disabled):not([type='hidden'])",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export const nextIndex = (count: number, current: number, step: 1 | -1) =>
  current === -1 ? (step === 1 ? 0 : count - 1) : Math.min(Math.max(current + step, 0), count - 1);

export const focusRowLink = (step: 1 | -1) => {
  const links = [...document.querySelectorAll<HTMLElement>("[data-row-link]")].filter((link) => link.getClientRects().length > 0);
  if (links.length === 0) return;
  const active = document.activeElement;
  const current = links.findIndex((link) => link === active || (active instanceof Node && link.parentElement?.contains(active)));
  const target = links[nextIndex(links.length, current, step)];
  target.focus();
  target.scrollIntoView({ block: "nearest" });
};
