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
