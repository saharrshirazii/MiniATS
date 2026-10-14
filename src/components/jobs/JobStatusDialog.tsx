import { AlertTriangle, Archive, ArchiveRestore, Loader2, Send } from "lucide-react";
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
import { useUpdateJob, type JobStatus, type JobWithCounts } from "@/hooks/useJobs";

type Action = {
  label: string;
  icon: React.ComponentType;
  next: JobStatus;
  title: string;
  confirmLabel: string;
  toastTitle: string;
  description: (title: React.ReactNode) => React.ReactNode;
};

const ACTIONS: Record<JobStatus, Action> = {
  draft: {
    label: "Publish",
    icon: Send,
    next: "open",
    title: "Publish job?",
    confirmLabel: "Yes, publish",
    toastTitle: "Job published",
    description: (t) => <>Publish {t} and start recruiting for it?</>,
  },
  open: {
    label: "Close",
    icon: Archive,
    next: "closed",
    title: "Close job?",
    confirmLabel: "Yes, close job",
    toastTitle: "Job closed",
    description: (t) => (
      <>Close {t}? Its candidates stay in the pipeline. You can reopen the job at any time.</>
    ),
  },
  closed: {
    label: "Reopen",
    icon: ArchiveRestore,
    next: "open",
    title: "Reopen job?",
    confirmLabel: "Yes, reopen job",
    toastTitle: "Job reopened",
    description: (t) => <>Reopen {t} and start recruiting for it again?</>,
  },
};

/**
 * Status changes with confirmation and a success toast:
 * draft → Publish (open), open → Close, closed → Reopen.
 * Publishing needs a work place type (drafts may be saved without one).
 */
export function JobStatusDialog({ job }: { job: JobWithCounts }) {
  const [open, setOpen] = useState(false);
  const updateJob = useUpdateJob();
  const action = ACTIONS[job.status];
  const Icon = action.icon;
  const missingForPublish = job.status === "draft" && !job.workplace_type;
  const title = <strong className="text-foreground">{job.title}</strong>;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) updateJob.reset();
  };

  const confirm = async () => {
    try {
      await updateJob.mutateAsync({ id: job.id, status: action.next });
      toast.success(action.toastTitle, {
        description: `"${job.title}" is now ${action.next === "open" ? "open" : "closed"}.`,
      });
      setOpen(false);
    } catch {
      // Error is shown in the dialog.
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`${action.label} ${job.title}`}>
          <Icon />
          {action.label}
        </Button>
      </DialogTrigger>

      <DialogContent>
        {missingForPublish ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-500" />
                Complete the job first
              </DialogTitle>
              <DialogDescription>
                {title} has no work place type yet. Use Edit to add it, then publish.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                OK
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{action.title}</DialogTitle>
              <DialogDescription>{action.description(title)}</DialogDescription>
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
                {action.confirmLabel}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
