import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useIsMutating } from "@tanstack/react-query";
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
import { useCreateIssueDrafts } from "@/hooks/jira/use-create-issue-drafts";
import { useCreateIssueParent } from "@/hooks/jira/use-create-issue-parent";
import { useLatestRef } from "@/hooks/use-latest-ref";
import {
  creationFieldScope,
  EMPTY_CREATION_DRAFT,
  hasCreationContent,
  nextCreationDraft,
  validatedCreationDraft,
  type CreationDraft,
  type IssueTemplate,
} from "@/lib/jira/create-issue-drafts";
import { isEmpty } from "@/lib/jira/field-values";
import { useJiraProjects, useJiraSite } from "@/lib/jira/queries";

export type CreateIssueStatus = "no-project" | "loading" | "load-error" | "no-permission" | "no-types" | "blocked" | "parent-invalid" | "ready";

export const fieldInputId = (fieldId: string) => `create-field-${fieldId}`;

export function useCreateIssueForm(parentKey?: string) {
  const navigate = useNavigate();
  const site = useJiraSite();
  const projects = useJiraProjects();
  const create = useCreateIssue();
  const submitting = useRef(false);
  const mounted = useRef(true);
  const pending = useIsMutating({ mutationKey: ["jira", "create-issue"] }) > 0;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const parent = useCreateIssueParent(parentKey);
  const storage = useCreateIssueDrafts(parentKey);
  const latestAccount = useLatestRef(storage.id);
  const { draft: savedDraft, templates: allTemplates } = storage.workspace;
  const { projectId: chosenProjectId, issueTypeId: chosenTypeId, summary, description, values } = savedDraft;
  const [createAnother, setCreateAnother] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const updateDraft = (transform: (draft: CreationDraft) => CreationDraft) => {
    if (storage.id && latestAccount.current === storage.id) {
      storage.update(storage.id, (workspace) => ({ ...workspace, draft: transform(workspace.draft) }));
    }
  };
  const [attempted, setAttempted] = useState(false);

  const projectList = projects.data ?? [];
  const projectId = parentKey ? parent.data?.fields.project.id : chosenProjectId ?? (projectList.length === 1 ? projectList[0]!.id : undefined);
  const project = projectList.find((entry) => entry.id === projectId) ?? parent.data?.fields.project;
  const permission = useCreatePermission(projectId);
  const types = useCreateIssueTypes(projectId, permission.data === true);
  const typeList = (types.data ?? []).filter((type) => !parentKey || type.subtask);
  const issueType = typeList.find((type) => type.id === chosenTypeId && (!!parentKey === !!type.subtask)) ?? (parentKey ? typeList[0] : defaultIssueType(typeList));
  const fields = useCreateFields(projectId, issueType?.id);
  const fieldList = fields.data ?? [];
  const plan = planFields(fieldList, parentKey);
  const scope = creationFieldScope(projectId, issueType?.id);
  const validation = validatedCreationDraft({ summary, description, values: values[scope] ?? {} }, plan);
  const editableDraft = validatedCreationDraft({ summary, description, values: values[scope] ?? {} }, plan, true).draft;
  const draft = validation.draft;
  const templates = allTemplates.filter((template) => template.projectId === projectId && template.issueTypeId === issueType?.id);
  const templateNameExists = templates.some(({ name }) => name.toLocaleLowerCase() === templateName.trim().toLocaleLowerCase());
  const missing = new Set(attempted ? missingFields(draft, plan) : []);
  const errors = createErrors(create.error, fieldList, plan);
  const loadError = (projects.data ? null : projects.error) ?? parent.error ?? permission.error ?? types.error ?? fields.error;

  const status: CreateIssueStatus = loadError
    ? "load-error"
    : parent.data?.fields.issuetype.subtask
      ? "parent-invalid"
      : !storage.id || (parentKey && parent.isPending)
      ? "loading"
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
    if (submitting.current || pending || status !== "ready" || !projectId || !issueType) return;
    setAttempted(true);
    const firstMissing = missingFields(draft, plan)[0];
    if (firstMissing) {
      document.getElementById(firstMissing === "summary" ? "create-summary" : fieldInputId(firstMissing))?.focus();
      return;
    }
    submitting.current = true;
    const account = storage.id;
    const submittedDraft = savedDraft;
    void create.mutateAsync(createPayload(projectId, issueType.id, draft, plan, parentKey)).then((issue) => {
      if (account) storage.update(account, (workspace) => ({
        ...workspace,
        draft: workspace.draft === submittedDraft
          ? { ...(createAnother ? nextCreationDraft(submittedDraft) : EMPTY_CREATION_DRAFT), projectId, issueTypeId: issueType.id }
          : workspace.draft,
      }));
      submitting.current = false;
      if (!mounted.current || latestAccount.current !== account) return;
      toast.success(`${issue.key} erstellt`, createAnother ? {
        action: { label: "Öffnen", onClick: () => void navigate({ to: "/issue/$key", params: { key: issue.key } }) },
      } : undefined);
      if (createAnother) {
        create.reset();
        setAttempted(false);
        requestAnimationFrame(() => document.getElementById("create-summary")?.focus());
      } else void navigate({ to: "/issue/$key", params: { key: issue.key } });
    }).catch(() => {
      submitting.current = false;
    });
  };

  const discardDraft = () => {
    const account = storage.id;
    if (!account || pending) return;
    const before = savedDraft;
    const cleared = { ...EMPTY_CREATION_DRAFT, projectId, issueTypeId: issueType?.id };
    updateDraft(() => cleared);
    changeSelection();
    toast.success("Entwurf verworfen", {
      action: { label: "Rückgängig", onClick: () => storage.update(account, (workspace) => ({
        ...workspace,
        draft: workspace.draft === cleared ? before : workspace.draft,
      })) },
    });
  };

  const saveTemplate = () => {
    const account = storage.id;
    const name = templateName.trim();
    if (!account || !name || !projectId || !issueType || status !== "ready" || templateNameExists || !hasCreationContent(savedDraft)) return;
    const template: IssueTemplate = { ...draft, id: crypto.randomUUID(), name, projectId, issueTypeId: issueType.id };
    storage.update(account, (workspace) => ({ ...workspace, templates: [...workspace.templates, template] }));
    setTemplateName("");
    toast.success("Vorlage gespeichert");
  };

  const applyTemplate = (template: IssueTemplate) => {
    const account = storage.id;
    if (!account || status !== "ready" || template.projectId !== projectId || template.issueTypeId !== issueType?.id) return;
    const before = savedDraft;
    const checked = validatedCreationDraft(template, plan);
    const replacement = { ...savedDraft, summary: checked.draft.summary, description: checked.draft.description, values: { ...values, [scope]: checked.draft.values } };
    updateDraft(() => replacement);
    changeSelection();
    setTemplatesOpen(false);
    toast.success(checked.removed.length ? "Vorlage angewendet; veraltete Felder bitte neu ausfüllen" : "Vorlage angewendet", {
      action: { label: "Rückgängig", onClick: () => storage.update(account, (workspace) => ({
        ...workspace,
        draft: workspace.draft === replacement ? before : workspace.draft,
      })) },
    });
  };

  const removeTemplate = (template: IssueTemplate) => {
    const account = storage.id;
    if (!account) return;
    storage.update(account, (workspace) => ({ ...workspace, templates: workspace.templates.filter(({ id }) => id !== template.id) }));
    toast.success("Vorlage gelöscht", {
      action: { label: "Rückgängig", onClick: () => storage.update(account, (workspace) => ({
        ...workspace,
        templates: workspace.templates.some(({ id }) => id === template.id) ? workspace.templates : [...workspace.templates, template],
      })) },
    });
  };

  return {
    status,
    parentKey,
    parent: parent.data,
    draftReady: !!storage.id,
    hasDraft: hasCreationContent(savedDraft),
    staleFields: fields.isPending ? [] : validation.removed,
    discardDraft,
    createAnother,
    setCreateAnother,
    templates,
    templatesOpen,
    setTemplatesOpen,
    templateName,
    templateNameExists,
    setTemplateName,
    saveTemplate,
    applyTemplate,
    removeTemplate,
    onTemplateKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        if (!event.nativeEvent.isComposing) saveTemplate();
      }
    },
    pending,
    projects: projectList,
    projectsLoading: projects.isPending,
    project,
    issueTypes: typeList,
    issueType,
    plan,
    summary,
    description: draft.description,
    descriptionIgnored: !fields.isPending && !plan.description && !isEmpty(description),
    showDescription: !!plan.description || (!!issueType && fields.isPending),
    fieldsLoading: !!issueType && fields.isPending,
    loadError: loadError?.message,
    errors,
    missing,
    valueOf: (input: CreateInput) => inputValue(editableDraft, input),
    selectProject: (id: string) => {
      updateDraft((current) => ({ ...current, projectId: id, issueTypeId: undefined }));
      changeSelection();
    },
    selectIssueType: (id: string) => {
      updateDraft((current) => ({ ...current, issueTypeId: id }));
      changeSelection();
    },
    setSummary: (value: string) => updateDraft((current) => ({ ...current, summary: value })),
    setDescription: (value: unknown) => updateDraft((current) => ({ ...current, description: value })),
    setValue: (fieldId: string, value: unknown) =>
      updateDraft((current) => ({ ...current, values: { ...current.values, [scope]: { ...current.values[scope], [fieldId]: value } } })),
    retryLoad: () => {
      for (const query of [projects, parent, permission, types, fields]) if (query.isError) void query.refetch();
    },
    openInJira: () => {
      if (!site.data || !projectId) return;
      openUrl(parentKey ? `${site.data.siteUrl.replace(/\/+$/, "")}/browse/${parentKey}` : jiraCreateUrl(site.data.siteUrl, projectId, issueType?.id, summary)).catch(() =>
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
