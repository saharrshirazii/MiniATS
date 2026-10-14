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
import { useDeleteCandidate, type CandidateWithApplications } from "@/hooks/useCandidates";

/** Delete a candidate (and their pipeline cards) with confirmation and a success toast. */
export function DeleteCandidateDialog({ candidate }: { candidate: CandidateWithApplications }) {
  const [open, setOpen] = useState(false);
  const deleteCandidate = useDeleteCandidate();
  const appCount = candidate.applications.length;

  const confirm = async () => {
    try {
      await deleteCandidate.mutateAsync(candidate.id);
      toast.success("Candidate deleted", {
        description: `"${candidate.full_name}" was removed.`,
      });
      setOpen(false);
    } catch {
      // Error shown in the dialog.
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) deleteCandidate.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Delete ${candidate.full_name}`}
        >
          <Trash2 />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete candidate?</DialogTitle>
          <DialogDescription>
            Delete <strong className="text-foreground">{candidate.full_name}</strong>? This cannot
            be undone.
          </DialogDescription>
        </DialogHeader>

        {appCount > 0 && (
          <div
            role="note"
            className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              They are in {appCount} {appCount === 1 ? "job's" : "jobs'"} pipeline
              {appCount === 1 ? "" : "s"} and will be removed from {appCount === 1 ? "it" : "them"}.
            </p>
          </div>
        )}

        {deleteCandidate.error && <ErrorMessage message={deleteCandidate.error.message} />}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={deleteCandidate.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={confirm}
            disabled={deleteCandidate.isPending}
          >
            {deleteCandidate.isPending && <Loader2 className="animate-spin" />}
            Yes, delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
