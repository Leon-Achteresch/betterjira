import { createContext, useContext } from "react";
import type { JiraIssueDetail } from "@/lib/jira/queries";

export type JiraAttachment = NonNullable<JiraIssueDetail["fields"]["attachment"]>[number];
export type IssueMedia = { attachments: readonly JiraAttachment[]; open: (attachment: JiraAttachment) => void };

export const IssueMediaContext = createContext<IssueMedia | null>(null);

export const useIssueMedia = () => useContext(IssueMediaContext);
