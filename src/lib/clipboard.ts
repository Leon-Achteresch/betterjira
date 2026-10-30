import { toast } from "sonner";

export const copyToClipboard = (text: string, success: string) =>
  navigator.clipboard.writeText(text).then(
    () => void toast.success(success),
    () => void toast.error("Kopieren fehlgeschlagen"),
  );
