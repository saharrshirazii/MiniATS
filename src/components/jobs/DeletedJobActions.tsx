import { Loader2, RotateCcw, Trash2 } from "lucide-react";
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
import { usePurgeJob, useRestoreJob, type JobWithCounts } from "@/hooks/useJobs";

/** Admins: restore a soft-deleted job, with confirmation and a success toast. */
export function RestoreJobDialog({ job }: { job: JobWithCounts }) {
  const [open, setOpen] = useState(false);
  const restore = useRestoreJob();

  const confirm = async () => {
    try {
      await restore.mutateAsync(job.id);
      toast.success("Job restored", {
        description: `"${job.title}" is back, with its candidates and status.`,
      });
      setOpen(false);
    } catch {
      // Error is shown in the dialog.
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) restore.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Restore ${job.title}`}>
          <RotateCcw />
          Restore
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restore job?</DialogTitle>
          <DialogDescription>
            Restore <strong className="text-foreground">{job.title}</strong>? It comes back with its
            status and candidates, and the customer can see it again.
          </DialogDescription>
        </DialogHeader>
        {restore.error && <ErrorMessage message={restore.error.message} />}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={restore.isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={confirm} disabled={restore.isPending}>
            {restore.isPending && <Loader2 className="animate-spin" />}
            Yes, restore
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Admins: delete a soft-deleted job permanently now, with confirmation. */
export function PurgeJobDialog({ job }: { job: JobWithCounts }) {
  const [open, setOpen] = useState(false);
  const purge = usePurgeJob();

  const confirm = async () => {
    try {
      await purge.mutateAsync(job.id);
      toast.success("Job deleted permanently", {
        description: `"${job.title}" and its pipeline were deleted.`,
      });
      setOpen(false);
    } catch {
      // Error is shown in the dialog.
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) purge.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Delete permanently ${job.title}`}
        >
          <Trash2 />
          Delete permanently
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete permanently?</DialogTitle>
          <DialogDescription>
            Permanently delete <strong className="text-foreground">{job.title}</strong> and its
            pipeline? This cannot be undone. The candidates themselves are kept.
          </DialogDescription>
        </DialogHeader>
        {purge.error && <ErrorMessage message={purge.error.message} />}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={purge.isPending}
          >
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={confirm} disabled={purge.isPending}>
            {purge.isPending && <Loader2 className="animate-spin" />}
            Yes, delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
