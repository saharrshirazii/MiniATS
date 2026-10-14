import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorMessage } from "@/components/common/StatusMessages";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useDeleteJob, type JobWithCounts } from "@/hooks/useJobs";
import { DELETED_RETENTION_DAYS } from "@/lib/job-status";

/**
 * Delete a job with confirmation.
 *   • draft → deleted permanently
 *   • other → soft delete: hidden now, restorable by an admin for 90 days
 */
export function DeleteJobDialog({ job }: { job: JobWithCounts }) {
  const [open, setOpen] = useState(false);
  const deleteJob = useDeleteJob();
  const isDraft = job.status === "draft";
  const affected = job.candidateCount;
  const title = <strong className="text-foreground">{job.title}</strong>;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) deleteJob.reset();
  };

  const confirmDelete = async () => {
    try {
      await deleteJob.mutateAsync({ id: job.id, status: job.status });
      toast.success("Job deleted", {
        description: isDraft
          ? `The draft "${job.title}" was deleted.`
          : `"${job.title}" was deleted. An admin can restore it within ${DELETED_RETENTION_DAYS} days.`,
      });
      setOpen(false);
    } catch {
      // Error is shown in the dialog.
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Delete ${job.title}`}
        >
          <Trash2 />
          Delete
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isDraft ? "Delete draft?" : "Delete job?"}</DialogTitle>
          <DialogDescription>
            {isDraft ? (
              <>Delete the draft {title}? It is deleted permanently.</>
            ) : (
              <>
                Delete {title}? It is removed from all lists and the pipeline. An admin can restore
                it within {DELETED_RETENTION_DAYS} days; after that it is deleted permanently.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {!isDraft && affected > 0 && (
          <div
            role="note"
            className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              {affected} {affected === 1 ? "candidate is" : "candidates are"} in this job's pipeline
              and will be hidden with it. The candidates themselves are kept.
            </p>
          </div>
        )}

        {deleteJob.error && <ErrorMessage message={deleteJob.error.message} />}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={deleteJob.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={confirmDelete}
            disabled={deleteJob.isPending}
          >
            {deleteJob.isPending && <Loader2 className="animate-spin" />}
            Yes, delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
