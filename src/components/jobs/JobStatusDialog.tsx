import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
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
import { useUpdateJob, type JobWithCounts } from "@/hooks/useJobs";

/** Close an open job, or reopen a closed one — with confirmation and a success toast. */
export function JobStatusDialog({ job }: { job: JobWithCounts }) {
  const [open, setOpen] = useState(false);
  const updateJob = useUpdateJob();
  const closing = job.status === "open";

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) updateJob.reset();
  };

  const confirm = async () => {
    try {
      await updateJob.mutateAsync({ id: job.id, status: closing ? "closed" : "open" });
      toast.success(closing ? "Job closed" : "Job reopened", {
        description: `"${job.title}" is now ${closing ? "closed" : "open"}.`,
      });
      setOpen(false);
    } catch {
      // Error is shown in the dialog.
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`${closing ? "Close" : "Reopen"} ${job.title}`}>
          {closing ? <Archive /> : <ArchiveRestore />}
          {closing ? "Close" : "Reopen"}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{closing ? "Close job?" : "Reopen job?"}</DialogTitle>
          <DialogDescription>
            {closing ? (
              <>
                Close <strong className="text-foreground">{job.title}</strong>? Its candidates stay in
                the pipeline. You can reopen the job at any time.
              </>
            ) : (
              <>
                Reopen <strong className="text-foreground">{job.title}</strong> and start recruiting
                for it again?
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {updateJob.error && <ErrorMessage message={updateJob.error.message} />}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={updateJob.isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={confirm} disabled={updateJob.isPending}>
            {updateJob.isPending && <Loader2 className="animate-spin" />}
            {closing ? "Yes, close job" : "Yes, reopen job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
