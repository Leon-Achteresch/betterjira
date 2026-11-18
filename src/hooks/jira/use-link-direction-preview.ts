import type { IssueLinkReference } from "@/lib/jira/issue-links";
import { jiraKeys } from "@/lib/jira/keys";
import {
  linkDirectionPreviewError,
  readLinkDirectionPreview,
} from "@/lib/jira/link-direction-preview";
import {
  useIssueLinkPreview,
  type IssueLinkPreviewContext,
} from "./use-issue-link-preview";

export function useLinkDirectionPreview(
  context: IssueLinkPreviewContext,
  target: string,
  reference: IssueLinkReference,
) {
  return useIssueLinkPreview(context, target, reference, {
    eligible: !!reference.directed,
    key: jiraKeys.linkDirectionPreview,
    read: readLinkDirectionPreview,
    error: linkDirectionPreviewError,
  });
}
