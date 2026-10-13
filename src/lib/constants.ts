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
