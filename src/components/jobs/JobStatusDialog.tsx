import { AlertTriangle, Archive, CircleSlash, Loader2, Pause, Play, Send } from "lucide-react";
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
import type { JobStatusActionKey } from "@/lib/job-status";

type ActionConfig = {
  label: string;
  icon: React.ComponentType;
  next: JobStatus;
  title: string;
  confirmLabel: string;
  toastTitle: string;
  toastDescription: string; // after the job title, e.g. "is now open."
  description: (title: React.ReactNode) => React.ReactNode;
};

const ACTIONS: Record<JobStatusActionKey, ActionConfig> = {
  publish: {
    label: "Publish",
    icon: Send,
    next: "open",
    title: "Publish job?",
    confirmLabel: "Yes, publish",
    toastTitle: "Job published",
    toastDescription: "is now open.",
    description: (t) => <>Publish {t} and start recruiting for it?</>,
  },
  hold: {
    label: "Put on hold",
    icon: Pause,
    next: "on_hold",
    title: "Put job on hold?",
    confirmLabel: "Yes, put on hold",
    toastTitle: "Job on hold",
    toastDescription: "is on hold. Reopen it to continue recruiting.",
    description: (t) => (
      <>
        Put {t} on hold? Recruiting is paused; its candidates stay in the pipeline. You can reopen
        it at any time.
      </>
    ),
  },
  reopen: {
    label: "Reopen",
    icon: Play,
    next: "open",
    title: "Reopen job?",
    confirmLabel: "Yes, reopen",
    toastTitle: "Job reopened",
    toastDescription: "is open again.",
    description: (t) => <>Reopen {t} and continue recruiting?</>,
  },
  close: {
    label: "Close",
    icon: CircleSlash,
    next: "closed",
    title: "Close job?",
    confirmLabel: "Yes, close job",
    toastTitle: "Job closed",
    toastDescription: "is now closed.",
    description: (t) => (
      <>
        Close {t}? Recruiting stops for good: a closed job can't be edited or reopened, only
        archived. Its candidates stay in the pipeline.
      </>
    ),
  },
  archive: {
    label: "Archive",
    icon: Archive,
    next: "archived",
    title: "Archive job?",
    confirmLabel: "Yes, archive",
    toastTitle: "Job archived",
    toastDescription: "was moved to Archived.",
    description: (t) => (
      <>Archive {t}? It moves to the Archived tab and is kept as read-only history.</>
    ),
  },
};

type Props = { job: JobWithCounts; action: JobStatusActionKey };

/**
 * One status change (e.g. Put on hold) with confirmation and a success toast.
 * Publishing a draft needs a work place type (drafts may be saved without one).
 */
export function JobStatusDialog({ job, action: actionKey }: Props) {
  const [open, setOpen] = useState(false);
  const updateJob = useUpdateJob();
  const action = ACTIONS[actionKey];
  const Icon = action.icon;
  const missingForPublish = actionKey === "publish" && !job.workplace_type;
  const title = <strong className="text-foreground">{job.title}</strong>;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) updateJob.reset();
  };

  const confirm = async () => {
    try {
      await updateJob.mutateAsync({ id: job.id, status: action.next });
      toast.success(action.toastTitle, {
        description: `"${job.title}" ${action.toastDescription}`,
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
