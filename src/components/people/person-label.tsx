import { cva, type VariantProps } from "class-variance-authority";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

const avatarVariants = cva("shrink-0", {
  variants: { size: { sm: "size-5", default: "size-8", lg: "size-10" } },
  defaultVariants: { size: "default" },
});
type PersonProps = VariantProps<typeof avatarVariants> & {
  name: string;
  initials: string;
  avatarUrl?: string;
  email?: string;
  organization?: string;
  phone?: string;
  className?: string;
  avatarOnly?: boolean;
  subtitle?: string;
  preview?: boolean;
};

export function PersonLabel({
  name,
  initials,
  avatarUrl,
  email,
  organization,
  phone,
  size,
  className,
  avatarOnly,
  subtitle,
  preview = true,
}: PersonProps) {
  const identity = (
    <span
      tabIndex={preview ? 0 : undefined}
      className={cn(
        "inline-flex min-w-0 items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Avatar className={avatarVariants({ size })}>
        <AvatarImage src={avatarUrl} alt={`Profilbild von ${name}`} />
        <AvatarFallback className="bg-info/10 text-[11px] font-medium text-info">
          {initials}
        </AvatarFallback>
      </Avatar>
      {!avatarOnly && (
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium leading-5">
            {name}
          </span>
          {subtitle && (
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {subtitle}
            </span>
          )}
        </span>
      )}
    </span>
  );
  if (!preview) return identity;
  return (
    <HoverCard>
      <HoverCardTrigger asChild>{identity}</HoverCardTrigger>
      <HoverCardContent className="w-72 p-4" align="start">
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarImage src={avatarUrl} alt="" />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name}</p>
            {organization && (
              <p className="truncate text-xs text-muted-foreground">
                {organization}
              </p>
            )}
          </div>
        </div>
        {email && (
          <p className="mt-3 break-all text-xs text-muted-foreground">
            {email}
          </p>
        )}
        {phone && (
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {phone}
          </p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
