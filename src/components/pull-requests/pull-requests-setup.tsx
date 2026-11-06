import { Link } from "@tanstack/react-router";
import { GitPullRequestIcon, SettingsIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { EASE_OUT } from "@/lib/ease";

const COPY = {
  unconfigured: {
    title: "Kein Code-Hosting verbunden",
    description: "Verbinde GitHub, Bitbucket Cloud oder Bitbucket Data Center. Danach erscheinen hier die Pull Requests deiner verknüpften Repositories.",
  },
  unlinked: {
    title: "Noch keine Repositories verknüpft",
    description: "Verknüpfe in den Einstellungen Repositories mit deinen Bereichen. Nur diese Repositories werden hier gelistet.",
  },
} as const;

export function PullRequestsSetup({ reason }: { reason: keyof typeof COPY }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: EASE_OUT }}
    >
      <Empty className="rounded-2xl border border-dashed py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <GitPullRequestIcon />
          </EmptyMedia>
          <EmptyTitle className="text-balance">{COPY[reason].title}</EmptyTitle>
          <EmptyDescription>{COPY[reason].description}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" className="rounded-xl" asChild>
            <Link to="/settings/code-hosting">
              <SettingsIcon />
              Code-Hosting einrichten
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    </motion.div>
  );
}
