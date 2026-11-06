export function extractHighlights(source: string, max = 3): string[] {
  const items: string[] = [];
  for (const line of source.split("\n")) {
    const match = line.trim().match(/^[-*•+]\s+(.+)$/) ?? line.trim().match(/^\d+\.\s+(.+)$/);
    if (!match?.[1]) continue;
    const clean = match[1]
      .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
      .replace(/[*_`]/g, "")
      .trim();
    if (clean && !items.includes(clean)) items.push(clean);
    if (items.length >= max) break;
  }
  return items;
}

export function publishedLabel(date: string | undefined): string | null {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("de-DE", { dateStyle: "medium" });
}
