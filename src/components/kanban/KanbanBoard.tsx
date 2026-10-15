import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState } from "react";

import { CandidateCard } from "@/components/kanban/CandidateCard";
import { KanbanColumn } from "@/components/kanban/KanbanColumn";
import type { ApplicationCard, ApplicationStage } from "@/hooks/useApplications";
import { useMoveApplication } from "@/hooks/useApplications";
import { STAGES } from "@/lib/constants";

const STAGE_VALUES = new Set<string>(STAGES.map((s) => s.value));

function groupByStage(applications: ApplicationCard[]) {
  const groups = new Map<ApplicationStage, ApplicationCard[]>(STAGES.map((s) => [s.value, []]));
  for (const app of applications) groups.get(app.stage)?.push(app);
  for (const list of groups.values()) list.sort((a, b) => a.position - b.position);
  return groups;
}

export function KanbanBoard({
  orgId,
  applications,
  onOpenProfile,
}: {
  orgId: string;
  applications: ApplicationCard[];
  onOpenProfile?: (candidateId: string) => void;
}) {
  const moveApplication = useMoveApplication();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const groups = groupByStage(applications);
  const activeApp = activeId ? applications.find((a) => a.id === activeId) : undefined;

  const handleDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeCard = applications.find((a) => a.id === active.id);
    if (!activeCard) return;

    const overId = String(over.id);
    const destStage: ApplicationStage = STAGE_VALUES.has(overId)
      ? (overId as ApplicationStage)
      : (applications.find((a) => a.id === overId)?.stage ?? activeCard.stage);

    const sourceStage = activeCard.stage;

    // Rebuild the destination column (and the source column, if different) with the
    // card in its new spot, then assign fresh sequential positions to each.
    const destList = (groups.get(destStage) ?? []).filter((a) => a.id !== activeCard.id);
    const overIndex = destList.findIndex((a) => a.id === overId);
    const insertAt = overIndex === -1 ? destList.length : overIndex;
    destList.splice(insertAt, 0, activeCard);

    const sourceList =
      sourceStage === destStage
        ? destList
        : (groups.get(sourceStage) ?? []).filter((a) => a.id !== activeCard.id);

    const changed: { id: string; position: number }[] = [];
    destList.forEach((a, i) => {
      if (a.id !== activeCard.id && a.position !== i) changed.push({ id: a.id, position: i });
    });
    if (sourceStage !== destStage) {
      sourceList.forEach((a, i) => {
        if (a.position !== i) changed.push({ id: a.id, position: i });
      });
    }

    const newPosition = destList.findIndex((a) => a.id === activeCard.id);
    if (sourceStage === destStage && newPosition === activeCard.position) return; // no-op drop

    moveApplication.mutate({
      id: activeCard.id,
      orgId,
      stage: destStage,
      position: newPosition,
      reordered: changed,
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {STAGES.map((stage) => (
          <KanbanColumn
            key={stage.value}
            stage={stage.value}
            label={stage.label}
            applications={groups.get(stage.value) ?? []}
            onOpenProfile={onOpenProfile}
          />
        ))}
      </div>
      <DragOverlay>
        {/* No onOpenProfile here — the overlay is a drag preview, not a clickable card. */}
        {activeApp && <CandidateCard application={activeApp} />}
      </DragOverlay>
    </DndContext>
  );
}
