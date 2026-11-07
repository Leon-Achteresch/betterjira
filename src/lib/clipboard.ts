import { toast } from "sonner";

const writeClipboard = async (text: string) => navigator.clipboard.writeText(text);

export const copyToClipboard = (text: string, success: string) =>
  writeClipboard(text).then(
    () => void toast.success(success),
    () => void toast.error("Kopieren fehlgeschlagen"),
  );
