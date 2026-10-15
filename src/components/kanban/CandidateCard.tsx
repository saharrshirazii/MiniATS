import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Linkedin } from "lucide-react";

import type { ApplicationCard } from "@/hooks/useApplications";
import { cn } from "@/lib/utils";

/** One pipeline card: candidate name, job title, LinkedIn link. Draggable between/within columns. */
export function CandidateCard({ application }: { application: ApplicationCard }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: application.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab touch-none rounded-md border bg-background p-2.5 shadow-sm active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <p className="truncate text-sm font-medium" title={application.candidate.full_name}>
        {application.candidate.full_name}
      </p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground" title={application.job.title}>
        {application.job.title}
      </p>
      {application.candidate.linkedin_url && (
        <a
          href={application.candidate.linkedin_url}
          target="_blank"
          rel="noreferrer"
          // Dragging starts from pointerdown anywhere on the card, so this stops
          // a click on the link from also starting a drag.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          aria-label={`${application.candidate.full_name}'s LinkedIn profile`}
        >
          <Linkedin className="size-3" />
          LinkedIn
        </a>
      )}
    </div>
  );
}
