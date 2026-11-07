import { useProjectDirectoryData } from "@/hooks/jira/use-project-directory-data";

export const useProjectDirectory = useProjectDirectoryData;

export type ProjectDirectoryState = ReturnType<typeof useProjectDirectory>;
