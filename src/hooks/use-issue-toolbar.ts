import type { IssueTableState } from "@/hooks/use-issue-table";
import { QUICK_FILTERS, type QuickFilter } from "@/lib/jira/issue-view";

const PRIMARY_FILTERS: QuickFilter[] = ["mine", "open"];
const SECONDARY_FILTERS = (Object.keys(QUICK_FILTERS) as QuickFilter[]).filter((key) => !PRIMARY_FILTERS.includes(key));

export function useIssueToolbar(table: IssueTableState) {
  return {
    primary: PRIMARY_FILTERS,
    secondary: SECONDARY_FILTERS,
    activeSecondary: table.quick.filter((key) => SECONDARY_FILTERS.includes(key)),
    facetChips: table.facets.flatMap((facet) =>
      facet.selected.map((value) => ({
        facet,
        option: facet.options.find((option) => option.value === value) ?? { value, label: value },
      })),
    ),
  };
}

export type IssueToolbarFilters = ReturnType<typeof useIssueToolbar>;
