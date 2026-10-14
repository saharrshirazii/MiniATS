import { workplaceLabel, type WorkplaceType } from "@/lib/constants";
import { JOB_STATUS_LABELS } from "@/lib/job-status";
import type { Enums, Json } from "@/types/database.types";

export type LogAction = Enums<"log_action">;
export type LogEntityType = Enums<"log_entity_type">;

export const LOG_ACTIONS: { value: LogAction; label: string }[] = [
  { value: "created", label: "Created" },
  { value: "updated", label: "Edited" },
  { value: "status_changed", label: "Status changed" },
  { value: "deleted", label: "Deleted" },
  { value: "restored", label: "Restored" },
  { value: "deleted_permanently", label: "Deleted permanently" },
];

export const LOG_ENTITY_TYPES: { value: LogEntityType; label: string }[] = [
  { value: "job", label: "Job" },
];

export const logActionLabel = (a: LogAction) =>
  LOG_ACTIONS.find((x) => x.value === a)?.label ?? a;
export const logEntityLabel = (t: LogEntityType) =>
  LOG_ENTITY_TYPES.find((x) => x.value === t)?.label ?? t;

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  location: "Location",
  workplace_type: "Work place type",
  description: "Description",
  status: "Status",
  organization_id: "Organization",
};

type Change = { from?: Json; to?: Json; changed?: boolean };

function isRecord(
  value: Json | undefined,
): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A stored value in readable form: status and work place type get their labels; empty → "—". */
function formatValue(field: string, value: Json | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (
    field === "status" &&
    typeof value === "string" &&
    value in JOB_STATUS_LABELS
  ) {
    return JOB_STATUS_LABELS[value as keyof typeof JOB_STATUS_LABELS];
  }
  if (field === "workplace_type" && typeof value === "string") {
    return workplaceLabel(value as WorkplaceType) ?? value;
  }
  return String(value);
}

/**
 * The entry's details as short readable lines, e.g.
 *   status_changed → ["Status: Open → Closed"]
 *   updated        → ["Title: Dev → Senior Dev", "Description changed"]
 *   created        → ["Status: Draft"]
 */
export function describeDetails(details: Json): string[] {
  if (!isRecord(details)) return [];

  const changes = details.changes;
  if (isRecord(changes)) {
    return Object.entries(changes).map(([field, raw]) => {
      const change = (isRecord(raw) ? raw : {}) as Change;
      const label = FIELD_LABELS[field] ?? field;
      if (change.changed || field === "organization_id")
        return `${label} changed`;
      return `${label}: ${formatValue(field, change.from)} → ${formatValue(field, change.to)}`;
    });
  }

  if ("status" in details)
    return [`Status: ${formatValue("status", details.status)}`];
  return [];
}
