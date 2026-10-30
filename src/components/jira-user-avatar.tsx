import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function JiraUserAvatar({
  user,
  size = "sm",
}: {
  user: { displayName: string; avatarUrls: { "48x48": string } };
  size?: "sm" | "default" | "lg";
}) {
  const initials = user.displayName
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2);
  return (
    <Avatar size={size}>
      <AvatarImage src={user.avatarUrls["48x48"]} alt="" />
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}

export function JiraUserLabel({ user }: { user?: { displayName: string; avatarUrls: { "48x48": string } } | null }) {
  if (!user) return <span className="text-muted-foreground">Nicht zugewiesen</span>;
  return (
    <span className="flex items-center gap-2">
      <JiraUserAvatar user={user} />
      {user.displayName}
    </span>
  );
}
