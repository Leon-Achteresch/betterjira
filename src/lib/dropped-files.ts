export const carriesFiles = (data: DataTransfer | null) => !!data?.types.includes("Files");

export const pastedFiles = (data: DataTransfer | null) => (data?.types.includes("text/plain") ? [] : [...(data?.files ?? [])]);

export const acceptsFileDrop = (target: EventTarget | null) => {
  const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  return !!element?.closest("[data-file-drop]");
};
