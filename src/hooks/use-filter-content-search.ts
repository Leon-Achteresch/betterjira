import { useMemo, useState } from "react";
import {
  FILTER_CONTENT_PAGE_SIZE,
  filterContentCoverage,
  findFilterContent,
} from "@/lib/filter-overview";
import type { JiraFilter } from "@/lib/jira/saved-filters";

export function useFilterContentSearch(filters: readonly JiraFilter[]) {
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const [requestedPage, setPage] = useState(1);
  const coverage = useMemo(() => filterContentCoverage(filters), [filters]);
  const matches = useMemo(
    () => findFilterContent(filters, term),
    [filters, term],
  );
  const pageCount = Math.max(
    1,
    Math.ceil(matches.length / FILTER_CONTENT_PAGE_SIZE),
  );
  const page = Math.min(requestedPage, pageCount);
  return {
    input,
    searched: !!term,
    coverage,
    pageCount,
    page,
    total: matches.length,
    matches: matches.slice(
      (page - 1) * FILTER_CONTENT_PAGE_SIZE,
      page * FILTER_CONTENT_PAGE_SIZE,
    ),
    change: (value: string) => {
      setInput(value);
      setTerm("");
      setPage(1);
    },
    submit: () => {
      setTerm(input.trim());
      setPage(1);
    },
    previous: () => setPage(Math.max(1, page - 1)),
    next: () => setPage(Math.min(pageCount, page + 1)),
  };
}
