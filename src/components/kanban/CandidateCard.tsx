import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Linkedin, Sparkles } from "lucide-react";

import { CvLink } from "@/components/candidates/CvLink";
import { Badge } from "@/components/ui/badge";
import type { ApplicationCard } from "@/hooks/useApplications";
import { scoreBadgeClass } from "@/lib/ai-assessment";
import { cn } from "@/lib/utils";

/**
 * One pipeline card: candidate name, job title, LinkedIn and CV links.
 * Draggable between/within columns; a plain click (no drag) opens the
 * candidate's detail profile.
 */
export function CandidateCard({
  application,
  onOpenProfile,
}: {
  application: ApplicationCard;
  /** Open the candidate's detail sheet. Omitted for the drag-overlay copy. */
  onOpenProfile?: (candidateId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: application.id,
  });
  const { linkedin_url, cv_path } = application.candidate;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      // A plain click has no pointer movement, so dnd-kit's activation
      // constraint (see KanbanBoard) never fires drag start for it — only a
      // drag (movement past the threshold) suppresses this.
      onClick={() => onOpenProfile?.(application.candidate.id)}
      className={cn(
        "cursor-grab touch-none rounded-md border bg-background p-2.5 shadow-sm active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-medium" title={application.candidate.full_name}>
          {application.candidate.full_name}
        </p>
        {application.ai_score != null && (
          <Badge
            variant="outline"
            className={cn("shrink-0 gap-0.5", scoreBadgeClass(application.ai_score))}
            title="AI fit score — advisory only"
          >
            <Sparkles className="size-3" />
            {application.ai_score}
          </Badge>
        )}
      </div>
      <p className="mt-0.5 truncate text-xs text-muted-foreground" title={application.job.title}>
        {application.job.title}
      </p>
      {(linkedin_url || cv_path) && (
        <div className="mt-1.5 flex items-center gap-3">
          {linkedin_url && (
            <a
              href={linkedin_url}
              target="_blank"
              rel="noreferrer"
              // Dragging starts from pointerdown anywhere on the card, so this stops
              // a click on the link from also starting a drag or opening the profile.
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              aria-label={`${application.candidate.full_name}'s LinkedIn profile`}
            >
              <Linkedin className="size-3" />
              LinkedIn
            </a>
          )}
          {cv_path && (
            <span onPointerDown={(e) => e.stopPropagation()} className="text-xs">
              <CvLink path={cv_path} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
