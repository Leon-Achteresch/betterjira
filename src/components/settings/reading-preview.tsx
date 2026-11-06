export function ReadingPreview({
  label,
  eyebrow,
  title,
  body,
  rows,
}: {
  label: string;
  eyebrow: string;
  title: string;
  body: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-xs ring-1 ring-border">
      <p className="text-xs text-muted-foreground tabular-nums">{eyebrow}</p>
      <p className="text-base font-medium text-balance">{title}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 border-t pt-3 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
