export const carriesFiles = (data: DataTransfer | null) => !!data?.types.includes("Files");

export const acceptsFileDrop = (target: EventTarget | null) => {
  const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  return !!element?.closest("[data-file-drop]");
};
