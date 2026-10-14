import type { Enums } from "@/types/database.types";

type JobStatus = Enums<"job_status">;

/** Status changes a user can make from the jobs list. */
export type JobStatusActionKey = "publish" | "hold" | "reopen" | "close" | "archive";

/**
 * Lifecycle: draft → open ⇄ on hold, open → closed → archived.
 * Which status actions each status offers, in button order.
 */
export const STATUS_ACTIONS: Record<JobStatus, JobStatusActionKey[]> = {
  draft: ["publish"],
  open: ["hold", "close"],
  on_hold: ["reopen"],
  closed: ["archive"],
  archived: [],
};

/** Jobs whose details can still be edited. Closed and archived jobs are final. */
export const EDITABLE_STATUSES: JobStatus[] = ["draft", "open", "on_hold"];

/** Jobs that can be deleted from the list. */
export const DELETABLE_STATUSES: JobStatus[] = ["draft", "open"];

/** Soft-deleted jobs are permanently deleted after this many days (database: purge_deleted_jobs). */
export const DELETED_RETENTION_DAYS = 90;

/** Whole days left before a soft-deleted job is purged (never negative). */
export function daysUntilPurge(deletedAt: string, now = new Date()): number {
  const elapsed = (now.getTime() - new Date(deletedAt).getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(DELETED_RETENTION_DAYS - elapsed));
}

/** Human-readable job status, e.g. for the activity log. */
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: "Draft",
  open: "Open",
  on_hold: "On hold",
  closed: "Closed",
  archived: "Archived",
};
