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
import { useDeleteUser, type UserWithOrganization } from "@/hooks/useUsers";

type Props = {
  user: UserWithOrganization;
  isSelf: boolean;
};

/**
 * • yourself → explains you can't delete your own account
 * • others   → "Delete X? They can no longer sign in." → success toast
 * The delete-user Edge Function and the database enforce the same rules.
 */
export function DeleteUserDialog({ user, isSelf }: Props) {
  const [open, setOpen] = useState(false);
  const deleteUser = useDeleteUser();
  const label = user.full_name || user.email || "this user";

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) deleteUser.reset();
  };

  const confirmDelete = async () => {
    try {
      await deleteUser.mutateAsync(user.id);
      toast.success("User deleted", {
        description: `${user.email} can no longer sign in.`,
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
          aria-label={`Delete ${label}`}
        >
          <Trash2 />
          Delete
        </Button>
      </DialogTrigger>

      <DialogContent>
        {isSelf ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-500" />
                You can't delete your own account
              </DialogTitle>
              <DialogDescription>
                Ask another admin to delete it, so the app always keeps an admin
                who can sign in.
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
              <DialogTitle>Delete user?</DialogTitle>
              <DialogDescription>
                Delete <strong className="text-foreground">{label}</strong>
                {user.full_name && <> ({user.email})</>}? They will no longer be
                able to sign in. This cannot be undone.
              </DialogDescription>
            </DialogHeader>

            {deleteUser.error && (
              <ErrorMessage message={deleteUser.error.message} />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={deleteUser.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteUser.isPending}
              >
                {deleteUser.isPending && <Loader2 className="animate-spin" />}
                Yes, delete
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
