import { useIsolatedHtml } from "@/hooks/use-isolated-html";

export function IsolatedHtml({ title, html }: { title: string; html: string }) {
  const onLoad = useIsolatedHtml();
  return (
    <iframe
      title={title}
      sandbox="allow-same-origin"
      srcDoc={html}
      referrerPolicy="no-referrer"
      onLoad={onLoad}
      className="min-h-12 w-full border-0"
    />
  );
}
