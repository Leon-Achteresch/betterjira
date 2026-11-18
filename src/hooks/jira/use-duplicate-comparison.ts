import {
  duplicateComparisonError,
  readDuplicateComparison,
} from "@/lib/jira/duplicate-comparison";
import type { IssueLinkReference } from "@/lib/jira/issue-links";
import { jiraKeys } from "@/lib/jira/keys";
import {
  useIssueLinkPreview,
  type IssueLinkPreviewContext,
} from "./use-issue-link-preview";

export function useDuplicateComparison(
  context: IssueLinkPreviewContext,
  target: string,
  reference: IssueLinkReference,
) {
  return useIssueLinkPreview(context, target, reference, {
    eligible: !!reference.duplicate,
    key: jiraKeys.duplicateComparison,
    read: readDuplicateComparison,
    error: duplicateComparisonError,
  });
}
