import { useQuery } from "@tanstack/react-query";
import { useJiraSite } from "@/lib/jira/queries";
import { fieldCatalogQuery } from "@/lib/jira/metadata-query";

export const useFieldCatalog = () => {
  const site = useJiraSite();
  return useQuery({
    ...fieldCatalogQuery(),
    enabled: !!site.data,
  });
};
