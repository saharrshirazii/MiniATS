import type { Enums } from "@/types/database.types";

export type ApplicationStage = Enums<"application_stage">;

/** Kanban columns, in pipeline order. */
export const STAGES: { value: ApplicationStage; label: string }[] = [
  { value: "applied", label: "Applied" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
];

export type WorkplaceType = Enums<"workplace_type">;

export const WORKPLACE_TYPES: { value: WorkplaceType; label: string }[] = [
  { value: "on_site", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
];

export function workplaceLabel(value: WorkplaceType | null): string | null {
  return WORKPLACE_TYPES.find((w) => w.value === value)?.label ?? null;
}
