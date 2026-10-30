import { motion, useReducedMotion } from "motion/react";
import { IssueAttachments } from "@/components/issue-attachments";
import { IssueFields } from "@/components/issue-fields";
import { IssueWorklog } from "@/components/issue-worklog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { JiraIssueDetail } from "@/lib/jira/queries";
import { EASE_OUT } from "@/lib/ease";

export type IssueDrawerTab = "details" | "attachments" | "time";

export function IssueDrawer({
  issue,
  open,
  tab,
  onOpenChange,
  onTabChange,
}: {
  issue: JiraIssueDetail;
  open: boolean;
  tab: IssueDrawerTab;
  onOpenChange: (open: boolean) => void;
  onTabChange: (tab: IssueDrawerTab) => void;
}) {
  const reduce = useReducedMotion();
  const { fields } = issue;
  const tabs = [
    { id: "details", label: "Details" },
    { id: "attachments", label: `Anhänge · ${fields.attachment?.length ?? 0}` },
    { id: "time", label: "Zeit" },
  ] as const;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="border-b px-5 pt-5 pb-4">
          <SheetDescription className="font-mono text-xs">{issue.key}</SheetDescription>
          <SheetTitle className="truncate pr-8">{fields.summary}</SheetTitle>
        </SheetHeader>
        <Tabs
          value={tab}
          onValueChange={(value) => {
            const next = tabs.find(({ id }) => id === value);
            if (next) onTabChange(next.id);
          }}
          className="min-h-0 flex-1 gap-0"
        >
          <TabsList className="mx-5 mt-4 w-[calc(100%-2.5rem)]">
            {tabs.map(({ id, label }) => (
              <TabsTrigger key={id} value={id}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map(({ id }) => (
            <TabsContent key={id} value={id} className="min-h-0 overflow-y-auto px-5 py-5">
              <motion.div
                initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                {id === "details" && <IssueFields issue={issue} />}
                {id === "attachments" && <IssueAttachments issueKey={issue.key} attachments={fields.attachment ?? []} />}
                {id === "time" && <IssueWorklog issueKey={issue.key} timetracking={fields.timetracking} worklog={fields.worklog} />}
              </motion.div>
            </TabsContent>
          ))}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
