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

/**
 * Delete a job with confirmation. If candidates are in its pipeline, the
 * dialog says how many will be removed from it (the candidates themselves stay).
 */
export function DeleteJobDialog({ job }: { job: JobWithCounts }) {
  const [open, setOpen] = useState(false);
  const deleteJob = useDeleteJob();
  const affected = job.candidateCount;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) deleteJob.reset();
  };

  const confirmDelete = async () => {
    try {
      await deleteJob.mutateAsync(job.id);
      toast.success("Job deleted", { description: `"${job.title}" was deleted.` });
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
          <DialogTitle>Delete job?</DialogTitle>
          <DialogDescription>
            Delete <strong className="text-foreground">{job.title}</strong>? This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {affected > 0 && (
          <div
            role="note"
            className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              {affected} {affected === 1 ? "candidate is" : "candidates are"} in this job's pipeline
              and will be removed from it. The candidates themselves are kept.
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
