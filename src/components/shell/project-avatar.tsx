import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useJiraAvatar, type JiraProject } from "@/lib/jira/queries";
import { cn } from "@/lib/utils";

export function ProjectAvatar({
  project,
  size = "sm",
  className,
}: {
  project: JiraProject;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const avatar = useJiraAvatar(project.avatarUrls["48x48"]);
  return (
    <Avatar size={size} className={cn("rounded-md after:rounded-md", className)}>
      {avatar.data && <AvatarImage src={avatar.data} alt="" className="rounded-md" />}
      <AvatarFallback className="rounded-md">{project.key.slice(0, 2)}</AvatarFallback>
    </Avatar>
  );
}
