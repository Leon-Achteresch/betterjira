import { composeJql, quoteJql, textClause } from "@/lib/jira/jql";

export const ALL_PROJECTS_JQL = 'project in projectsWhereUserHasPermission("Browse Projects")';

const SIMPLE_ORDER = "ORDER BY updated DESC";

const RESERVED = /[+&|!(){}[\]^~*?\\:"/]/g;

export const searchTerms = (text: string) =>
  text
    .replace(RESERVED, " ")
    .split(/\s+/)
    .map((term) => term.replace(/^-+|-+$/g, ""))
    .filter(Boolean)
    .join(" ");

export const projectClause = (key?: string) => (key ? `project = ${quoteJql(key)}` : ALL_PROJECTS_JQL);

export const simpleSearchJql = (project: string | undefined, text: string) =>
  composeJql(SIMPLE_ORDER, [projectClause(project), textClause(searchTerms(text))]);
