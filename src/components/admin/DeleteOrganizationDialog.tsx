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
import { useDeleteOrganization, type OrganizationWithCounts } from "@/hooks/useOrganizations";

type Props = {
  organization: OrganizationWithCounts;
};

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * Two cases:
 *   • not empty → explains what blocks the delete (nothing can be deleted)
 *   • empty     → "Delete X? This cannot be undone." → success toast
 * The database enforces the same rule, so a stale list can't bypass it.
 */
export function DeleteOrganizationDialog({ organization }: Props) {
  const [open, setOpen] = useState(false);
  const deleteOrganization = useDeleteOrganization();

  const { userCount, jobCount, candidateCount } = organization;
  const blockers = [
    userCount > 0 && plural(userCount, "user"),
    jobCount > 0 && plural(jobCount, "job"),
    candidateCount > 0 && plural(candidateCount, "candidate"),
  ].filter(Boolean) as string[];
  const isEmpty = blockers.length === 0;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) deleteOrganization.reset();
  };

  const confirmDelete = async () => {
    try {
      await deleteOrganization.mutateAsync(organization.id);
      toast.success("Organization deleted", {
        description: `"${organization.name}" was deleted.`,
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
          aria-label={`Delete ${organization.name}`}
        >
          <Trash2 />
          Delete
        </Button>
      </DialogTrigger>

      <DialogContent>
        {isEmpty ? (
          <>
            <DialogHeader>
              <DialogTitle>Delete organization?</DialogTitle>
              <DialogDescription>
                Delete <strong className="text-foreground">{organization.name}</strong>? This cannot
                be undone.
              </DialogDescription>
            </DialogHeader>

            {deleteOrganization.error && <ErrorMessage message={deleteOrganization.error.message} />}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={deleteOrganization.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteOrganization.isPending}
              >
                {deleteOrganization.isPending && <Loader2 className="animate-spin" />}
                Yes, delete
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-500" />
                Can't delete this organization
              </DialogTitle>
              <DialogDescription>
                <strong className="text-foreground">{organization.name}</strong> still has{" "}
                {blockers.join(", ")}. Remove or move them first, then try again.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                OK
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
