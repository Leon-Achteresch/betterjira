import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import { useCreateFields, useCreateIssue, useCreateIssueTypes, useCreatePermission } from "@/hooks/jira/use-create-issue";
import {
  createErrors,
  createPayload,
  defaultIssueType,
  inputValue,
  jiraCreateUrl,
  missingFields,
  planFields,
  type CreateInput,
} from "@/lib/jira/create-issue-form";
import { isEmpty } from "@/lib/jira/field-values";
import { useJiraProjects, useJiraSite } from "@/lib/jira/queries";

export type CreateIssueStatus = "no-project" | "loading" | "load-error" | "no-permission" | "no-types" | "blocked" | "ready";

export const fieldInputId = (fieldId: string) => `create-field-${fieldId}`;

export function useCreateIssueForm() {
  const navigate = useNavigate();
  const site = useJiraSite();
  const projects = useJiraProjects();
  const create = useCreateIssue();
  const submitting = useRef(false);
  const [chosenProjectId, setChosenProjectId] = useState<string>();
  const [chosenTypeId, setChosenTypeId] = useState<string>();
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState<unknown>(null);
  const [values, setValues] = useState<Record<string, Record<string, unknown>>>({});
  const [attempted, setAttempted] = useState(false);

  const projectList = projects.data ?? [];
  const projectId = chosenProjectId ?? (projectList.length === 1 ? projectList[0]!.id : undefined);
  const project = projectList.find((entry) => entry.id === projectId);
  const permission = useCreatePermission(projectId);
  const types = useCreateIssueTypes(projectId, permission.data === true);
  const typeList = types.data ?? [];
  const issueType = typeList.find((type) => type.id === chosenTypeId && !type.subtask) ?? defaultIssueType(typeList);
  const fields = useCreateFields(projectId, issueType?.id);
  const fieldList = fields.data ?? [];
  const plan = planFields(fieldList);
  const scope = `${projectId}/${issueType?.id}`;
  const draft = { summary, description, values: values[scope] ?? {} };
  const missing = new Set(attempted ? missingFields(draft, plan) : []);
  const errors = createErrors(create.error, fieldList, plan);
  const loadError = (projects.data ? null : projects.error) ?? permission.error ?? types.error ?? fields.error;

  const status: CreateIssueStatus = loadError
    ? "load-error"
    : !projectId
      ? "no-project"
      : permission.data === false
        ? "no-permission"
        : permission.isPending || types.isPending
          ? "loading"
          : !issueType
            ? "no-types"
            : fields.isPending
              ? "loading"
              : plan.blocked.length > 0
                ? "blocked"
                : "ready";

  const changeSelection = () => {
    create.reset();
    setAttempted(false);
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (submitting.current || create.isPending || status !== "ready" || !projectId || !issueType) return;
    setAttempted(true);
    const firstMissing = missingFields(draft, plan)[0];
    if (firstMissing) {
      document.getElementById(firstMissing === "summary" ? "create-summary" : fieldInputId(firstMissing))?.focus();
      return;
    }
    submitting.current = true;
    create.mutate(createPayload(projectId, issueType.id, draft, plan), {
      onSuccess: (issue) => {
        toast.success(`${issue.key} erstellt`);
        void navigate({ to: "/issue/$key", params: { key: issue.key } });
      },
      onError: () => {
        submitting.current = false;
      },
    });
  };

  return {
    status,
    pending: create.isPending,
    projects: projectList,
    projectsLoading: projects.isPending,
    project,
    issueTypes: typeList,
    issueType,
    plan,
    summary,
    description,
    descriptionIgnored: !fields.isPending && !plan.description && !isEmpty(description),
    showDescription: !!plan.description || (!!issueType && fields.isPending),
    fieldsLoading: !!issueType && fields.isPending,
    loadError: loadError?.message,
    errors,
    missing,
    valueOf: (input: CreateInput) => inputValue(draft, input),
    selectProject: (id: string) => {
      setChosenProjectId(id);
      changeSelection();
    },
    selectIssueType: (id: string) => {
      setChosenTypeId(id);
      changeSelection();
    },
    setSummary,
    setDescription,
    setValue: (fieldId: string, value: unknown) =>
      setValues((current) => ({ ...current, [scope]: { ...current[scope], [fieldId]: value } })),
    retryLoad: () => {
      for (const query of [projects, permission, types, fields]) if (query.isError) void query.refetch();
    },
    openInJira: () => {
      if (!site.data || !projectId) return;
      openUrl(jiraCreateUrl(site.data.siteUrl, projectId, issueType?.id, summary)).catch(() =>
        toast.error("Jira konnte nicht geöffnet werden"),
      );
    },
    submit,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) {
        event.preventDefault();
        submit();
      }
    },
  };
}

export type CreateIssueForm = ReturnType<typeof useCreateIssueForm>;
