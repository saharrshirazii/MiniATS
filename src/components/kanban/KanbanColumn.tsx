import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";

import { CandidateCard } from "@/components/kanban/CandidateCard";
import type { ApplicationCard, ApplicationStage } from "@/hooks/useApplications";
import { cn } from "@/lib/utils";

type Props = {
  stage: ApplicationStage;
  label: string;
  applications: ApplicationCard[];
};

/** One stage column: droppable area, sortable list of cards, count in the header. */
export function KanbanColumn({ stage, label, applications }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <section
      className={cn(
        "flex w-64 shrink-0 flex-col rounded-lg border bg-muted/40 transition-colors",
        isOver && "border-primary/50 bg-muted/70",
      )}
    >
      <h2 className="flex items-center justify-between border-b px-3 py-2 text-sm font-medium">
        {label}
        <span className="text-xs text-muted-foreground">{applications.length}</span>
      </h2>
      <div ref={setNodeRef} className="min-h-40 flex-1 space-y-2 p-2">
        <SortableContext
          items={applications.map((a) => a.id)}
          strategy={verticalListSortingStrategy}
        >
          {applications.map((application) => (
            <CandidateCard key={application.id} application={application} />
          ))}
        </SortableContext>
        {applications.length === 0 && (
          <p className="px-1 py-2 text-center text-xs text-muted-foreground">No candidates</p>
        )}
      </div>
    </section>
  );
}
