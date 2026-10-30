import { useState } from "react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { XIcon } from "lucide-react";
import { AdfEditor } from "@/components/adf-editor";
import { JiraUserAvatar } from "@/components/jira-user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { labelOf, optionsOf, type JiraFieldMeta, type JiraOption, type Kind } from "@/lib/jira/field-values";
import { useJiraUserSearch, type JiraUserResult, type UserSearchScope } from "@/lib/jira/queries";

const NONE = "__none__";

export { encode, initialValue, isEmpty, jiraErrors, kindOf, type JiraFieldMeta, type Kind } from "@/lib/jira/field-values";

export function UserPicker({
  id,
  value,
  multiple,
  scope,
  onChange,
}: {
  id: string;
  value: JiraUserResult | JiraUserResult[] | null;
  multiple: boolean;
  scope?: UserSearchScope;
  onChange: (value: JiraUserResult | JiraUserResult[] | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced] = useDebouncedValue(query, { wait: 200 });
  const results = useJiraUserSearch(debounced, scope);
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const pick = (user: JiraUserResult) => {
    setQuery("");
    if (!multiple) return onChange(user);
    if (!selected.some((item) => item.accountId === user.accountId)) onChange([...selected, user]);
  };
  const remove = (user: JiraUserResult) =>
    onChange(multiple ? selected.filter((item) => item.accountId !== user.accountId) : null);

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((user) => (
            <Badge key={user.accountId} variant="secondary" className="gap-1.5 pr-0.5">
              <JiraUserAvatar user={user} />
              {user.displayName}
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`${user.displayName} entfernen`} onClick={() => remove(user)}>
                <XIcon />
              </Button>
            </Badge>
          ))}
        </div>
      )}
      <Input id={id} value={query} placeholder="Person suchen…" autoComplete="off" onChange={(event) => setQuery(event.target.value)} />
      {query.trim() && (
        <ul className="flex max-h-48 flex-col overflow-y-auto rounded-lg border p-1">
          {results.isFetching && !results.data && <Spinner className="m-2" />}
          {results.data?.length === 0 && <li className="p-2 text-muted-foreground">Niemand gefunden</li>}
          {results.data?.map((user) => (
            <li key={user.accountId}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                onClick={() => pick(user)}
              >
                <JiraUserAvatar user={user} />
                {user.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function JiraFieldInput({
  id,
  field,
  kind,
  value,
  issueKey,
  onChange,
}: {
  id: string;
  field: JiraFieldMeta;
  kind: Kind;
  value: unknown;
  issueKey?: string;
  onChange: (value: unknown) => void;
}) {
  if (kind === "single") {
    const options = optionsOf(field);
    const selected = (value as JiraOption | null)?.id ?? "";
    return (
      <Select value={selected || NONE} onValueChange={(raw) => onChange(options.find((option) => option.id === raw) ?? null)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{field.required ? "Bitte wählen…" : "Keine Auswahl"}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {labelOf(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (kind === "cascade") {
    const options = optionsOf(field);
    const selected = value as (JiraOption & { child?: JiraOption | null }) | null;
    const encoded = selected ? `${selected.id}/${selected.child?.id ?? ""}` : "";
    const choose = (raw: string) => {
      const [parentId, childId] = raw.split("/");
      const parent = options.find((option) => option.id === parentId);
      onChange(parent ? { ...parent, child: parent.children?.find((child) => child.id === childId) ?? null } : null);
    };
    return (
      <Select value={encoded || NONE} onValueChange={choose}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{field.required ? "Bitte wählen…" : "Keine Auswahl"}</SelectItem>
          {options.map((option) => (
            <SelectGroup key={option.id}>
              <SelectLabel>{labelOf(option)}</SelectLabel>
              <SelectItem value={`${option.id}/`}>{labelOf(option)}</SelectItem>
              {option.children
                ?.filter((child) => !child.disabled)
                .map((child) => (
                  <SelectItem key={child.id} value={`${option.id}/${child.id}`}>
                    {labelOf(option)} › {labelOf(child)}
                  </SelectItem>
                ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (kind === "multi") {
    const selected = value as JiraOption[];
    const toggle = (option: JiraOption, checked: boolean) =>
      onChange(checked ? [...selected, option] : selected.filter((item) => item.id !== option.id));
    return (
      <div id={id} className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-lg border p-2">
        {optionsOf(field).map((option) => (
          <Label key={option.id} className="font-normal">
            <Checkbox
              checked={selected.some((item) => item.id === option.id)}
              onCheckedChange={(checked) => toggle(option, checked === true)}
            />
            {labelOf(option)}
          </Label>
        ))}
      </div>
    );
  }
  if (kind === "user" || kind === "users") {
    return (
      <UserPicker
        id={id}
        value={value as JiraUserResult | JiraUserResult[] | null}
        multiple={kind === "users"}
        scope={{ issueKey, assignee: field.schema.system === "assignee" }}
        onChange={onChange}
      />
    );
  }
  if (kind === "richtext") return <AdfEditor id={id} label={field.name} value={value} onChange={onChange} />;
  const type = kind === "number" ? "number" : kind === "date" ? "date" : kind === "datetime" ? "datetime-local" : "text";
  return (
    <Input
      id={id}
      type={type}
      value={String(value)}
      placeholder={kind === "list" ? "Mehrere Werte mit Komma trennen" : undefined}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

