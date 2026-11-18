import type { SearchIssue } from "./search";

export const LABEL_COMPARISON_LIMITS = { issues: 1000, labelsPerIssue: 100, labels: 500, length: 255, matches: 20, examples: 3 } as const;
export type LabelOccurrence = { label: string; count: number; examples: string[] };

export function collectComparisonLabels(issues: readonly SearchIssue[]) {
  const labels = new Map<string, LabelOccurrence>();
  const ids = new Set<string>(); const keys = new Set<string>();
  let checked = 0; let unreadable = 0; let invalid = 0; let omitted = 0;
  for (const issue of issues.slice(0, LABEL_COMPARISON_LIMITS.issues)) {
    if (ids.has(issue.id) || keys.has(issue.key)) continue;
    ids.add(issue.id); keys.add(issue.key); checked++;
    const values = issue.fields.labels;
    if (!Array.isArray(values)) { unreadable++; continue; }
    omitted += Math.max(0, values.length - LABEL_COMPARISON_LIMITS.labelsPerIssue);
    const seen = new Set<string>();
    for (const label of values.slice(0, LABEL_COMPARISON_LIMITS.labelsPerIssue)) {
      if (typeof label !== "string" || !label.length || label.length > LABEL_COMPARISON_LIMITS.length || /\s/.test(label)) { invalid++; continue; }
      if (seen.has(label)) continue;
      seen.add(label);
      const entry = labels.get(label);
      if (entry) {
        entry.count++;
        if (entry.examples.length < LABEL_COMPARISON_LIMITS.examples) entry.examples.push(issue.key);
      } else if (labels.size < LABEL_COMPARISON_LIMITS.labels) labels.set(label, { label, count: 1, examples: [issue.key] });
      else omitted++;
    }
  }
  return {
    labels: [...labels.values()].sort((a, b) => a.label.localeCompare(b.label, "de", { sensitivity: "variant" })),
    sourceCount: issues.length, checked, unreadable, invalid, omitted,
    limitedIssues: Math.max(0, issues.length - LABEL_COMPARISON_LIMITS.issues),
  };
}

const oneEditApart = (left: string, right: string) => {
  const a = Array.from(left); const b = Array.from(right);
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0; let j = 0; let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length <= b.length) j++;
    if (a.length >= b.length) i++;
  }
  return edits + Number(i < a.length || j < b.length) === 1;
};

const resemblance = (left: string, right: string) => {
  const a = left.normalize("NFC").toLowerCase(); const b = right.normalize("NFC").toLowerCase();
  if (a === b) return { rank: 0, reason: "Groß-/Kleinschreibung oder Unicode-Darstellung" };
  const compact = (value: string) => value.replace(/[-_.]/g, "");
  if (compact(a) && compact(a) === compact(b)) return { rank: 1, reason: "Andere Trennzeichen oder Schreibweise" };
  if (Array.from(a).length >= 5 && Array.from(b).length >= 5 && oneEditApart(a, b)) return { rank: 2, reason: "Ein Zeichen Unterschied" };
  return undefined;
};

export function compareLabelVariants(labels: readonly LabelOccurrence[], reference: string) {
  const source = labels.slice(0, LABEL_COMPARISON_LIMITS.labels);
  const selected = source.find((entry) => entry.label === reference);
  if (!selected) return { selected: undefined, matches: [], totalMatches: 0 };
  const candidates = source.flatMap((entry) => {
    if (entry.label === reference) return [];
    const match = resemblance(reference, entry.label);
    return match ? [{ ...entry, ...match }] : [];
  }).sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label, "de", { sensitivity: "variant" }));
  return { selected, matches: candidates.slice(0, LABEL_COMPARISON_LIMITS.matches), totalMatches: candidates.length };
}
