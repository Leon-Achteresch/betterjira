export type SortDirection = "ASC" | "DESC";
export type JqlSort = { field: string; direction: SortDirection };

const ORDER_BY = /(?:^|\s)order\s+by\s+([\s\S]*)$/i;

export const splitJql = (jql: string) => {
  const match = ORDER_BY.exec(jql);
  if (!match) return { where: jql.trim(), orderBy: "" };
  return { where: jql.slice(0, match.index).trim(), orderBy: match[1]!.trim() };
};

export const quoteJql = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

export const EMPTY_VALUE = "EMPTY";

export const valuesClause = (field: string, values: readonly string[]) => {
  const named = values.filter((value) => value !== EMPTY_VALUE);
  const parts = [
    named.length > 0 ? `${field} in (${named.map(quoteJql).join(", ")})` : "",
    values.includes(EMPTY_VALUE) ? `${field} is EMPTY` : "",
  ].filter(Boolean);
  return parts.length > 1 ? `(${parts.join(" OR ")})` : (parts[0] ?? "");
};

export const textClause = (text: string) => {
  const term = text.trim();
  return term ? `text ~ ${quoteJql(`${term}*`)}` : "";
};

export const orderByClause = (sort: readonly JqlSort[]) =>
  sort.map(({ field, direction }) => `${field} ${direction}`).join(", ");

export const composeJql = (base: string, clauses: readonly string[], sort: readonly JqlSort[] = []) => {
  const { where, orderBy } = splitJql(base);
  const extra = clauses.filter(Boolean);
  const conditions = [where && extra.length > 0 ? `(${where})` : where, ...extra].filter(Boolean).join(" AND ");
  const order = sort.length > 0 ? orderByClause(sort) : orderBy;
  return [conditions, order && `ORDER BY ${order}`].filter(Boolean).join(" ");
};

export const cycleSort = (sort: readonly JqlSort[], field: string, additive: boolean): JqlSort[] => {
  const current = sort.find((entry) => entry.field === field);
  const next: JqlSort | undefined = !current
    ? { field, direction: "ASC" }
    : current.direction === "ASC"
      ? { field, direction: "DESC" }
      : undefined;
  if (!additive) return next ? [next] : [];
  const others = sort.filter((entry) => entry.field !== field);
  if (!next) return others;
  return current ? sort.map((entry) => (entry.field === field ? next : entry)) : [...others, next];
};
